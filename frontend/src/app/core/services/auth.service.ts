import { Injectable, signal } from '@angular/core';
import { tap, finalize } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import type { Observable } from 'rxjs';
import type { LoginRequest, LoginResponse, RegisterRequest } from '../../models';
import { ApiClientService } from '../http/api-client.service';

const AUTH_SESSION_STORAGE_KEY = 'falconfind.auth.session';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  readonly session = signal<LoginResponse | null>(this.readSession());
  private restorePromise: Promise<void> | null = null;

  constructor(private readonly apiClient: ApiClientService) {}

  login(payload: LoginRequest): Observable<LoginResponse> {
    return this.apiClient
      .post<LoginResponse, LoginRequest>('/auth/login', payload)
      .pipe(tap((response) => this.persistSession(response)));
  }

  register(payload: RegisterRequest): Observable<LoginResponse> {
    return this.apiClient
      .post<LoginResponse, RegisterRequest>('/auth/register', payload)
      .pipe(tap((response) => this.persistSession(response)));
  }

  logout(): Observable<void> {
    return this.apiClient.postEmpty('/auth/logout').pipe(
      finalize(() => this.clearSession())
    );
  }

  logoutStudent(): void {
    this.clearSession();
  }

  clearStoredSession(): void {
    this.clearSession();
  }

  getStoredSession(): LoginResponse | null {
    return this.session();
  }

  async restoreSession(): Promise<void> {
    if (this.restorePromise) {
      return this.restorePromise;
    }

    this.restorePromise = this.restoreSessionInternal();
    try {
      await this.restorePromise;
    } finally {
      this.restorePromise = null;
    }
  }

  private async restoreSessionInternal(): Promise<void> {
    const currentSession = this.readSession();
    if (!currentSession?.refreshToken) {
      this.session.set(currentSession);
      return;
    }

    try {
      const refreshedSession = await firstValueFrom(
        this.apiClient.post<LoginResponse, { refreshToken: string }>('/auth/refresh', {
          refreshToken: currentSession.refreshToken,
        }),
      );
      this.persistSession(refreshedSession);
    } catch {
      this.clearSession();
    }
  }

  isAuthenticated(): boolean {
    return this.session() !== null;
  }

  private readSession(): LoginResponse | null {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as LoginResponse;
    } catch {
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }
  }

  private persistSession(response: LoginResponse): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(response));
    this.session.set(response);
  }

  private clearSession(): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    this.session.set(null);
  }
}
