import { HttpInterceptorFn } from '@angular/common/http';
import { publicEnv } from '../../../config/public-env.generated';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^https?:\/\//i.test(req.url)) {
    return next(req);
  }

  const baseUrl = publicEnv.apiBaseUrl;
  const apiPrefix = publicEnv.apiPrefix;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPrefix = apiPrefix.startsWith('/') ? apiPrefix : `/${apiPrefix}`;
  const normalizedPath = req.url.startsWith('/') ? req.url : `/${req.url}`;
  const url = `${normalizedBase}${normalizedPrefix}${normalizedPath}`;

  return next(req.clone({ url }));
};
