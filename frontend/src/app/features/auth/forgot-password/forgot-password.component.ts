import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import type { ErrorResponse } from '../../../models';
import { AuthService } from '../../../core/services/auth.service';
import { FormFieldComponent } from '../../../shared/components/forms/form-field.component';
import { InputComponent } from '../../../shared/components/forms/input.component';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent, InputComponent],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.css',
})
export class ForgotPasswordComponent {
  private readonly fb = new FormBuilder();

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  constructor(private readonly authService: AuthService) {}

  get emailError(): string | null {
    const ctrl = this.form.get('email');
    if (!ctrl?.touched) return null;
    if (ctrl.hasError('required')) return 'Email is required.';
    if (ctrl.hasError('email')) return 'Enter a valid email address.';
    return null;
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const email = this.form.get('email')?.value?.trim() ?? '';

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    this.authService.forgotPassword({ email })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (response) => {
          this.successMessage.set(response.message);
        },
        error: (error: ErrorResponse) => {
          this.errorMessage.set(this.mapError(error));
        },
      });
  }

  private mapError(error: ErrorResponse): string {
    switch (error.error?.code) {
      case 'RATE_LIMITED':
        return error.error.message;
      case 'BAD_REQUEST':
        return error.error.message;
      case 'AUTH_PROVIDER_UNAVAILABLE':
        return 'Password reset is temporarily unavailable. Please try again later.';
      case 'NETWORK_ERROR':
        return 'Network error occurred. Please check your connection.';
      default:
        return error.error?.message || 'Unable to send reset instructions right now.';
    }
  }
}
