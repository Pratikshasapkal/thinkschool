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
import { Router, RouterLink } from '@angular/router';
import { QuotesService } from '../../services/quotes.service';
import { AuthService } from '../../services/auth.service';
import { CreateQuoteComponent } from './create-quote/create-quote.component';

@Component({
  selector: 'app-quotes-list',
  standalone: true,
  imports: [FormsModule, CreateQuoteComponent, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">

      <!-- ── Header ──────────────────────────────────────────────────────── -->
      <header class="top-bar">
        <h1 class="logo">Quotes</h1>
        <button class="btn-ghost" (click)="signOut()">Sign out</button>
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

      <!-- ── Quotes list ───────────────────────────────────────────────────── -->
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
            <ul class="quote-list" aria-label="Quotes">
              @for (quote of filteredQuotes(); track quote.id) {
                <!--
                  [routerLink] navigates to GET /api/quotes/{id}.
                  [style.view-transition-name] assigns a unique name per quote so
                  Angular's withViewTransitions() can morph this row into the
                  detail card when navigating to /quotes/:id.
                -->
                <li
                  class="quote-row"
                  tabindex="0"
                  [routerLink]="['/quotes', quote.id]"
                  [style.view-transition-name]="'quote-' + quote.id"
                >
                  <p class="row-text">"{{ quote.quoteText }}"</p>
                  <span class="row-author">— {{ quote.author }}</span>
                </li>
              }
            </ul>
          }

        }
      </section>

    </div><!-- /shell -->
  `,
  styles: [`
    /* ── Layout shell ──────────────────────────────────────────────────── */
    .shell {
      max-width: 720px;
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
    .btn-new:hover        { background: #e6f4ff; }
    .btn-new-active       { background: #fff2f0; border-color: #ff4d4f; color: #ff4d4f; }
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
    .quote-row:hover         { border-color: #91caff; }
    .quote-row:focus-visible { box-shadow: 0 0 0 2px #1890ff50; border-color: #1890ff; }

    .row-text {
      margin: 0 0 .35rem;
      font-size: .95rem;
      color: #333;
      line-height: 1.55;
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
  `],
})
export class QuotesListComponent implements OnInit {
  readonly svc    = inject(QuotesService);
  readonly auth   = inject(AuthService);
  private  router = inject(Router);

  // ── Component-local signals ──────────────────────────────────────────────
  readonly searchTerm     = signal('');
  readonly showCreateForm = signal(false);

  // ── Derived state (computed) ─────────────────────────────────────────────

  readonly filteredQuotes = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    return term
      ? this.svc.quotes().filter(q => q.author.toLowerCase().includes(term))
      : this.svc.quotes();
  });

  readonly quoteCount    = computed(() => this.svc.quotes().length);
  readonly filteredCount = computed(() => this.filteredQuotes().length);

  readonly viewState = computed<'loading' | 'error' | 'empty' | 'loaded'>(() => {
    if (this.svc.loading()) return 'loading';
    if (this.svc.error())   return 'error';
    if (this.filteredQuotes().length === 0) return 'empty';
    return 'loaded';
  });

  // ── Side effects ─────────────────────────────────────────────────────────
  constructor() {
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
  signOut(): void {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  refresh(): void {
    this.svc.load();
  }

  toggleCreateForm(): void {
    this.showCreateForm.update(v => !v);
  }

  onQuoteCreated(): void {
    this.svc.load();
  }
}
