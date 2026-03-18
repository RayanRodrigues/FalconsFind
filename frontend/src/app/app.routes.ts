import { Routes } from '@angular/router';
import { DevHomeComponent } from './features/home/dev-home.component';
import { FoundReportFormComponent } from './features/public-reporting/found-report-form/found-report-form.component';
import { LostReportFormComponent } from './features/public-reporting/lost-report-form/lost-report-form.component';
import { FoundItemsPageComponent } from './features/items/pages/found-items-page/found-items-page';
import { ItemDetailsComponent } from './features/items/item-details/item-details.component';
import { ClaimRequest } from './features/claims/pages/claim-request/claim-request';
import { ClaimReview } from './features/claims/pages/claim-review/claim-review';
import { ClaimCancel } from './features/claims/pages/claim-cancel/claim-cancel';
import { EditReportPageComponent } from './features/public-reporting/edit-report-page/edit-report-page.component';

// ✅ ADD THIS IMPORT
import { AdminDashboardComponent } from './features/admin/admin-dashboard.component';

export const routes: Routes = [
  {
    path: '',
    component: DevHomeComponent,
    title: 'FalconFind – Lost & Found'
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
    path: 'claim-request',
    component: ClaimRequest
  },
  {
    path: 'admin/claims',
    component: ClaimReview,
    title: 'Claim Review - FalconFind'
  },

  // ✅ ADD THIS NEW ROUTE (YOUR US4.1 FEATURE)
  {
    path: 'admin/validate-items',
    component: AdminDashboardComponent,
    title: 'Validate Found Items - FalconFind'
  },

  {
    path: 'claim-cancel',
    component: ClaimCancel,
    title: 'Cancel Claim Request - FalconFind'
  },
  {
    path: 'edit-report',
    component: EditReportPageComponent,
    title: 'Edit Report - FalconFind'
  },
  {
    path: 'items/:id',
    component: ItemDetailsComponent,
    title: 'Item Details - FalconFind'
  },

  // optional fallback
  {
    path: '**',
    redirectTo: ''
  }
];
