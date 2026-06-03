import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  ViewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { QuotesService } from '../../../services/quotes.service';

/**
 * Design decisions
 * ────────────────
 * wasSubmitted signal — avoids calling markAllAsTouched() which does not
 *   schedule change detection in zoneless + OnPush.  Setting a signal on the
 *   first invalid submit triggers a re-render that shows all errors at once.
 *
 * isInvalid() / hasError() as methods — reactive because Angular's
 *   FormControlDirective calls ChangeDetectorRef.markForCheck() whenever a
 *   bound control's value or status changes, so each re-render reads the
 *   latest FormControl state.
 *
 * @ViewChild for focus — focus is moved to the first invalid field on submit
 *   so keyboard and screen-reader users know exactly where to look.
 *
 * output<void>() — modern Angular signals-based outputs, no EventEmitter.
 *
 * fb.nonNullable.group() — control values typed as string (not string|null),
 *   so getRawValue() returns { author: string; text: string } without cast.
 *
 * aria-describedby targets — the error <p> elements are always present in the
 *   DOM (never wrapped in @if) so the describedby association is never broken.
 *   aria-live="polite" on each announces content changes to screen readers.
 */
@Component({
  selector: 'app-create-quote',
  standalone: true,
  imports: [ReactiveFormsModule],
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
      @if (serverError()) {
        <div class="banner banner-error" role="alert">
          {{ serverError() }}
        </div>
      }

      <form
        [formGroup]="form"
        (ngSubmit)="onSubmit()"
        novalidate
        aria-label="Create quote"
      >

        <!-- ── Author ── -->
        <div class="field" [class.field-error-active]="isInvalid('author')">
          <label for="cq-author" class="field-label">
            Author
            <span class="required-mark" aria-hidden="true">*</span>
          </label>

          <input
            id="cq-author"
            #authorInput
            type="text"
            formControlName="author"
            class="field-input"
            autocomplete="off"
            [attr.aria-invalid]="isInvalid('author') ? 'true' : 'false'"
            aria-describedby="cq-author-err cq-author-hint"
          />

          <div class="field-foot">
            <!-- Error message is always in the DOM so aria-describedby is stable -->
            <p id="cq-author-err" class="field-err-msg" aria-live="polite">
              @if (hasError('author', 'required')) {
                Author is required.
              } @else if (hasError('author', 'maxlength')) {
                Author cannot exceed 200 characters.
              }
            </p>
            <span
              id="cq-author-hint"
              class="char-count"
              [class.char-count-warn]="authorLength() > 180"
              aria-hidden="true"
            >{{ authorLength() }}&thinsp;/&thinsp;200</span>
          </div>
        </div>

        <!-- ── Quote text ── -->
        <div class="field" [class.field-error-active]="isInvalid('text')">
          <label for="cq-text" class="field-label">
            Quote text
            <span class="required-mark" aria-hidden="true">*</span>
          </label>

          <textarea
            id="cq-text"
            #textInput
            formControlName="text"
            class="field-input field-textarea"
            rows="5"
            [attr.aria-invalid]="isInvalid('text') ? 'true' : 'false'"
            aria-describedby="cq-text-err cq-text-hint"
          ></textarea>

          <div class="field-foot">
            <p id="cq-text-err" class="field-err-msg" aria-live="polite">
              @if (hasError('text', 'required')) {
                Quote text is required.
              } @else if (hasError('text', 'maxlength')) {
                Quote text cannot exceed 1000 characters.
              }
            </p>
            <span
              id="cq-text-hint"
              class="char-count"
              [class.char-count-warn]="textLength() > 900"
              aria-hidden="true"
            >{{ textLength() }}&thinsp;/&thinsp;1000</span>
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

          <button
            type="submit"
            class="btn btn-primary"
            [disabled]="submitting()"
          >
            @if (submitting()) {
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
    .field-input:focus { border-color: #1890ff; box-shadow: 0 0 0 2px #1890ff20; }

    .field-textarea {
      resize: vertical;
      min-height: 110px;
      line-height: 1.6;
    }

    /* Red border when the field has an active error */
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
      min-height: 1.2em; /* reserves space so layout doesn't jump */
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
      background: #1890ff;
      border-color: #1890ff;
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
  private readonly fb  = inject(FormBuilder);

  // ── Outputs ──────────────────────────────────────────────────────────────
  /** Emitted after a successful POST; parent should reload the quote list. */
  readonly created   = output<void>();
  /** Emitted when the user closes the form without submitting. */
  readonly cancelled = output<void>();

  // ── Focus targets for first-invalid-field focus on submit ────────────────
  @ViewChild('authorInput') private readonly authorInputRef!: ElementRef<HTMLInputElement>;
  @ViewChild('textInput')   private readonly textInputRef!: ElementRef<HTMLTextAreaElement>;

  // ── Reactive form ─────────────────────────────────────────────────────────
  // nonNullable.group() ensures getRawValue() returns { author: string; text: string }
  // without a string | null union — keeps downstream code strictly typed.
  readonly form = this.fb.nonNullable.group({
    author: ['', [Validators.required, Validators.maxLength(200)]],
    text:   ['', [Validators.required, Validators.maxLength(1000)]],
  });

  // ── Component signals ─────────────────────────────────────────────────────
  readonly submitting   = signal(false);
  readonly serverError  = signal<string | null>(null);
  readonly succeeded    = signal(false);
  /**
   * Flipped to true on the first submit attempt.
   * Used by isInvalid() so all fields show errors at once on submit,
   * without calling markAllAsTouched() which doesn't schedule change
   * detection in zoneless + OnPush.
   */
  readonly wasSubmitted = signal(false);

  // ── Validation helpers ────────────────────────────────────────────────────
  // These are plain methods rather than computed() because they read from
  // FormControl properties, not signals.  They are called by the template
  // on every render triggered by either a signal change (wasSubmitted) or
  // Angular's FormControlDirective calling markForCheck() on value/status
  // changes — so they always reflect current form state.

  isInvalid(field: 'author' | 'text'): boolean {
    const ctrl = this.form.controls[field];
    return ctrl.invalid && (ctrl.touched || this.wasSubmitted());
  }

  hasError(field: 'author' | 'text', error: string): boolean {
    return this.isInvalid(field) && this.form.controls[field].hasError(error);
  }

  authorLength(): number { return this.form.controls.author.value.length; }
  textLength():   number { return this.form.controls.text.value.length; }

  // ── Actions ───────────────────────────────────────────────────────────────
  onSubmit(): void {
    // Reset transient banners
    this.succeeded.set(false);
    this.serverError.set(null);

    if (this.form.invalid) {
      // Signal flip triggers re-render → all invalid fields show errors
      this.wasSubmitted.set(true);
      this.focusFirstInvalid();
      return;
    }

    this.submitting.set(true);
    const { author, text } = this.form.getRawValue();

    this.svc.createQuote({ author, text }).subscribe({
      next: () => {
        this.succeeded.set(true);
        this.submitting.set(false);
        this.form.reset();
        this.wasSubmitted.set(false);
        this.created.emit();        // parent reloads list; form stays open
      },
      error: (err: HttpErrorResponse) => {
        // Backend returns RFC 7807 ProblemDetails: { detail: string, status: number }
        const problem = err.error as { detail?: string };
        this.serverError.set(
          problem?.detail ?? 'Something went wrong. Please try again.',
        );
        this.submitting.set(false);
      },
    });
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  private focusFirstInvalid(): void {
    if (this.form.controls.author.invalid) {
      this.authorInputRef?.nativeElement.focus();
    } else if (this.form.controls.text.invalid) {
      this.textInputRef?.nativeElement.focus();
    }
  }
}
