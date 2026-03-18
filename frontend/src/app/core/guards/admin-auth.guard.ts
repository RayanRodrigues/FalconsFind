import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { UserRole } from '../../models';
import { AuthService } from '../services/auth.service';

export const adminAuthGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const session = authService.getStoredSession();

  if (!session) {
    return router.parseUrl('/login');
  }

  if (session.user.role !== UserRole.ADMIN && session.user.role !== UserRole.SECURITY) {
    authService.logout();
    return router.parseUrl('/login');
  }

  return true;
};
