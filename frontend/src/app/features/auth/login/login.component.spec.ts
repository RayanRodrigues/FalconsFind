import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/services/auth.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let authService: Pick<AuthService, 'login'>;
  let router: Router;

  beforeEach(async () => {
    authService = {
      login: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('submits login credentials and redirects staff users to the admin dashboard', async () => {
    (authService.login as ReturnType<typeof vi.fn>).mockReturnValue(of({
      idToken: 'id-token',
      refreshToken: 'refresh-token',
      expiresIn: 3600,
      user: {
        uid: 'uid-123',
        email: 'security@fanshawe.ca',
        role: 'SECURITY',
      },
    }));

    component.form.patchValue({
      email: 'security@fanshawe.ca',
      password: 'secret',
    });

    component.submit();
    await Promise.resolve();

    expect(authService.login).toHaveBeenCalledWith({
      email: 'security@fanshawe.ca',
      password: 'secret',
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/dashboard');
  });

  it('redirects student users to the student-safe default destination', async () => {
    (authService.login as ReturnType<typeof vi.fn>).mockReturnValue(of({
      idToken: 'student-token',
      refreshToken: 'student-refresh-token',
      expiresIn: 3600,
      user: {
        uid: 'student-123',
        email: 'student@fanshaweonline.ca',
        displayName: 'Student Example',
        role: 'STUDENT',
        trusted: true,
      },
    }));

    component.form.patchValue({
      email: 'student@fanshaweonline.ca',
      password: 'secret',
    });

    component.submit();
    await Promise.resolve();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/claim-request');
  });

  it('shows a friendly message when credentials are invalid', async () => {
    (authService.login as ReturnType<typeof vi.fn>).mockReturnValue(throwError(() => ({
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      },
    })));

    component.form.patchValue({
      email: 'security@fanshawe.ca',
      password: 'wrong',
    });

    component.submit();
    await Promise.resolve();

    expect(component.errorMessage()).toBe('Invalid email or password.');
  });
});
