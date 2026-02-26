import { HttpInterceptorFn } from '@angular/common/http';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const DEFAULT_API_PREFIX = '/api/v1';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^https?:\/\//i.test(req.url)) {
    return next(req);
  }

  const runtimeWindow = globalThis as {
    window?: { __env?: { API_BASE_URL?: string; API_PREFIX?: string } };
  };
  const baseUrl = runtimeWindow.window?.__env?.API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const apiPrefix = runtimeWindow.window?.__env?.API_PREFIX ?? DEFAULT_API_PREFIX;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPrefix = apiPrefix.startsWith('/') ? apiPrefix : `/${apiPrefix}`;
  const normalizedPath = req.url.startsWith('/') ? req.url : `/${req.url}`;
  const url = `${normalizedBase}${normalizedPrefix}${normalizedPath}`;

  return next(req.clone({ url }));
};
