import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import type { ErrorResponse } from '../../../models/responses/error-response.model';
import { AuthService } from '../../services/auth.service';

const defaultErrorResponse = (code: string, message: string): ErrorResponse => ({
  error: { code, message }
});

const SESSION_ERROR_CODES = new Set([
  'AUTH_TOKEN_REVOKED',
  'INVALID_AUTH_TOKEN',
  'AUTHENTICATION_REQUIRED',
]);

const isPublicAuthRoute = (url: string): boolean =>
  url.startsWith('/login') || url.startsWith('/register');

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() => defaultErrorResponse('UNKNOWN_ERROR', 'An unexpected error occurred.'));
      }

      if (error.status === 0) {
        return throwError(() =>
          defaultErrorResponse('NETWORK_ERROR', 'Network error occurred. Please check your connection.')
        );
      }

      const apiError = error.error as Partial<ErrorResponse> | null;
      if (apiError?.error?.code && apiError.error.message) {
        if (SESSION_ERROR_CODES.has(apiError.error.code)) {
          authService.clearStoredSession();

          const currentUrl = router.url || '/';
          if (!isPublicAuthRoute(currentUrl)) {
            const targetUrl = currentUrl !== '/' ? `/login?returnUrl=${encodeURIComponent(currentUrl)}` : '/login';
            void router.navigateByUrl(targetUrl);
          }
        }

        return throwError(() => apiError as ErrorResponse);
      }

      return throwError(() =>
        defaultErrorResponse(
          'UNKNOWN_ERROR',
          typeof error.error === 'string' ? error.error : 'An unexpected error occurred. Please try again.'
        )
      );
    })
  );
};
