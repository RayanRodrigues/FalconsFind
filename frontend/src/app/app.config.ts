import {
  APP_INITIALIZER,
  ApplicationConfig,
  PLATFORM_ID,
  inject,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { apiBaseUrlInterceptor } from './core/http/interceptors/api-base-url.interceptor';
import { apiErrorInterceptor } from './core/http/interceptors/api-error.interceptor';
import { inject as injectAnalytics } from '@vercel/analytics';

function initAnalytics() {
  const platformId = inject(PLATFORM_ID);
  return () => {
    if (isPlatformBrowser(platformId)) {
      injectAnalytics();
    }
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(withFetch(), withInterceptors([apiBaseUrlInterceptor, apiErrorInterceptor])),
    { provide: APP_INITIALIZER, useFactory: initAnalytics, multi: true },
  ],
};
