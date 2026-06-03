import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, map, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CreateQuoteRequest, Quote, QuotesResponse } from '../models/quote.model';

@Injectable({ providedIn: 'root' })
export class QuotesService {
  private readonly http = inject(HttpClient);
  private readonly API  = 'http://localhost:5032';

  // ── Race-condition channel ───────────────────────────────────────────────
  // Every call to load() pushes params here. switchMap cancels the previous
  // in-flight HTTP request before subscribing to the new one, so a slow
  // response from an earlier call can never overwrite a later one.
  private readonly load$ = new Subject<{ page: number; size: number }>();

  // ── Public signals ───────────────────────────────────────────────────────
  readonly quotes        = signal<Quote[]>([]);
  readonly loading       = signal(false);
  readonly error         = signal<string | null>(null);
  readonly totalCount    = signal(0);
  readonly selectedQuote = signal<Quote | null>(null);

  constructor() {
    this.load$
      .pipe(
        switchMap(({ page, size }) =>
          this.http.get<QuotesResponse>(
            `${this.API}/api/quotes?page=${page}&size=${size}`
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe({
        next: res => {
          this.quotes.set(res.value);
          this.totalCount.set(res.count);
          this.loading.set(false);

          // ── Stale-detail guard ─────────────────────────────────────────
          // After every refresh the in-memory selectedQuote snapshot may
          // be outdated.  Two cases:
          //   • quote still on this page → replace reference with fresh data
          //     so the detail panel always reflects the latest server values.
          //   • quote absent from this page → clear selection; showing stale
          //     data that the server no longer returns on this page would be
          //     misleading.
          const sel = this.selectedQuote();
          if (sel !== null) {
            const fresh = res.value.find(q => q.id === sel.id);
            this.selectedQuote.set(fresh ?? null);
          }
        },
        error: () => {
          this.error.set('Failed to load quotes. Is the API running on port 5032?');
          this.loading.set(false);
        },
      });
  }

  load(page = 1, size = 10): void {
    this.loading.set(true);
    this.error.set(null);
    this.load$.next({ page, size });
  }

  select(quote: Quote): void {
    this.selectedQuote.set(quote);
  }

  clearSelection(): void {
    this.selectedQuote.set(null);
  }

  /**
   * POST /api/quotes
   * The backend returns the created Quote entity, but callers trigger
   * a list reload via load() rather than parsing the raw entity shape
   * (which differs from the GET DTO — "text" vs "quoteText").
   */
  createQuote(request: CreateQuoteRequest): Observable<void> {
    return this.http
      .post<unknown>(`${this.API}/api/quotes`, request)
      .pipe(map(() => void 0));
  }
}
