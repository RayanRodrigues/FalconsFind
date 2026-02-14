import { HttpInterceptorFn } from '@angular/common/http';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const API_PREFIX = '/api/v1';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {
  if (/^https?:\/\//i.test(req.url)) {
    return next(req);
  }

  const runtimeWindow = globalThis as {
    window?: { __env?: { API_BASE_URL?: string } };
  };
  const baseUrl = runtimeWindow.window?.__env?.API_BASE_URL ?? DEFAULT_API_BASE_URL;
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = req.url.startsWith('/') ? req.url : `/${req.url}`;
  const url = `${normalizedBase}${API_PREFIX}${normalizedPath}`;

  return next(req.clone({ url }));
};
