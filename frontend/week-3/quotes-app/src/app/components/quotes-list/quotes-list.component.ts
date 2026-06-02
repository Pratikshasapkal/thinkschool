import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnInit,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { QuotesService } from '../../services/quotes.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-quotes-list',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container">
      <header>
        <h1>Quotes</h1>
        <button class="btn-ghost" (click)="auth.logout()">Sign out</button>
      </header>

      <div class="toolbar">
        <input
          [(ngModel)]="searchTerm"
          placeholder="Filter by author…"
          class="search"
        />
        <span class="stats">
          @if (searchTerm()) {
            {{ filteredCount() }} of {{ totalQuotes() }} matching "{{ searchTerm() }}"
          } @else {
            {{ totalQuotes() }} quote{{ totalQuotes() === 1 ? '' : 's' }}
          }
        </span>
      </div>

      @switch (viewState()) {
        @case ('loading') {
          <div class="state-box">Loading quotes…</div>
        }
        @case ('error') {
          <div class="state-box error">{{ svc.error() }}</div>
        }
        @case ('empty') {
          <div class="state-box">
            @if (searchTerm()) {
              No quotes match "{{ searchTerm() }}".
            } @else {
              No quotes found.
            }
          </div>
        }
        @case ('loaded') {
          <ul class="grid">
            @for (quote of filteredQuotes(); track quote.id) {
              <li class="card">
                <p class="text">"{{ quote.quoteText }}"</p>
                <div class="meta">
                  <span class="author">— {{ quote.author }}</span>
                  <span class="date">{{ formatDate(quote.createdAt) }}</span>
                </div>
              </li>
            }
          </ul>
        }
      }
    </div>
  `,
  styles: [`
    .container { max-width: 820px; margin: 0 auto; padding: 1.5rem; font-family: sans-serif; }
    header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
    h1 { margin: 0; font-size: 1.6rem; }
    .btn-ghost {
      padding: .4rem .9rem; cursor: pointer;
      border: 1px solid #d9d9d9; border-radius: 4px; background: white;
    }
    .toolbar { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
    .search {
      flex: 1; padding: .6rem .9rem;
      border: 1px solid #d9d9d9; border-radius: 4px; font-size: 1rem; outline: none;
    }
    .search:focus { border-color: #1890ff; }
    .stats { font-size: .85rem; color: #888; white-space: nowrap; }
    .state-box {
      padding: 3rem 1rem; text-align: center; color: #888;
      background: #fafafa; border-radius: 8px; border: 1px dashed #e0e0e0;
    }
    .state-box.error { color: #ff4d4f; background: #fff2f0; border-color: #ffccc7; }
    .grid { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem; }
    .card {
      background: white; border: 1px solid #f0f0f0; border-radius: 8px;
      padding: 1.25rem 1.5rem; box-shadow: 0 1px 4px rgba(0,0,0,.06);
    }
    .text { margin: 0 0 .75rem; font-size: 1.05rem; line-height: 1.7; color: #222; }
    .meta { display: flex; justify-content: space-between; font-size: .8rem; color: #999; }
    .author { font-weight: 600; color: #555; }
  `]
})
export class QuotesListComponent implements OnInit {
  svc  = inject(QuotesService);
  auth = inject(AuthService);

  // ── signals ───────────────────────────────────────────────────────────────
  searchTerm = signal('');

  // ── computed ──────────────────────────────────────────────────────────────
  filteredQuotes = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    return term
      ? this.svc.quotes().filter(q => q.author.toLowerCase().includes(term))
      : this.svc.quotes();
  });

  totalQuotes   = computed(() => this.svc.quotes().length);
  filteredCount = computed(() => this.filteredQuotes().length);

  viewState = computed<'loading' | 'error' | 'empty' | 'loaded'>(() => {
    if (this.svc.loading()) return 'loading';
    if (this.svc.error())   return 'error';
    if (this.filteredQuotes().length === 0) return 'empty';
    return 'loaded';
  });

  // ── effect ────────────────────────────────────────────────────────────────
  constructor() {
    effect(() => {
      const term = this.searchTerm();
      if (term) {
        console.log(`[QuotesList] filter="${term}" → ${this.filteredCount()}/${this.totalQuotes()}`);
      }
    });
  }

  ngOnInit() {
    this.svc.load();
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }
}
