import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { publicEnv } from '../../../config/public-env.generated';
import { AuthService } from '../../services/auth.service';

const normalizeBase = (value: string): string => value.endsWith('/') ? value.slice(0, -1) : value;
const normalizePrefix = (value: string): string => value.startsWith('/') ? value : `/${value}`;

const isApiRequest = (url: string): boolean => {
  if (!/^https?:\/\//i.test(url)) {
    return true;
  }

  const apiBaseUrl = normalizeBase(publicEnv.apiBaseUrl);
  const apiPrefix = normalizePrefix(publicEnv.apiPrefix);
  return url.startsWith(`${apiBaseUrl}${apiPrefix}/`) || url === `${apiBaseUrl}${apiPrefix}`;
};

export const authTokenInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.headers.has('Authorization') || !isApiRequest(req.url)) {
    return next(req);
  }

  const authService = inject(AuthService);
  const session = authService.getStoredSession();
  if (!session?.idToken) {
    return next(req);
  }

  return next(
    req.clone({
      setHeaders: {
        Authorization: `Bearer ${session.idToken}`,
      },
    }),
  );
};
