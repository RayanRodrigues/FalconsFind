import { Routes } from '@angular/router';
import { DevHomeComponent } from './features/home/dev-home.component';
import { FoundReportFormComponent } from './features/public-reporting/found-report-form/found-report-form.component';
import { LostReportFormComponent } from './features/public-reporting/lost-report-form/lost-report-form.component';
import { FoundItemsPageComponent } from './features/items/pages/found-items-page/found-items-page';
import { ItemDetailsComponent } from './features/items/item-details/item-details.component';
import { ClaimRequest } from './features/claims/pages/claim-request/claim-request';
import { ClaimCancel } from './features/claims/pages/claim-cancel/claim-cancel';
import { EditReportPageComponent } from './features/public-reporting/edit-report-page/edit-report-page.component';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { AdminDashboardComponent } from './features/admin/admin-dashboard.component';
import { adminAuthGuard } from './core/guards/admin-auth.guard';
import { studentAuthGuard } from './core/guards/student-auth.guard';

export const routes: Routes = [
  {
    path: '',
    component: DevHomeComponent,
    title: 'FalconFind - Lost & Found'
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
    path: 'login',
    component: LoginComponent,
    title: 'Login - FalconFind'
  },
  {
    path: 'register',
    component: RegisterComponent,
    title: 'Create Account - FalconFind'
  },
  {
    path: 'claim-request',
    component: ClaimRequest,
    canActivate: [studentAuthGuard],
    title: 'Claim Request - FalconFind'
  },
  {
    path: 'admin/dashboard',
    component: AdminDashboardComponent,
    canActivate: [adminAuthGuard],
    title: 'Admin Dashboard - FalconFind'
  },
  {
    path: 'admin',
    redirectTo: 'admin/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'admin/claims',
    redirectTo: 'admin/dashboard',
    pathMatch: 'full'
  },
  {
    path: 'admin/validate-items',
    redirectTo: 'admin/dashboard',
    pathMatch: 'full'
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
