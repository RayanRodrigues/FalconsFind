import { Injectable, Renderer2, RendererFactory2, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'falconfind-theme';
  private readonly renderer: Renderer2;

  private readonly _theme = signal<ThemeMode>('light');

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
    const initialTheme = this.readStoredTheme();
    this._theme.set(initialTheme);

    // Apply the theme immediately so CSS variables are already correct on the
    // first browser render after a refresh.
    if (this.document?.body) {
      this.applyTheme(initialTheme);
    }
  }

  initTheme(): void {
    const theme = this.readStoredTheme();
    this._theme.set(theme);
    this.applyTheme(theme);
  }

  toggleTheme(): void {
    this.setTheme(this._theme() === 'light' ? 'dark' : 'light');
  }

  setTheme(theme: ThemeMode): void {
    this._theme.set(theme);

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, theme);
    }

    this.applyTheme(theme);
  }

  getTheme(): ThemeMode {
    return this._theme();
  }

  // Reading this inside a template or computed automatically tracks the signal,
  // so any component calling isDarkMode() in its template will re-render when
  // the theme changes — no manual change detection needed.
  isDarkMode(): boolean {
    return this._theme() === 'dark';
  }

  private readStoredTheme(): ThemeMode {
    if (typeof localStorage === 'undefined') {
      return 'light';
    }

    const saved = localStorage.getItem(this.storageKey) as ThemeMode | null;
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  }

  private applyTheme(theme: ThemeMode): void {
    const body = this.document.body;
    this.renderer.removeClass(body, 'light-theme');
    this.renderer.removeClass(body, 'dark-theme');
    this.renderer.addClass(body, `${theme}-theme`);
  }
}
