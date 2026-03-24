import { Injectable, Renderer2, RendererFactory2, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storageKey = 'falconfind-theme';

  private renderer: Renderer2;
  private currentTheme: ThemeMode = 'light';

  constructor(rendererFactory: RendererFactory2) {
    this.renderer = rendererFactory.createRenderer(null, null);
  }

  initTheme(): void {
    if (typeof localStorage === 'undefined') {
      this.applyTheme('light');
      return;
    }

    const savedTheme = localStorage.getItem(this.storageKey) as ThemeMode | null;

    if (savedTheme === 'dark' || savedTheme === 'light') {
      this.currentTheme = savedTheme;
    } else {
      this.currentTheme = 'light';
    }

    this.applyTheme(this.currentTheme);
  }

  toggleTheme(): void {
    const nextTheme: ThemeMode = this.currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(nextTheme);
  }

  setTheme(theme: ThemeMode): void {
    this.currentTheme = theme;

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(this.storageKey, theme);
    }

    this.applyTheme(theme);
  }

  getTheme(): ThemeMode {
    return this.currentTheme;
  }

  isDarkMode(): boolean {
    return this.currentTheme === 'dark';
  }

  private applyTheme(theme: ThemeMode): void {
    const body = this.document.body;

    this.renderer.removeClass(body, 'light-theme');
    this.renderer.removeClass(body, 'dark-theme');
    this.renderer.addClass(body, `${theme}-theme`);
  }
}