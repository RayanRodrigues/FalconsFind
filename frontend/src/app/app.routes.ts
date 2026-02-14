import { Routes } from '@angular/router';
import { DevHomeComponent } from './features/home/dev-home.component';
import { LostReportFormComponent } from './features/public-reporting/lost-report-form/lost-report-form.component';

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
  // ... other routes
];
