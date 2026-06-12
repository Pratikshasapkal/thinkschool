import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { QuotesService } from '../../services/quotes.service';
import { Quote } from '../../models/quote.model';
import { AppError } from '../../models/app-error.model';

type DetailState = 'loading' | 'loaded' | 'not-found' | 'unauthorized' | 'error';

@Component({
  selector: 'app-quote-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">

      <header class="top-bar">
        <a routerLink="/quotes" class="btn-back">← All quotes</a>
        <span class="crumb">Quote #{{ quoteId() }}</span>
      </header>

      <!--
        The article is always rendered with view-transition-name so Angular's
        withViewTransitions() can morph the list row into this card.
        State-specific content renders inside via @switch.
      -->
      <article
        class="detail-card"
        [class.detail-card--state]="state() !== 'loaded'"
        [style.view-transition-name]="'quote-' + quoteId()"
        role="main"
      >
        @switch (state()) {

          @case ('loading') {
            <div class="state-inner" role="status">
              <div class="spinner" aria-hidden="true"></div>
              <p>Loading quote…</p>
            </div>
          }

          @case ('not-found') {
            <div class="state-inner state-error" role="alert">
              <p class="state-title">Quote not found</p>
              <p class="state-msg">No quote with id {{ quoteId() }} exists.</p>
              <a routerLink="/quotes" class="btn-action">Back to list</a>
            </div>
          }

          @case ('unauthorized') {
            <div class="state-inner state-error" role="alert">
              <p class="state-title">Unauthorized</p>
              <p class="state-msg">You must be signed in to view this quote.</p>
              <a routerLink="/login" class="btn-action">Sign in</a>
            </div>
          }

          @case ('error') {
            <div class="state-inner state-error" role="alert">
              <p class="state-title">Could not load quote</p>
              <p class="state-msg">{{ errorMessage() }}</p>
              <button class="btn-action btn-retry" (click)="load()">Try again</button>
            </div>
          }

          @case ('loaded') {
            @if (quote(); as q) {
              <blockquote class="detail-quote">"{{ q.text }}"</blockquote>
              <footer class="detail-footer">
                <span class="detail-author">— {{ q.author }}</span>
                <span class="detail-date">{{ formatDate(q.createdAt) }}</span>
              </footer>
              <div class="detail-id">Quote #{{ q.id }}</div>
            }
          }

        }
      </article>

    </div>
  `,
  styles: [`
    .shell {
      max-width: 720px;
      margin: 0 auto;
      padding: 1.5rem 1rem;
      font-family: sans-serif;
    }

    /* ── Header ──────────────────────────────────────────────────────── */
    .top-bar {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1.75rem;
    }
    .btn-back {
      padding: .4rem .9rem;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      background: white;
      font-size: .9rem;
      color: #333;
      text-decoration: none;
    }
    .btn-back:hover { border-color: #aaa; }
    .crumb { font-size: .85rem; color: #595959; }

    /* ── Detail card ─────────────────────────────────────────────────── */
    .detail-card {
      background: white;
      border: 1px solid #91caff;
      border-radius: 8px;
      padding: 2rem 2rem 1.5rem;
      box-shadow: 0 4px 16px rgba(24, 144, 255, .1);
      min-height: 180px;
    }

    /* When showing a state (loading / error / not-found) centre the content */
    .detail-card--state {
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
      border: 1px dashed #e0e0e0;
      box-shadow: none;
    }

    /* ── State inner ─────────────────────────────────────────────────── */
    .state-inner {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: .75rem;
      padding: 2rem;
      text-align: center;
      color: #595959;
    }
    .state-error { color: #cf1322; }
    .state-title { margin: 0; font-weight: 600; font-size: .95rem; }
    .state-msg   { margin: 0; font-size: .85rem; }

    /* ── Spinner ─────────────────────────────────────────────────────── */
    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid #e6e6e6;
      border-top-color: #0052cc;
      border-radius: 50%;
      animation: spin .65s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Action buttons inside state ─────────────────────────────────── */
    .btn-action {
      padding: .45rem 1.2rem;
      background: white;
      border: 1px solid #0052cc;
      border-radius: 4px;
      color: #0052cc;
      text-decoration: none;
      font-size: .875rem;
      cursor: pointer;
    }
    .btn-action:hover { background: #e6f4ff; }
    .btn-retry {
      border-color: #ff4d4f;
      color: #ff4d4f;
    }
    .btn-retry:hover { background: #fff2f0; }

    /* ── Quote content ───────────────────────────────────────────────── */
    .detail-quote {
      margin: 0 0 1.5rem;
      padding-left: 1rem;
      border-left: 3px solid #0052cc;
      font-size: 1.2rem;
      line-height: 1.85;
      color: #1a1a1a;
      font-style: italic;
    }
    .detail-footer {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: .5rem;
      font-size: .9rem;
      margin-bottom: .75rem;
      flex-wrap: wrap;
    }
    .detail-author { font-weight: 700; color: #333; font-style: normal; }
    .detail-date   { color: #595959; }
    .detail-id     { font-size: .75rem; color: #595959; }
  `],
})
export class QuoteDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly svc   = inject(QuotesService);

  readonly quoteId      = signal(0);
  readonly quote        = signal<Quote | null>(null);
  readonly state        = signal<DetailState>('loading');
  readonly errorMessage = signal('');

  ngOnInit(): void {
    const raw = this.route.snapshot.paramMap.get('id') ?? '';
    this.quoteId.set(Number(raw));
    this.load();
  }

  load(): void {
    this.state.set('loading');
    this.errorMessage.set('');

    this.svc.getById(this.quoteId()).subscribe({
      next: (q) => {
        this.quote.set(q);
        this.state.set('loaded');
      },
      error: (err: AppError) => {
        switch (err.kind) {
          case 'not-found':
            this.state.set('not-found');
            break;
          case 'authorization':
            this.state.set('unauthorized');
            break;
          default:
            this.errorMessage.set(err.message || 'An unexpected error occurred.');
            this.state.set('error');
        }
      },
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }
}
