import { Component, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, JsonPipe } from '@angular/common';
import { RouterOutlet } from '@angular/router';

type FirebaseStatus = 'idle' | 'ok' | 'error';

type FrontendEnv = {
  API_BASE_URL?: string;
};

declare global {
  interface Window {
    __env?: FrontendEnv;
  }
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, JsonPipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private readonly platformId = inject(PLATFORM_ID);
  protected readonly title = signal('frontend');
  protected readonly firebaseStatus = signal<FirebaseStatus>('idle');
  protected readonly firebaseMessage = signal('Not started');
  protected readonly firebaseDetails = signal<Record<string, unknown> | null>(null);

  async ngOnInit() {
    // Skip Firebase initialization during SSR
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const baseUrl = window.__env?.API_BASE_URL ?? 'http://localhost:3000';
      const response = await fetch(`${baseUrl}/health/firebase`);
      const payload = await response.json();
      if (!response.ok || !payload?.ok) {
        this.firebaseStatus.set('error');
        this.firebaseMessage.set(payload?.error ?? 'Health check failed');
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
