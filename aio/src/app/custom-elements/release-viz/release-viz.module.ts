import { NgModule, Type } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { SharedModule } from '../../shared/shared.module';
import { ReleaseVizComponent } from './release-viz.component';
import { WithCustomElementComponent } from '../element-registry';


@NgModule({
  imports: [ CommonModule, SharedModule, HttpClientModule ],
  declarations: [ ReleaseVizComponent ],
})
export class ReleaseVizModule implements WithCustomElementComponent {
  customElementComponent: Type<any> = ReleaseVizComponent;
}
