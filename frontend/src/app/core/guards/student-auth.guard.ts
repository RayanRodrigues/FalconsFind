import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { UserRole } from '../../models';
import { AuthService } from '../services/auth.service';

export const studentAuthGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const session = authService.getStoredSession();

  if (!session) {
    const returnUrl = route.url.map(s => s.path).join('/');
    return router.parseUrl(`/login?returnUrl=/${returnUrl}`);
  }

  if (session.user.role !== UserRole.STUDENT) {
    authService.logoutStudent();
    return router.parseUrl('/login');
  }

  return true;
};
