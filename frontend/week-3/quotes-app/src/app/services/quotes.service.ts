import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Quote, QuotesResponse } from '../models/quote.model';

@Injectable({ providedIn: 'root' })
export class QuotesService {
  private http = inject(HttpClient);
  private readonly API = 'http://localhost:5032';

  quotes = signal<Quote[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  totalCount = signal(0);

  load(page = 1, size = 10) {
    this.loading.set(true);
    this.error.set(null);

    this.http
      .get<QuotesResponse>(`${this.API}/api/quotes?page=${page}&size=${size}`)
      .subscribe({
        next: res => {
          this.quotes.set(res.value);
          this.totalCount.set(res.count);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('Failed to load quotes. Is the API running on port 5032?');
          this.loading.set(false);
        }
      });
  }
}
