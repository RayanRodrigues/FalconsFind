import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { UserRole } from '../../models';
import { AuthService } from '../services/auth.service';
import { authenticatedUserGuard } from './student-auth.guard';

describe('authenticatedUserGuard', () => {
  let authService: Pick<AuthService, 'getStoredSession' | 'restoreSession'>;
  let router: Router;

  beforeEach(async () => {
    authService = {
      getStoredSession: vi.fn(),
      restoreSession: vi.fn().mockResolvedValue(undefined),
    };

    await TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: authService },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
  });

  it('redirects unauthenticated users to login with a returnUrl', async () => {
    (authService.getStoredSession as ReturnType<typeof vi.fn>).mockReturnValue(null);

    const result = await TestBed.runInInjectionContext(() =>
      authenticatedUserGuard({ url: [{ path: 'claim-request' }] } as never, {} as never)
    );

    expect(result).toEqual(router.parseUrl('/login?returnUrl=/claim-request'));
  });

  it('allows authenticated students', async () => {
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

    const result = await TestBed.runInInjectionContext(() =>
      authenticatedUserGuard({ url: [{ path: 'claim-request' }] } as never, {} as never)
    );

    expect(result).toBe(true);
  });

  it('allows authenticated staff users', async () => {
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

    const result = await TestBed.runInInjectionContext(() =>
      authenticatedUserGuard({ url: [{ path: 'claim-request' }] } as never, {} as never)
    );

    expect(result).toBe(true);
  });
});
