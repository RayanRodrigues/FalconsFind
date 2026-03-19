import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import type { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authenticatedUserGuard: CanActivateFn = (route) => {
  const platformId = inject(PLATFORM_ID);
  if (!isPlatformBrowser(platformId)) {
    return true;
  }

  const authService = inject(AuthService);
  const router = inject(Router);

  const session = authService.getStoredSession();

  if (!session) {
    const returnUrl = route.url.map(s => s.path).join('/');
    return router.parseUrl(`/login?returnUrl=/${returnUrl}`);
  }

  return true;
};
