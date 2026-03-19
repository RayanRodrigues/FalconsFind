import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authenticatedUserGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  return authService.restoreSession().then(() => {
    const session = authService.getStoredSession();

    if (!session) {
      const returnUrl = route.url.map(s => s.path).join('/');
      return router.parseUrl(`/login?returnUrl=/${returnUrl}`);
    }

    return true;
  });
};
