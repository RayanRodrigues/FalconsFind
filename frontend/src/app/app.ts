import { Component, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, JsonPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import type { ErrorResponse } from './models';
import { NavbarComponent } from './shared/components/layout/navbar.component';
import { FooterComponent } from './shared/components/layout/footer.component';
import { publicEnv } from './config/public-env.generated';

type FirebaseStatus = 'idle' | 'ok' | 'error';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, JsonPipe, NavbarComponent, FooterComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly title = signal('frontend');
  protected readonly showFirebaseHealthTest = signal(false);
  protected readonly firebaseStatus = signal<FirebaseStatus>('idle');
  protected readonly firebaseMessage = signal('Not started');
  protected readonly firebaseDetails = signal<Record<string, unknown> | null>(null);

  async ngOnInit() {
    // Skip Firebase initialization during SSR
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

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
