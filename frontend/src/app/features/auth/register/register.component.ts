import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { FormFieldComponent } from '../../../shared/components/forms/form-field.component';
import { InputComponent } from '../../../shared/components/forms/input.component';
import type { ErrorResponse, RegisterRequest } from '../../../models';
import { sanitizeStudentReturnUrl } from '../auth-navigation';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent, InputComponent],
  styleUrl: './register.component.css',
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb = new FormBuilder();

  readonly form = this.fb.group({
    displayName: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(100)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    confirmPassword: ['', Validators.required],
  }, { validators: this.passwordMatchValidator });

  readonly showPassword = signal(false);
  readonly showConfirm = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  private passwordMatchValidator(group: import('@angular/forms').AbstractControl) {
    const pw = group.get('password')?.value;
    const confirm = group.get('confirmPassword')?.value;
    return pw && confirm && pw !== confirm ? { passwordMismatch: true } : null;
  }

  get displayNameError(): string | null {
    const ctrl = this.form.get('displayName');
    if (!ctrl?.touched) return null;
    if (ctrl.hasError('required')) return 'Full name is required.';
    if (ctrl.hasError('minlength')) return 'Name must be at least 2 characters.';
    return null;
  }

  get emailError(): string | null {
    const ctrl = this.form.get('email');
    if (!ctrl?.touched) return null;
    if (ctrl.hasError('required')) return 'Email is required.';
    if (ctrl.hasError('email')) return 'Enter a valid email address.';
    return null;
  }

  get passwordError(): string | null {
    const ctrl = this.form.get('password');
    if (!ctrl?.touched) return null;
    if (ctrl.hasError('required')) return 'Password is required.';
    if (ctrl.hasError('minlength')) return 'Password must be at least 8 characters.';
    return null;
  }

  get confirmPasswordError(): string | null {
    const ctrl = this.form.get('confirmPassword');
    if (!ctrl?.touched) return null;
    if (ctrl.hasError('required')) return 'Please confirm your password.';
    if (this.form.hasError('passwordMismatch')) return 'Passwords do not match.';
    return null;
  }

  togglePassword(): void { this.showPassword.update(v => !v); }
  toggleConfirm(): void { this.showConfirm.update(v => !v); }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const payload: RegisterRequest = {
      email: this.form.get('email')?.value ?? '',
      password: this.form.get('password')?.value ?? '',
      displayName: this.form.get('displayName')?.value ?? undefined,
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.register(payload)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          const raw = this.route.snapshot.queryParamMap.get('returnUrl');
          void this.router.navigateByUrl(sanitizeStudentReturnUrl(raw));
        },
        error: (error: ErrorResponse) => this.errorMessage.set(this.mapError(error)),
      });
  }

  private mapError(error: ErrorResponse): string {
    switch (error.error?.code) {
      case 'EMAIL_ALREADY_IN_USE':
        return 'An account with this email already exists.';
      case 'RATE_LIMITED':
        return 'Too many attempts. Please try again later.';
      case 'REGISTRATION_FAILED':
        return 'Registration failed. Please try again.';
      case 'NETWORK_ERROR':
        return 'Network error occurred. Please check your connection.';
      default:
        return 'Unable to create account right now.';
    }
  }
}
