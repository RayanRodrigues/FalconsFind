import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { UserRole } from '../../models';
import { AuthService } from '../services/auth.service';
import { adminAuthGuard } from './admin-auth.guard';

describe('adminAuthGuard', () => {
  let authService: Pick<AuthService, 'getStoredSession' | 'logout'>;
  let router: Router;

  beforeEach(async () => {
    authService = {
      getStoredSession: vi.fn(),
      logout: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('redirects unauthenticated users to /login', () => {
    (authService.getStoredSession as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() => adminAuthGuard({} as never, {} as never));

    expect(result).toEqual(router.parseUrl('/login'));
  });

  it('allows authenticated staff users', () => {
    (authService.getStoredSession as ReturnType<typeof vi.fn>).mockReturnValue({
      idToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 3600,
      user: {
        uid: 'uid-1',
        email: 'security@fanshawe.ca',
        role: UserRole.SECURITY,
      },
    });

    const result = TestBed.runInInjectionContext(() => adminAuthGuard({} as never, {} as never));

    expect(result).toBe(true);
  });

  it('logs out and redirects users without staff role', () => {
    (authService.getStoredSession as ReturnType<typeof vi.fn>).mockReturnValue({
      idToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 3600,
      user: {
        uid: 'uid-2',
        email: 'student@fanshawe.ca',
        role: 'STUDENT' as unknown as UserRole,
      } as never,
    });

    const result = TestBed.runInInjectionContext(() => adminAuthGuard({} as never, {} as never));

    expect(authService.logout).toHaveBeenCalled();
    expect(result).toEqual(router.parseUrl('/login'));
  });
});
