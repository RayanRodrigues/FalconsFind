import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AdminReportsComponent } from './sections/admin-reports.component';
import { AdminClaimsComponent } from './sections/admin-claims.component';
import { AdminStatisticsComponent } from './sections/admin-statistics.component';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { UserRole } from '../../models/enums/user-role.enum';

type Tab = 'reports' | 'claims' | 'statistics';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    AdminReportsComponent,
    AdminClaimsComponent,
    AdminStatisticsComponent,
  ],
  templateUrl: './admin-dashboard.component.html',
  styleUrls: ['./admin-dashboard.component.scss'],
})
export class AdminDashboardComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly themeService = inject(ThemeService);

  readonly activeTab = signal<Tab>('reports');
  readonly sidebarOpen = signal(false);
  readonly userEmail = signal<string>('');
  readonly userRole = signal<string>('');
  readonly userInitials = signal<string>('');
  readonly isLoggingOut = signal(false);

  ngOnInit(): void {
    const session = this.authService.getStoredSession();
    if (session) {
      const displayName = session.user.displayName?.trim() ?? '';
      const email = session.user.email;
      this.userEmail.set(email);
      this.userRole.set(session.user.role === UserRole.ADMIN ? 'Admin' : 'Campus Security');
      this.userInitials.set(this.deriveInitials(displayName || email));
    }
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.sidebarOpen.set(false);
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  isDarkMode(): boolean {
    return this.themeService.isDarkMode();
  }

  logout(): void {
    if (this.isLoggingOut()) return;

    this.isLoggingOut.set(true);
    this.authService.logout().subscribe({
      complete: () => this.router.navigate(['/login']),
      error: () => this.router.navigate(['/login']),
    });
  }

  getPageTitle(): string {
    switch (this.activeTab()) {
      case 'reports':
        return 'Found Reports';
      case 'claims':
        return 'Claims';
      case 'statistics':
        return 'Statistics';
      default:
        return 'Admin Dashboard';
    }
  }

  private deriveInitials(value: string): string {
    const normalized = value.includes('@') ? value.split('@')[0] : value;
    const parts = normalized.split(/[._\-\s]+/).filter(Boolean);

    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }

    return normalized.slice(0, 2).toUpperCase();
  }
}
