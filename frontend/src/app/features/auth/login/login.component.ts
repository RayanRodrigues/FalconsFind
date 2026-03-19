import { Component, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { FormFieldComponent } from '../../../shared/components/forms/form-field.component';
import { InputComponent } from '../../../shared/components/forms/input.component';
import type { ErrorResponse, LoginRequest } from '../../../models';
import { resolvePostLoginPath } from '../auth-navigation';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, FormFieldComponent, InputComponent],
  styleUrl: './login.component.css',
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = new FormBuilder();

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  constructor(
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

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
    return null;
  }

  togglePassword(): void {
    this.showPassword.update(v => !v);
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const payload: LoginRequest = {
      email: this.form.get('email')?.value ?? '',
      password: this.form.get('password')?.value ?? '',
    };

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    this.authService.login(payload)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (session) => {
          const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
          void this.router.navigateByUrl(resolvePostLoginPath(session.user.role, returnUrl));
        },
        error: (error: ErrorResponse) => {
          this.errorMessage.set(this.mapLoginError(error));
        },
      });
  }

  private mapLoginError(error: ErrorResponse): string {
    switch (error.error.code) {
      case 'INVALID_CREDENTIALS':
        return 'Invalid email or password.';
      case 'AUTH_LOCKED':
      case 'RATE_LIMITED':
        return error.error.message;
      case 'FORBIDDEN':
        return 'This account is not authorized to sign in here.';
      case 'NETWORK_ERROR':
        return 'Network error occurred. Please check your connection.';
      default:
        return error.error.message || 'Unable to sign in right now.';
    }
  }
}
