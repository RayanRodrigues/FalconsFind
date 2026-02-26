import { Routes } from '@angular/router';
import { DevHomeComponent } from './features/home/dev-home.component';
import { FoundReportFormComponent } from './features/public-reporting/found-report-form/found-report-form.component';
import { LostReportFormComponent } from './features/public-reporting/lost-report-form/lost-report-form.component';
import { FoundItemsPageComponent } from './features/items/pages/found-items-page/found-items-page';
import { ItemDetailsComponent } from './features/items/item-details/item-details.component';

export const routes: Routes = [
  {
    path: '',
    component: DevHomeComponent,
    title: 'FalconFind - In Development'
  },
  {
    path: 'report/lost',
    component: LostReportFormComponent,
    title: 'Report Lost Item - FalconFind'
  },
  {
    path: 'report/found',
    component: FoundReportFormComponent,
    title: 'Report Found Item - FalconFind'
  },
  {
    path: 'found-items',
    component: FoundItemsPageComponent,
    title: 'Found Items - FalconFind'
  },
  {
    path: 'items/:id',
    component: ItemDetailsComponent,
    title: 'Item Details - FalconFind'
  },
  // ... other routes
];
