import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import type { ErrorResponse } from '../../../models/responses/error-response.model';

const defaultErrorResponse = (code: string, message: string): ErrorResponse => ({
  error: { code, message }
});

export const apiErrorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
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
