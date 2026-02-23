import { HttpInterceptorFn } from '@angular/common/http';

const DEFAULT_API_BASE_URL = 'http://localhost:3000';
const API_PREFIX = '/api/v1';

export const apiBaseUrlInterceptor: HttpInterceptorFn = (req, next) => {

  // If already absolute, do nothing
  if (/^https?:\/\//i.test(req.url)) {
    return next(req);
  }

  const normalizedBase = DEFAULT_API_BASE_URL.endsWith('/')
    ? DEFAULT_API_BASE_URL.slice(0, -1)
    : DEFAULT_API_BASE_URL;

  const normalizedPath = req.url.startsWith('/')
    ? req.url
    : `/${req.url}`;

  const url = `${normalizedBase}${API_PREFIX}${normalizedPath}`;

  return next(req.clone({ url }));
};