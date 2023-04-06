import { AfterViewInit, Component, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';

class MonthYear {
  constructor(
    public month: number | string,
    public year: number | string
  ) { }
}

interface iRelease {
  version: string;
  status: string;
  released: string;
  activeEnds: string;
  ltsEnds: string;
  activeDuration: MonthYear[];
  ltsDuration: MonthYear[];
}

class Release implements iRelease {
  version='';
  status='';
  released='';
  activeEnds='';
  ltsEnds='';
  activeDuration: MonthYear[] = [];
  ltsDuration: MonthYear[] = [];
  constructor(
    r: iRelease
  ) {
    Object.assign(this, r);
  }

  isActive() {
    const released = new Date(this.released).getTime();
    const activeEnds = new Date(this.activeEnds).getTime();
    const today = new Date().getTime();
    return (released <= today && activeEnds >= today);
  }

  isFuture() {
    if (!this.released) {
      return true;
    }
    const released = new Date(this.released).getTime();
    const today = new Date().getTime();
    return released > today;
  }

  isUnsupported() {
    const ltsDate = new Date(this.ltsEnds).getTime();
    const today = new Date().getTime();
    return ltsDate <= today;
  }

  isLTS() {
    return !this.isActive() && !this.isFuture() && !this.isUnsupported();
  }

  /**
   * This method is used in markup, and is needed because an error is generated
   * when the markup uses `thisRef[prop]` square braces to access a property on
   * the release instance.
   *
   * @param key a property of this class
   * @returns the value of the property of this class
   */
  getKey(key: string): string {
    return (this as any)[key].toString();
  }
}

class SVGRect {
  type = 'rect';
  body = '';
  constructor(
    public width: number,
    public height: number,
    public x: number,
    public cssClass = '',
    public y: number | string = 0,
    public rx: number | string = 0
  ) { }
}

class SVGLine {
  type = 'line';
  public someData: string | undefined;
  constructor(
    public x1: number,
    public y1: number,
    public x2: number,
    public y2: number,
    public cssClass = '',
    public dashed = true,
  ) { }
}

class SVGText {
  type = 'text';
  constructor(
    public x: number,
    public y: number,
    public text: string | number,
    public cssClass = '',
  ){ }
}

class SVGGroup {
  constructor(
    public translatePoints: number[],
    public children: any[]
  ) { }
}

class VersionLine {
  private _keysAsCamel = {
    version: 'version',
    status: 'status',
    released: 'released',
    'active ends': 'activeEnds',
    'lts ends': 'ltsEnds'
  } as any;

  get keys() {
    return this._keys;
  }

  asCamel(key: string): string {
    return this._keysAsCamel[key];
  }

  private split() {
    return this._line.trim().split('|').filter(x => x).map(x => x.trim());
  }

  constructor(private _line: string, private _keys: string[] = []) { }

  asArray() {
    return this.split();
  }

  asObject(): Release {
    const line = {} as any;
    this.asArray().forEach((k, i) => {
      const camelKey = this.asCamel((this._keys[i] || '').toLowerCase());
      line[camelKey] = k;
      line[this._keys[i]] = k;
    });
    return line;
  }
}

class ReleaseCollection {
  private _lines: VersionLine[] = [];
  private _releases: Release[] = [];
  private _duration: MonthYear[] = [];

  // used in template
  get lines() {
    return this._lines;
  }

  get releases() {
    return this._releases;
  }

  get duration() {
    return this._duration;
  }

  constructor(rawText: string, private monthBuffer = 0, public sortAscendingTopToBottom = false) {
    this._lines = this.parseVersionLinesFromRawText(rawText);
    this._releases = this.massageReleaseData(this._lines.map(x => new Release(x.asObject())));
    const { first, last } = this.getFirstAndLastReleaseDates(this.releases);
    this._duration = this.getMonthsAndYearsBetweenDateStrings(first, last, this.monthBuffer);
  }

  private getFirstAndLastReleaseDates(releases: Release[]) {
    return this.sortAscendingTopToBottom ?
      {
        first: releases[0].released,
        last: releases[releases.length - 1].ltsEnds
      }:
      {
        first: releases[this.releases.length - 1].released,
        last: releases[0].ltsEnds,
      };
  }

  private parseVersionLinesFromRawText(versionText: string) {
    const allLines = versionText.split('\n');
    const versionLines = allLines.slice(1, -1);
    const keys = new VersionLine(versionLines[0]).asArray();
    const result = [] as any;
    for (let i = 0; i < versionLines.length; i++) {

      // skip header and separator rows
      if (i === 0 || i === 1) {
        continue;
      }

      // body row(s)
      result.push(new VersionLine(versionLines[i], keys));

    }
    return result;
  }

  private massageReleaseData(releases: Release[]) {
    return this.appendDurations(
      this.sortReleases(releases)
    );
  }

  private appendDurations(releases: Release[]) {
    return releases.map((r) => {
      r.activeDuration = this.getMonthsAndYearsBetweenDateStrings(r.released, r.activeEnds);
      r.ltsDuration = this.getMonthsAndYearsBetweenDateStrings(r.activeEnds, r.ltsEnds);
      return r;
    });
  }

  private sortReleases(releases: Release[]) {
    const result = releases.sort((a, b) => {
      const aReleaseDate = new Date(a.released).getTime();
      const bReleaseDate = new Date(b.released).getTime();
      const abOrder = ((aReleaseDate < bReleaseDate) ? -1 : 1);
      return (aReleaseDate === bReleaseDate) ? 0 : abOrder;
    });
    return this.sortAscendingTopToBottom ? result : result.reverse();
  }

  private getDates(firstDate: string, secondDate: string, endBuffer: number) {
    const fromDate = new Date(firstDate);
    const toDate = new Date(secondDate);

    return [
      new Date(fromDate.setMonth(fromDate.getMonth() - endBuffer)),
      new Date(toDate.setMonth(toDate.getMonth() + endBuffer))
    ];
  }

  private getMonthsAndYearsBetweenDateStrings(firstDate: string, secondDate: string, endBuffer = 0): MonthYear[] {
    const [ fromDate, toDate ] = this.getDates(firstDate, secondDate, endBuffer);
    const fromYear = fromDate.getFullYear();
    const fromMonth = fromDate.getMonth();
    const toYear = toDate.getFullYear();
    const toMonth = toDate.getMonth();
    const monthYearPairs = [];

    for(let year = fromYear; year <= toYear; year++) {
      let monthNum = year === fromYear ? fromMonth : 0;
      const monthLimit = year === toYear ? toMonth : 11;

      for(; monthNum <= monthLimit; monthNum++) {
        const month = monthNum + 1;
        monthYearPairs.push({ year, month });
      }
    }
    return monthYearPairs;
  }

}

export class SVG {
  // svg element
  private _svgContainer: HTMLElement | undefined;

  // base svg height
  private _height = 350;

  // base svg width
  private _width = 460;

  // classes for svg elements and other stuff
  private _cssClasses = {
    monthLine: 'rv-month-line',
    todayLine: 'rv-today-line',
    todayText: 'rv-today-text',
    active: 'rv-active',
    lts: 'rv-lts',
    unsupported: 'rv-unsupported',
    future: 'rv-future',
    partialOpaque: 'rv-partial-opaque',
    yAxisVersion: 'rv-y-axis-version'
  };

  private _releaseCollection: ReleaseCollection;
  private _monthLines: SVGGroup[] = [];
  private _releaseBars: SVGGroup[] = [];
  private _legend: SVGGroup[] = [];

  // margins within svg element
  private _margin = { top: 30, right: 50, bottom: 60, left: 80 };

  // computed svg width, accounting for margins
  private _computedWidth = this._width - this._margin.left - this._margin.right;

  // computed svg height, accounting for margins
  private _computedHeight = this._height - this._margin.top - this._margin.bottom;

  // height of bars in bar/rect graph (incl yAxis bars)
  private _rectHeight = 35;

  // margin between bars/rects
  private _rectMargin = 15;

  // width of yAxis version bar/rect
  private _yAxisVersionRectWidth = 55;

  // number of months before and after first and last release month (respectively)
  private _monthBuffer = 3;

  private get _units() {
    return this._computedWidth / this._releaseCollection.duration.length;
  }

  get releaseCollection() {
    return this._releaseCollection;
  }

  get renderGroups() {
    return [
      ...this._monthLines,
      ...this._releaseBars,
      ...this._legend,
    ];
  }

  get overallWidth() {
    return this._computedWidth + this._margin.left + this._margin.right;
  }

  get overallHeight() {
    return this._computedHeight + this._margin.top + this._margin.bottom;
  }

  constructor(releaseMarkdown: string) {
    this._releaseCollection = new ReleaseCollection(releaseMarkdown, this._monthBuffer);
  }

  private init() {
    this.initMonthLinesAndXAxis();
    this.initReleaseBarsAndYAxis();
    this.initLegend();
    this.calcHeightAndWidth();
  }

  private getTodayLine() {
    const todayDate = new Date();
    const todayYear = todayDate.getFullYear();
    const todayMonth = todayDate.getMonth() + 1;
    const todayDayInMonth = todayDate.getDate();
    const daysInMonth = new Date(todayYear, todayMonth, 0).getDate();
    const percentIntoCurrentMonth = this._units * (todayDayInMonth/daysInMonth);
    const x = this.getX(new MonthYear(todayMonth, todayYear)) + percentIntoCurrentMonth;
    const children = [
      new SVGLine (
        x,
        this._computedHeight,
        x,
        0,
        this._cssClasses.todayLine,
        true
      ),
      new SVGText(
        x - 35,
        0,
        `${todayYear}-${todayMonth}-${todayDayInMonth}`,
        this._cssClasses.todayText
      )
    ];

    return new SVGGroup(
      this.getTranslate(0, true),
      children
    );
  }

  private initLegend() {
    const statuses = {} as any;
    this._releaseCollection.releases.map((release: Release) => {
      statuses[release.status] = this.determineReleaseClass(release);
    });

    const statusKeys = Object.keys(statuses);
    const y = this._computedHeight + this._margin.top + 20;
    this._legend = statusKeys.map((status: string, i) => {

      const statusCamel = statuses[status];
      const margins = this._margin.left + this._margin.right;
      const populableWidth = this._computedWidth - margins;
      const x: number = ((populableWidth / statusKeys.length) * i) + this._margin.left;

      const children = [

        new SVGRect(
          10,
          10,
          x,
          statusCamel,
          0,
          15
        ),

        new SVGText(
          x + 15,
          10,
          status
        )

      ] as any[];
      return new SVGGroup(
        [x, y],
        children
      );
    });
  }

  private initMonthLinesAndXAxis(): void {
    this._monthLines = [
      this.getTodayLine(),
      ...this._releaseCollection.duration.map((releaseMonthAndYear: MonthYear, i: number) => {

      const children = [
        new SVGLine(
          this.getX(releaseMonthAndYear),
          this._computedHeight,
          this.getX(releaseMonthAndYear),
          0,
          [this._cssClasses.monthLine, this._cssClasses.partialOpaque].join(' '),
          releaseMonthAndYear.month !== 1
        ),
      ] as any[];

      // x axis year element
      if (releaseMonthAndYear.month === 1) {
        children.push(
          new SVGText(
            this.getX(releaseMonthAndYear) - 18,
            this._computedHeight + 20,
            releaseMonthAndYear.year
          )
        );
      }

      return new SVGGroup(
        this.getTranslate(i, true),
        children
      );

    })];
  }

  private determineReleaseClass(release: Release) {
    return release.isActive() ? this._cssClasses.active :
      release.isFuture() ? this._cssClasses.future :
        release.isUnsupported() ? this._cssClasses.unsupported:
          release.isLTS() ? this._cssClasses.lts: '';
  }

  private getYAxisElements() {
    return this._releaseCollection.releases.map((release: Release, i: number) => {
      const children = [

        // y axis background
        new SVGRect(
          this._yAxisVersionRectWidth,
          this._rectHeight,
          0,
          this.determineReleaseClass(release),
          3,
          5
        ),

        // y axis text (always add text last for z-index purposes)
        new SVGText(
          (this._rectHeight * 2) * .1,
          this._rectHeight * .65,
          release.version,
          this._cssClasses.yAxisVersion
        ),

      ] as any[];

      return new SVGGroup(
        [0, this.getTranslate(i)[1]],
        children
      );
    });
  }

  private getReleaseBarsElements() {
    return this._releaseCollection.releases.map((release: Release, i: number) => {

      const children = [

        // active release period
        new SVGRect(
          this.getBarWidth(release.activeDuration),
          this._rectHeight,
          this.getX(release.activeDuration[0]),
          this._cssClasses.active,
        ),

        // lts release period
        new SVGRect(
          this.getBarWidth(release.ltsDuration),
          this._rectHeight,
          this.getX(release.ltsDuration[0]),
          this._cssClasses.lts,
        ),

      ] as any[];

      // purple stripe for future
      if (release.isFuture()) {
        children.push(
          new SVGRect(
            this.getBarWidth([...release.activeDuration, ...release.ltsDuration]),
            this._rectHeight/3,
            this.getX(release.activeDuration[0]),
            [this._cssClasses.future, this._cssClasses.partialOpaque].join(' '),
            (this._rectHeight/3)*2
          )
        );
      }

      // red stripe for unsupported
      if (release.isUnsupported()) {
        children.push(
          new SVGRect(
            this.getBarWidth([...release.activeDuration, ...release.ltsDuration]),
            this._rectHeight/3,
            this.getX(release.activeDuration[0]),
            [this._cssClasses.unsupported,, this._cssClasses.partialOpaque].join(' '),
            (this._rectHeight/3)*2
          )
        );
      }

      return new SVGGroup(
        this.getTranslate(i),
        children
      );
    });
  }

  private initReleaseBarsAndYAxis(): void {
    this._releaseBars = [
      ...this.getYAxisElements(),
      ...this.getReleaseBarsElements()
    ];
  }

  private getTranslate(index: number, forLine = false) {
    let rectTop = 0;
    let margin = this._rectMargin;
    if (!forLine) {
      rectTop = (index + 1) * 25;
      margin = (index + 1) * this._rectMargin;
    }
    return [this._margin.left, rectTop + margin];
  }

  private getX(monthYear: MonthYear) {
    let i = 0;
    while(i < this._releaseCollection.duration.length) {
      if (
        monthYear.month === this._releaseCollection.duration[i].month &&
        monthYear.year === this._releaseCollection.duration[i].year
      ) {
        break;
      }
      i++;
    }

    return i * this._units;
  }

  private getBarWidth(duration: MonthYear[]) {
    return this.getX(duration[duration.length -1]) - this.getX(duration[0]);
  }

  calcHeightAndWidth() {
    if (!this._svgContainer) { return; }
    this._computedWidth = this._svgContainer.offsetWidth - this._margin.left - this._margin.right;
    this._computedHeight =
      Math.max(this._computedHeight, this._height)- this._margin.top - this._margin.bottom;
    this.initMonthLinesAndXAxis();
    this.initReleaseBarsAndYAxis();
  }

  initContainer(container: any) {
    this._svgContainer = container;
    this.init();
  }
}

const styles = [
  `
  svg {
    height: 100%;
    width: 100%;
    position: relative;
    display: block;
    min-height: 250px;
  }

  .rv-container {
    width: calc(100% - 1.5em);
    position: relative;
    min-height: 250px;
    padding-left: 1.5em;
  }

  .rv-month-line {
    stroke: #bbb9b9;
  }

  .rv-today-line {
    stroke: black;
  }

  .rv-today-text {
    stroke: gray;
    fill: gray;
  }

  .rv-month-line[stroke-dasharray] {
    opacity: .7;
  }

  .rv-active {
    fill: #07ba60;
    background-color: #07ba60;
    padding: 0.5em 0.5em 0.5em 0.5em;
    border-radius: 5px;
  }

  .rv-lts {
    fill: #f3d354;
    background-color: #f3d354;
    padding: 0.5em 0.5em 0.5em 0.5em;
    border-radius: 5px;
  }

  .rv-unsupported {
    fill: #ff3333;
    background-color: #ff3333;
    padding: 0.5em 0.5em 0.5em 0.5em;
    border-radius: 5px;
  }

  .rv-future {
    fill: #cc6ce5;
    background-color: #cc6ce5;
    padding: 0.5em 0.5em 0.5em 0.5em;
    border-radius: 5px;
  }

  .rv-partial-opaque {
    opacity: .85;
  }

  .rv-y-axis-version {
    font-size: .75em;
  }
  
  .rv-table {
    width: 80%;
    text-align: center;
    margin: 0 0 1em 10%;
  }

  .rv-table-head {
    font-weight: 700;
    
  }

  .rv-table-column {
    display: inline-block;
    text-align: center;
  }

  .rv-table-row {
    font-weight: 500;
    padding: 0.5em 0 0.5em 0;
  }

  .rv-table-row:not(:last-child) {
    border-bottom: 1px solid black;
  }
  `
];

/**
 * Display supported versions as a visualisation.
 *
 * The data for the supported versions is a md table in the
 * `aio/content/guide/releases.md#Actively supported versions` section
 *
 * The format for that table looks like:
 *
 * ```
 * | Version | Status | Released   | Active ends | LTS ends   |
 * |:---     |:---    |:---        |:---         |:---        |
 * | ^15.0.0 | Active | 2022-11-18 | 2023-05-18  | 2024-05-18 |
 * | ^14.0.0 | LTS    | 2022-06-02 | 2022-11-18  | 2023-11-18 |
 * | ^13.0.0 | LTS    | 2021-11-04 | 2022-06-02  | 2023-05-04 |
 * ```
 * This component presumes the dividing row between header and body is there and
 * will parse incorrectly if it is not.
 *
 * This component also supports visualizing no-longer-supported and future releases/versions.
 * For future releases, simply list `Released`/`Active ends`/`LTS ends` date(s) in the future.
 * For releases that are no longer supported, if the `LTS ends` date has passed, a release will
 * show as no longer supported (for whatever status is used).
 *
 */
@Component({
  selector: 'aio-release-viz',
  styles,
  templateUrl: './release-viz.component.html'
})
export class ReleaseVizComponent implements OnInit, AfterViewInit {
  @ViewChild('svgContainer', { static: true }) svgContainer: any;

  svg: SVG | undefined;
  renderGroups: SVGGroup[] = [];

  constructor(
    private elementRef: ElementRef
  ) {  }

  @HostListener('window:resize', ['$event'])
  onResize(_e: any) {
    this.svg?.calcHeightAndWidth();
  }

  ngOnInit() {
    const releaseMarkdown = this.elementRef.nativeElement.innerHTML;
    this.svg = new SVG(releaseMarkdown);
  }

  ngAfterViewInit(): void {
    this.svg?.initContainer(this.svgContainer.nativeElement);
    this.renderGroups = this.svg?.renderGroups as any;
  }
}
