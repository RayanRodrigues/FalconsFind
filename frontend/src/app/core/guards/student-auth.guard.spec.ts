import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { UserRole } from '../../models';
import { AuthService } from '../services/auth.service';
import { authenticatedUserGuard } from './student-auth.guard';

describe('authenticatedUserGuard', () => {
  let authService: Pick<AuthService, 'getStoredSession'>;
  let router: Router;

  beforeEach(async () => {
    authService = {
      getStoredSession: vi.fn(),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('redirects unauthenticated users to login with a returnUrl', () => {
    (authService.getStoredSession as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const result = TestBed.runInInjectionContext(() =>
      authenticatedUserGuard({ url: [{ path: 'claim-request' }] } as never, {} as never)
    );

    expect(result).toEqual(router.parseUrl('/login?returnUrl=/claim-request'));
  });

  it('allows authenticated students', () => {
    (authService.getStoredSession as ReturnType<typeof vi.fn>).mockReturnValue({
      idToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 3600,
      user: {
        uid: 'uid-1',
        email: 'student@fanshawe.ca',
        role: UserRole.STUDENT,
      },
    });

    const result = TestBed.runInInjectionContext(() =>
      authenticatedUserGuard({ url: [{ path: 'claim-request' }] } as never, {} as never)
    );

    expect(result).toBe(true);
  });

  it('allows authenticated staff users', () => {
    (authService.getStoredSession as ReturnType<typeof vi.fn>).mockReturnValue({
      idToken: 'token',
      refreshToken: 'refresh',
      expiresIn: 3600,
      user: {
        uid: 'uid-2',
        email: 'admin@fanshawe.ca',
        role: UserRole.ADMIN,
      },
    });

    const result = TestBed.runInInjectionContext(() =>
      authenticatedUserGuard({ url: [{ path: 'claim-request' }] } as never, {} as never)
    );

    expect(result).toBe(true);
  });
});
