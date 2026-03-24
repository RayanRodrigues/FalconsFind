import { Component, signal, PLATFORM_ID, inject, OnInit } from '@angular/core';
import { isPlatformBrowser, JsonPipe, DOCUMENT } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import type { ErrorResponse } from './models';
import { NavbarComponent } from './shared/components/layout/navbar.component';
import { FooterComponent } from './shared/components/layout/footer.component';
import { publicEnv } from './config/public-env.generated';
import { ThemeService } from './core/services/theme.service';

type FirebaseStatus = 'idle' | 'ok' | 'error';

const ROUTES_WITHOUT_SHELL: string[] = ['/login', '/register', '/admin'];

const isShellless = (url: string): boolean =>
  ROUTES_WITHOUT_SHELL.some(r => url === r || url.startsWith(r + '/'));

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, JsonPipe, NavbarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly router = inject(Router);
  private readonly doc = inject(DOCUMENT);
  private readonly themeService = inject(ThemeService);

  readonly showShell = signal(!isShellless(this.doc.location?.pathname ?? '/'));
  protected readonly title = signal('frontend');
  protected readonly showFirebaseHealthTest = signal(false);
  protected readonly firebaseStatus = signal<FirebaseStatus>('idle');
  protected readonly firebaseMessage = signal('Not started');
  protected readonly firebaseDetails = signal<Record<string, unknown> | null>(null);

  async ngOnInit() {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      const url = (e as NavigationEnd).urlAfterRedirects.split('?')[0];
      this.showShell.set(!isShellless(url));
    });

    // Skip browser-only logic during SSR
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    // Initialize saved theme
    this.themeService.initTheme();

    const healthTestEnabled = publicEnv.enableFirebaseHealthTest;
    this.showFirebaseHealthTest.set(healthTestEnabled);
    if (!healthTestEnabled) {
      return;
    }

    try {
      const normalizedBase = publicEnv.apiBaseUrl.endsWith('/')
        ? publicEnv.apiBaseUrl.slice(0, -1)
        : publicEnv.apiBaseUrl;
      const normalizedPrefix = publicEnv.apiPrefix.startsWith('/')
        ? publicEnv.apiPrefix
        : `/${publicEnv.apiPrefix}`;
      const response = await fetch(`${normalizedBase}${normalizedPrefix}/health/firebase`);
      const contentType = response.headers.get('content-type') ?? '';
      const payload = contentType.includes('application/json')
        ? await response.json()
        : { error: { message: await response.text() } };

      if (!response.ok || !payload?.ok) {
        this.firebaseStatus.set('error');
        const errorMessage =
          (payload as ErrorResponse | undefined)?.error?.message ?? 'Health check failed';
        this.firebaseMessage.set(errorMessage);
        return;
      }

      this.firebaseStatus.set('ok');
      this.firebaseMessage.set('Connected (via backend)');
      this.firebaseDetails.set(payload.data ?? null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.firebaseStatus.set('error');
      this.firebaseMessage.set(message);
    }
  }
}