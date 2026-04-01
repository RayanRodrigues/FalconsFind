import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ForgotPasswordComponent } from './forgot-password.component';

describe('ForgotPasswordComponent', () => {
  let component: ForgotPasswordComponent;
  let authService: Pick<AuthService, 'forgotPassword'>;

  beforeEach(async () => {
    authService = {
      forgotPassword: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [ForgotPasswordComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ForgotPasswordComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('submits the email and shows the success message', async () => {
    (authService.forgotPassword as ReturnType<typeof vi.fn>).mockReturnValue(of({
      message: 'If an account exists for this email, a password reset link has been sent.',
    }));

    component.form.patchValue({ email: 'student@example.com' });
    component.submit();
    await Promise.resolve();

    expect(authService.forgotPassword).toHaveBeenCalledWith({ email: 'student@example.com' });
    expect(component.successMessage()).toBe('If an account exists for this email, a password reset link has been sent.');
  });

  it('shows a friendly rate limit error', async () => {
    (authService.forgotPassword as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many password reset attempts. Please try again later.',
      },
    })));

    component.form.patchValue({ email: 'student@example.com' });
    component.submit();
    await Promise.resolve();

    expect(component.errorMessage()).toBe('Too many password reset attempts. Please try again later.');
  });

  it('falls back to the backend message when the code is unknown', async () => {
    (authService.forgotPassword as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Password reset provider is unavailable (OPERATION_NOT_ALLOWED).',
      },
    })));

    component.form.patchValue({ email: 'student@example.com' });
    component.submit();
    await Promise.resolve();

    expect(component.errorMessage()).toBe('Password reset provider is unavailable (OPERATION_NOT_ALLOWED).');
  });
});
