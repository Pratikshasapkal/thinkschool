import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuotesService } from '../../services/quotes.service';
import { AuthService } from '../../services/auth.service';
import { Quote } from '../../models/quote.model';
import { CreateQuoteComponent } from './create-quote/create-quote.component';

@Component({
  selector: 'app-quotes-list',
  standalone: true,
  imports: [FormsModule, CreateQuoteComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">

      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <header class="top-bar">
        <h1 class="logo">Quotes</h1>
        <button class="btn-ghost" (click)="auth.logout()">Sign out</button>
      </header>

      <!-- ── Toolbar ─────────────────────────────────────────────────────── -->
      <div class="toolbar">
        <input
          [(ngModel)]="searchTerm"
          placeholder="Filter by author…"
          class="search"
          aria-label="Filter quotes by author"
        />
        <span class="stats" aria-live="polite">
          @if (searchTerm()) {
            {{ filteredCount() }} of {{ quoteCount() }}
            matching "{{ searchTerm() }}"
          } @else {
            {{ quoteCount() }} quote{{ quoteCount() === 1 ? '' : 's' }}
          }
        </span>
        <button
          class="btn-refresh"
          title="Refresh"
          aria-label="Refresh quotes"
          [disabled]="svc.loading()"
          (click)="refresh()"
        >↺</button>

        <button
          class="btn-new"
          [class.btn-new-active]="showCreateForm()"
          [attr.aria-expanded]="showCreateForm()"
          aria-controls="create-quote-region"
          (click)="toggleCreateForm()"
        >{{ showCreateForm() ? '✕ Cancel' : '+ New Quote' }}</button>
      </div>

      <!-- ── Create Quote form (toggled) ──────────────────────────────────── -->
      <div id="create-quote-region">
        @if (showCreateForm()) {
          <app-create-quote
            (created)="onQuoteCreated()"
            (cancelled)="showCreateForm.set(false)"
          />
        }
      </div>

      <!-- ── Master / Detail grid ─────────────────────────────────────────── -->
      <div class="master-detail">

        <!-- LIST panel -->
        <section class="list-panel" aria-label="Quotes list">
          @switch (viewState()) {

            @case ('loading') {
              <div class="state-box" role="status">
                <div class="spinner" aria-hidden="true"></div>
                <p>Loading quotes…</p>
              </div>
            }

            @case ('error') {
              <div class="state-box state-error" role="alert">
                <p class="state-title">Could not load quotes</p>
                <p class="state-msg">{{ svc.error() }}</p>
                <button class="btn-retry" (click)="refresh()">Try again</button>
              </div>
            }

            @case ('empty') {
              <div class="state-box" role="status">
                @if (searchTerm()) {
                  No quotes by "{{ searchTerm() }}" on this page.
                } @else {
                  No quotes found.
                }
              </div>
            }

            @case ('loaded') {
              <ul class="quote-list" role="listbox" aria-label="Quotes">
                @for (quote of filteredQuotes(); track quote.id) {
                  <li
                    class="quote-row"
                    [class.active]="selectedId() === quote.id"
                    role="option"
                    [attr.aria-selected]="selectedId() === quote.id"
                    tabindex="0"
                    (click)="select(quote)"
                    (keyup.enter)="select(quote)"
                    (keyup.space)="select(quote)"
                  >
                    <p class="row-text">"{{ quote.quoteText }}"</p>
                    <span class="row-author">— {{ quote.author }}</span>
                  </li>
                }
              </ul>
            }

          }
        </section>

        <!-- DETAIL panel -->
        <section
          class="detail-panel"
          [class.has-content]="hasSelection()"
          aria-label="Quote detail"
        >
          <!--
            @if … as q  provides a locally-typed alias so we never need the
            non-null assertion operator (!) — strict-templates stays happy.
          -->
          @if (svc.selectedQuote(); as q) {
            <article class="detail-card">
              <button
                class="btn-close"
                aria-label="Close detail"
                (click)="clearSelection()"
              >✕</button>

              <blockquote class="detail-quote">
                "{{ q.quoteText }}"
              </blockquote>

              <footer class="detail-footer">
                <span class="detail-author">— {{ q.author }}</span>
                <span class="detail-date">{{ formatDate(q.createdAt) }}</span>
              </footer>

              <div class="detail-id">Quote #{{ q.id }}</div>
            </article>
          } @else {
            <div class="detail-hint">
              <span class="hint-arrow">←</span>
              <p>Select a quote to see details</p>
            </div>
          }
        </section>

      </div><!-- /master-detail -->
    </div><!-- /shell -->
  `,
  styles: [`
    /* ── Layout shell ──────────────────────────────────────────────────── */
    .shell {
      max-width: 1100px;
      margin: 0 auto;
      padding: 1.5rem 1rem;
      font-family: sans-serif;
    }

    /* ── Top bar ───────────────────────────────────────────────────────── */
    .top-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.5rem;
    }
    .logo { margin: 0; font-size: 1.7rem; font-weight: 700; }

    /* ── Buttons ───────────────────────────────────────────────────────── */
    .btn-ghost {
      padding: .4rem .9rem;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: .9rem;
    }
    .btn-ghost:hover { border-color: #aaa; }

    .btn-refresh {
      padding: .4rem .65rem;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      background: white;
      cursor: pointer;
      font-size: 1.1rem;
      line-height: 1;
    }
    .btn-refresh:disabled { opacity: .35; cursor: not-allowed; }
    .btn-refresh:not(:disabled):hover { border-color: #1890ff; color: #1890ff; }

    .btn-new {
      padding: .4rem .9rem;
      border: 1px solid #1890ff;
      border-radius: 4px;
      background: white;
      color: #1890ff;
      cursor: pointer;
      font-size: .875rem;
      white-space: nowrap;
    }
    .btn-new:hover      { background: #e6f4ff; }
    .btn-new-active     { background: #fff2f0; border-color: #ff4d4f; color: #ff4d4f; }
    .btn-new-active:hover { background: #fff2f0; }

    .btn-retry {
      padding: .45rem 1.2rem;
      background: white;
      border: 1px solid #ff4d4f;
      border-radius: 4px;
      color: #ff4d4f;
      cursor: pointer;
      font-size: .875rem;
    }
    .btn-retry:hover { background: #fff2f0; }

    /* ── Toolbar ───────────────────────────────────────────────────────── */
    .toolbar {
      display: flex;
      align-items: center;
      gap: .75rem;
      margin-bottom: 1.25rem;
    }
    .search {
      flex: 1;
      padding: .6rem .9rem;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: 1rem;
      outline: none;
    }
    .search:focus { border-color: #1890ff; }
    .stats { font-size: .83rem; color: #888; white-space: nowrap; }

    /* ── Master-detail grid ────────────────────────────────────────────── */
    .master-detail {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
      align-items: start;
    }

    /* ── List panel ────────────────────────────────────────────────────── */
    .list-panel { min-height: 420px; }

    .quote-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: .5rem;
    }

    .quote-row {
      background: white;
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      padding: 1rem 1.25rem;
      cursor: pointer;
      outline: none;
      transition: border-color .12s, background .12s;
    }
    .quote-row:hover            { border-color: #91caff; }
    .quote-row:focus-visible    { box-shadow: 0 0 0 2px #1890ff50; border-color: #1890ff; }
    .quote-row.active           { border-color: #1890ff; background: #e6f4ff; }

    .row-text {
      margin: 0 0 .35rem;
      font-size: .95rem;
      color: #333;
      line-height: 1.55;
      /* Clamp long quotes in the list to 2 lines */
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .row-author { font-size: .78rem; color: #aaa; font-style: italic; }

    /* ── State boxes (loading / error / empty) ─────────────────────────── */
    .state-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .75rem;
      min-height: 280px;
      border-radius: 8px;
      border: 1px dashed #e0e0e0;
      background: #fafafa;
      color: #999;
      text-align: center;
      padding: 2rem;
    }
    .state-error {
      background: #fff2f0;
      border-color: #ffccc7;
      color: #cf1322;
    }
    .state-title { margin: 0; font-weight: 600; font-size: .95rem; }
    .state-msg   { margin: 0; font-size: .85rem; }

    /* ── Spinner ────────────────────────────────────────────────────────── */
    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid #e6e6e6;
      border-top-color: #1890ff;
      border-radius: 50%;
      animation: spin .65s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Detail panel ───────────────────────────────────────────────────── */
    .detail-panel {
      position: sticky;
      top: 1.5rem;
      min-height: 280px;
      border-radius: 8px;
      border: 1px dashed #e0e0e0;
      background: #fafafa;
      transition: border-color .15s, box-shadow .15s;
      overflow: hidden;
    }
    .detail-panel.has-content {
      border: 1px solid #91caff;
      background: white;
      box-shadow: 0 4px 16px rgba(24, 144, 255, .1);
    }

    .detail-hint {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: .5rem;
      height: 100%;
      min-height: 280px;
      color: #ccc;
    }
    .hint-arrow { font-size: 1.4rem; }
    .detail-hint p { margin: 0; font-size: .9rem; }

    .detail-card { position: relative; padding: 1.75rem 1.5rem 1.25rem; }

    .btn-close {
      position: absolute;
      top: .75rem;
      right: .75rem;
      background: none;
      border: none;
      cursor: pointer;
      font-size: .95rem;
      color: #bbb;
      padding: .2rem .5rem;
      border-radius: 4px;
      line-height: 1;
    }
    .btn-close:hover { color: #555; background: #f5f5f5; }

    .detail-quote {
      margin: 0 0 1.25rem;
      padding-left: 1rem;
      border-left: 3px solid #1890ff;
      font-size: 1.1rem;
      line-height: 1.85;
      color: #1a1a1a;
      font-style: italic;
    }

    .detail-footer {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: .5rem;
      font-size: .85rem;
      margin-bottom: .75rem;
      flex-wrap: wrap;
    }
    .detail-author { font-weight: 700; color: #333; font-style: normal; }
    .detail-date   { color: #aaa; }
    .detail-id     { font-size: .72rem; color: #ccc; }

    /* ── Responsive ─────────────────────────────────────────────────────── */
    @media (max-width: 700px) {
      .master-detail         { grid-template-columns: 1fr; }
      .detail-panel          { position: static; }
    }
  `],
})
export class QuotesListComponent implements OnInit {
  readonly svc  = inject(QuotesService);
  readonly auth = inject(AuthService);

  // ── Component-local signals ──────────────────────────────────────────────
  readonly searchTerm     = signal('');
  readonly showCreateForm = signal(false);

  // ── Derived state (computed) ─────────────────────────────────────────────

  /** Quotes passing the author-filter; all quotes when the filter is empty. */
  readonly filteredQuotes = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    return term
      ? this.svc.quotes().filter(q => q.author.toLowerCase().includes(term))
      : this.svc.quotes();
  });

  /** Number of quotes loaded on the current page. */
  readonly quoteCount    = computed(() => this.svc.quotes().length);

  /** Number of quotes passing the active author filter. */
  readonly filteredCount = computed(() => this.filteredQuotes().length);

  /** True when a quote is selected; drives detail-panel CSS and @if branch. */
  readonly hasSelection  = computed(() => this.svc.selectedQuote() !== null);

  /**
   * ID of the currently selected quote.
   * Computed (not a method) so Angular's signal graph tracks it correctly
   * and only re-evaluates the @for item bindings when selection changes.
   */
  readonly selectedId = computed(() => this.svc.selectedQuote()?.id ?? null);

  /** List-panel state machine — single source of truth for the @switch. */
  readonly viewState = computed<'loading' | 'error' | 'empty' | 'loaded'>(() => {
    if (this.svc.loading()) return 'loading';
    if (this.svc.error())   return 'error';
    if (this.filteredQuotes().length === 0) return 'empty';
    return 'loaded';
  });

  // ── Side effects ─────────────────────────────────────────────────────────
  constructor() {
    // Reactive logging: re-runs whenever searchTerm or filteredCount changes.
    effect(() => {
      const term = this.searchTerm();
      if (term) {
        console.log(
          `[QuotesList] filter="${term}" → ${this.filteredCount()}/${this.quoteCount()}`
        );
      }
    });
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.svc.load();
  }

  // ── Actions ──────────────────────────────────────────────────────────────
  select(quote: Quote): void {
    this.svc.select(quote);
  }

  clearSelection(): void {
    this.svc.clearSelection();
  }

  refresh(): void {
    this.svc.load();
  }

  toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
  }

  onQuoteCreated(): void {
    this.svc.load();           // refresh list with newly-created quote
    // form stays open — user sees the success banner and can add another
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    });
  }
}
