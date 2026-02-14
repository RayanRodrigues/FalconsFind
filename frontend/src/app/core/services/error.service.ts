import { Injectable } from '@angular/core';
import { ErrorResponse } from '../../models/responses/error-response.model';

@Injectable({
  providedIn: 'root'
})
export class ErrorService {
  
  getUserFriendlyMessage(error: ErrorResponse): string {
    const errorCode = error.error?.code;
    
    const errorMessages: Record<string, string> = {
      'VALIDATION_ERROR': 'Please check your information and try again.',
      'DUPLICATE_REPORT': 'A similar report has already been submitted.',
      'RATE_LIMIT': 'Too many attempts. Please wait a few minutes and try again.',
      'SERVER_ERROR': 'Server error. Please try again later.',
      'NETWORK_ERROR': 'Network error. Please check your connection.',
      'FORBIDDEN': 'You are not allowed to perform this action.',
      'NOT_FOUND': 'The requested resource was not found.',
      'UNKNOWN_ERROR': 'An unexpected error occurred. Please try again.'
    };

    return errorMessages[errorCode] || error.error?.message || 'An error occurred. Please try again.';
  }
}
