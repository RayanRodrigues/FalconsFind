import { HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { publicEnv } from '../../../config/public-env.generated';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^https?:\/\//i.test(req.url)) {
    if (publicEnv.appEnv === 'production' && /^http:\/\//i.test(req.url)) {
      return throwError(() => new Error('In production, API requests must use HTTPS.'));
    }

    return next(req);
  }

  const baseUrl = publicEnv.apiBaseUrl;
  const apiPrefix = publicEnv.apiPrefix;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPrefix = apiPrefix.startsWith('/') ? apiPrefix : `/${apiPrefix}`;
  const normalizedPath = req.url.startsWith('/') ? req.url : `/${req.url}`;
  const url = `${normalizedBase}${normalizedPrefix}${normalizedPath}`;

  if (publicEnv.appEnv === 'production' && /^http:\/\//i.test(url)) {
    return throwError(() => new Error('In production, API requests must use HTTPS.'));
  }

  return next(req.clone({ url }));
};
