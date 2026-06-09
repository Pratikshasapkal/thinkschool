import {
  ChangeDetectionStrategy,
  Component,
  inject,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
  form,
  FormField,
  FormRoot,
  maxLength,
  required,
} from '@angular/forms/signals';
import { QuotesService } from '../../../services/quotes.service';

/**
 * Design decisions — Signal Forms edition
 * ─────────────────────────────────────────
 * @angular/forms/signals is EXPERIMENTAL in Angular 21. The API may change.
 *
 * form() + [formRoot] replace FormBuilder + ReactiveFormsModule.
 *   [formRoot] marks all fields as touched on submit, validates, and only
 *   calls the action if the form is valid — no manual wasSubmitted signal
 *   or markAllAsTouched() call required.
 *
 * submission.action replaces the subscribe({ next, error }) block.
 *   Returning { kind, message } surfaces the error through quoteForm().errors().
 *   Returning nothing (undefined) signals success.
 *
 * model signal is the source of truth. Resetting it clears field values.
 *   KNOWN LIMITATION: Signal Forms (experimental) has no reset() API for
 *   touched/dirty metadata. After model.set({…}), fields are empty but
 *   still touched, so Required errors flash briefly. The succeeded banner
 *   draws attention away from this. A stable reset API is expected once
 *   Signal Forms graduates from experimental.
 *
 * aria-invalid / aria-describedby are wired manually — [formField] handles
 *   value sync and name attributes but does NOT apply ARIA attributes.
 *
 * No @ViewChild focus management — Signal Forms does not provide
 *   focusFirstInvalid() behaviour. This is a missing feature vs Reactive Forms.
 *
 * output<void>() — modern Angular signals-based outputs, no EventEmitter.
 *
 * Character counters read this.model() directly (the source of truth signal)
 *   rather than going through the FieldTree, which avoids a circular call chain.
 */

interface QuoteFormModel {
  author: string;
  text: string;
}

@Component({
  selector: 'app-create-quote',
  standalone: true,
  imports: [FormField, FormRoot],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="panel" role="region" aria-labelledby="cq-title">

      <!-- Header -->
      <div class="panel-header">
        <h2 id="cq-title" class="panel-title">New Quote</h2>
        <button
          type="button"
          class="btn-icon"
          aria-label="Close new quote form"
          (click)="onCancel()"
        >✕</button>
      </div>

      <!-- Success banner -->
      @if (succeeded()) {
        <div class="banner banner-success" role="status" aria-live="polite">
          <span aria-hidden="true">✓</span>
          Quote created. Fill in the form to add another.
        </div>
      }

      <!-- Server-error banner -->
      @let serverErr = serverError();
      @if (serverErr) {
        <div class="banner banner-error" role="alert">
          {{ serverErr }}
        </div>
      }

      <!--
        [formRoot] wires the form to Signal Forms:
          - intercepts the native submit event
          - marks all fields as touched (showing all errors at once)
          - validates; calls the action ONLY if the form is valid
        novalidate suppresses the browser's own validation UI.
      -->
      <form
        [formRoot]="quoteForm"
        novalidate
        aria-label="Create quote"
      >

        <!-- ── Author ── -->
        @let authorState = quoteForm.author();
        @let authorInvalid = authorState.invalid() && authorState.touched();
        <div class="field" [class.field-error-active]="authorInvalid">
          <label for="cq-author" class="field-label">
            Author
            <span class="required-mark" aria-hidden="true">*</span>
          </label>

          <input
            id="cq-author"
            type="text"
            [formField]="quoteForm.author"
            class="field-input"
            autocomplete="off"
            [attr.aria-invalid]="authorInvalid ? 'true' : 'false'"
            aria-describedby="cq-author-err cq-author-hint"
          />

          <div class="field-foot">
            <!-- Always in DOM so aria-describedby association is never broken -->
            <p id="cq-author-err" class="field-err-msg" aria-live="polite">
              @if (authorInvalid) {
                {{ authorState.errors().at(0)?.message }}
              }
            </p>
            <span
              id="cq-author-hint"
              class="char-count"
              [class.char-count-warn]="model().author.length > 180"
              aria-hidden="true"
            >{{ model().author.length }}&thinsp;/&thinsp;200</span>
          </div>
        </div>

        <!-- ── Quote text ── -->
        @let textState = quoteForm.text();
        @let textInvalid = textState.invalid() && textState.touched();
        <div class="field" [class.field-error-active]="textInvalid">
          <label for="cq-text" class="field-label">
            Quote text
            <span class="required-mark" aria-hidden="true">*</span>
          </label>

          <textarea
            id="cq-text"
            [formField]="quoteForm.text"
            class="field-input field-textarea"
            rows="5"
            [attr.aria-invalid]="textInvalid ? 'true' : 'false'"
            aria-describedby="cq-text-err cq-text-hint"
          ></textarea>

          <div class="field-foot">
            <p id="cq-text-err" class="field-err-msg" aria-live="polite">
              @if (textInvalid) {
                {{ textState.errors().at(0)?.message }}
              }
            </p>
            <span
              id="cq-text-hint"
              class="char-count"
              [class.char-count-warn]="model().text.length > 900"
              aria-hidden="true"
            >{{ model().text.length }}&thinsp;/&thinsp;1000</span>
          </div>
        </div>

        <p class="required-note" aria-hidden="true">* Required</p>

        <!-- Actions -->
        <div class="form-actions">
          <button
            type="button"
            class="btn btn-secondary"
            (click)="onCancel()"
          >Cancel</button>

          <!--
            quoteForm().submitting() is true while the action is running.
            [formRoot] sets it automatically — no manual submitting signal needed.
          -->
          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="quoteForm().submitting()"
          >
            @if (quoteForm().submitting()) {
              <span class="btn-spinner" aria-hidden="true"></span>
              Creating…
            } @else {
              Create quote
            }
          </button>
        </div>

      </form>
    </div>
  `,
  styles: [`
    /* ── Panel shell ──────────────────────────────────────────────────── */
    .panel {
      background: white;
      border: 1px solid #d9d9d9;
      border-radius: 8px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,.06);
    }

    /* ── Header ───────────────────────────────────────────────────────── */
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1.25rem;
    }
    .panel-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 600;
      color: #1a1a1a;
    }
    .btn-icon {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1rem;
      color: #aaa;
      padding: .25rem .5rem;
      border-radius: 4px;
      line-height: 1;
    }
    .btn-icon:hover { color: #555; background: #f5f5f5; }

    /* ── Banners ──────────────────────────────────────────────────────── */
    .banner {
      display: flex;
      align-items: center;
      gap: .5rem;
      padding: .65rem 1rem;
      border-radius: 6px;
      font-size: .875rem;
      margin-bottom: 1.1rem;
    }
    .banner-success { background: #f6ffed; border: 1px solid #b7eb8f; color: #389e0d; }
    .banner-error   { background: #fff2f0; border: 1px solid #ffccc7; color: #cf1322; }

    /* ── Field ────────────────────────────────────────────────────────── */
    .field {
      display: flex;
      flex-direction: column;
      gap: .35rem;
      margin-bottom: 1.1rem;
    }

    .field-label {
      font-size: .875rem;
      font-weight: 600;
      color: #333;
    }
    .required-mark { color: #ff4d4f; margin-left: .15rem; }

    .field-input {
      padding: .55rem .8rem;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      font-size: .975rem;
      font-family: inherit;
      outline: none;
      transition: border-color .12s;
    }
    .field-input:focus { border-color: #0052cc; box-shadow: 0 0 0 2px #0052cc20; }

    .field-textarea {
      resize: vertical;
      min-height: 110px;
      line-height: 1.6;
    }

    .field-error-active .field-input {
      border-color: #ff4d4f;
    }
    .field-error-active .field-input:focus {
      border-color: #ff4d4f;
      box-shadow: 0 0 0 2px #ff4d4f20;
    }

    /* ── Field footer (error + char count) ───────────────────────────── */
    .field-foot {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: .5rem;
      min-height: 1.2em;
    }

    .field-err-msg {
      margin: 0;
      font-size: .8rem;
      color: #ff4d4f;
      flex: 1;
    }

    .char-count {
      font-size: .75rem;
      color: #bbb;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .char-count-warn { color: #fa8c16; font-weight: 600; }

    /* ── Required note ────────────────────────────────────────────────── */
    .required-note { margin: -.4rem 0 1rem; font-size: .75rem; color: #aaa; }

    /* ── Actions ──────────────────────────────────────────────────────── */
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: .75rem;
      margin-top: .25rem;
    }

    .btn {
      padding: .55rem 1.25rem;
      border-radius: 4px;
      font-size: .9rem;
      cursor: pointer;
      border: 1px solid transparent;
      display: inline-flex;
      align-items: center;
      gap: .4rem;
      transition: opacity .12s;
    }
    .btn:disabled { opacity: .45; cursor: not-allowed; }

    .btn-secondary {
      background: white;
      border-color: #d9d9d9;
      color: #555;
    }
    .btn-secondary:not(:disabled):hover { border-color: #aaa; }

    .btn-primary {
      background: #0052cc;
      border-color: #0052cc;
      color: white;
    }
    .btn-primary:not(:disabled):hover { background: #40a9ff; border-color: #40a9ff; }

    /* ── Submit spinner ───────────────────────────────────────────────── */
    .btn-spinner {
      width: 13px;
      height: 13px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: white;
      border-radius: 50%;
      animation: btn-spin .6s linear infinite;
      flex-shrink: 0;
    }
    @keyframes btn-spin { to { transform: rotate(360deg); } }
  `],
})
export class CreateQuoteComponent {
  private readonly svc = inject(QuotesService);

  // ── Outputs ──────────────────────────────────────────────────────────────
  readonly created   = output<void>();
  readonly cancelled = output<void>();

  // ── Local state ──────────────────────────────────────────────────────────
  readonly succeeded = signal(false);

  // ── Model signal (source of truth for field values) ───────────────────────
  // form() reads this signal and keeps the FieldTree in sync.
  // Resetting it resets field values; touched/dirty metadata is NOT reset
  // (Signal Forms experimental limitation — no reset() API yet).
  readonly model = signal<QuoteFormModel>({ author: '', text: '' });

  // ── Signal Form ───────────────────────────────────────────────────────────
  // form(model, validationSchema, options)
  //   model           — writable signal holding form values
  //   validationSchema — imperative schema; validators run on every value change
  //   submission.action — called by [formRoot] after all validators pass;
  //                       return { kind, message } to surface a form-level error,
  //                       return nothing (undefined) for success
  readonly quoteForm = form(
    this.model,
    (path) => {
      required(path.author, { message: 'Author is required.' });
      maxLength(path.author, 200, { message: 'Author cannot exceed 200 characters.' });
      required(path.text, { message: 'Quote text is required.' });
      maxLength(path.text, 1000, { message: 'Quote text cannot exceed 1000 characters.' });
    },
    {
      submission: {
        action: async (field) => {
          this.succeeded.set(false);

          const { author, text } = field().value();

          try {
            // POST /api/quotes — body: { "author": string, "text": string }
            await firstValueFrom(this.svc.createQuote({ author, text }));
            this.succeeded.set(true);
            // Reset model values. KNOWN ISSUE: touched metadata is not reset
            // by Signal Forms (experimental). Empty required fields may briefly
            // show their validation errors until the user interacts or closes
            // the panel. A stable reset() API is expected post-experimental.
            this.model.set({ author: '', text: '' });
            this.created.emit();
            return; // explicit success path — action returns nothing on success
          } catch (err) {
            const httpErr = err as HttpErrorResponse;
            const problem = httpErr.error as { detail?: string };
            // Returning an error object surfaces it through quoteForm().errors()
            // with kind 'serverError' so the template can display it in the banner.
            return {
              kind: 'serverError' as const,
              message: problem?.detail ?? 'Something went wrong. Please try again.',
            };
          }
        },
      },
    },
  );

  // ── Server-error accessor ─────────────────────────────────────────────────
  // Reads form-level errors from Signal Forms and finds the action-returned one.
  serverError(): string {
    const err = this.quoteForm().errors().find(e => e.kind === 'serverError');
    return err?.message ?? '';
  }

  // ── Actions ───────────────────────────────────────────────────────────────
  onCancel(): void {
    this.cancelled.emit();
  }
}
