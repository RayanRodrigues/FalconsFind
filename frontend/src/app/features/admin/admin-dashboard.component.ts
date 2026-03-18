import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminReportsComponent } from './sections/admin-reports.component';
import { AdminClaimsComponent } from './sections/admin-claims.component';
import { AuthService } from '../../core/services/auth.service';
import { UserRole } from '../../models/enums/user-role.enum';

type Tab = 'reports' | 'claims';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [RouterLink, AdminReportsComponent, AdminClaimsComponent],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly activeTab = signal<Tab>('reports');
  readonly sidebarOpen = signal(false);
  readonly userEmail = signal<string>('');
  readonly userRole = signal<string>('');
  readonly userInitials = signal<string>('');

  ngOnInit(): void {
    const session = this.authService.getStoredSession();
    if (session) {
      const email = session.user.email;
      this.userEmail.set(email);
      this.userRole.set(session.user.role === UserRole.ADMIN ? 'Admin' : 'Campus Security');
      this.userInitials.set(this.deriveInitials(email));
    }
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.sidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  readonly isLoggingOut = signal(false);

  logout(): void {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }

  private deriveInitials(email: string): string {
    const local = email.split('@')[0];
    const parts = local.split(/[._-]/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return local.slice(0, 2).toUpperCase();
  }
}
