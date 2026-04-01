import type { Observable } from 'rxjs';
import { shareReplay, tap } from 'rxjs';

type CacheEntry<T> = {
  expiresAt: number;
  stream: Observable<T>;
};

export class ObservableCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly ttlMs: number) {}

  getOrCreate<T>(key: string, factory: () => Observable<T>): Observable<T> {
    const now = Date.now();
    const cached = this.store.get(key) as CacheEntry<T> | undefined;

    if (cached && cached.expiresAt > now) {
      return cached.stream;
    }

    const stream = factory().pipe(
      tap({
        error: () => {
          this.store.delete(key);
        },
      }),
      shareReplay(1),
    );

    this.store.set(key, {
      expiresAt: now + this.ttlMs,
      stream,
    });

    return stream;
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
