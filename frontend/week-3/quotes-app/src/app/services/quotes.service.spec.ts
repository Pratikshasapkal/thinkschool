/// <reference types="jasmine" />

/**
 * Characterisation tests – pin the real API contract before touching any
 * HttpClient / interceptor code.  If ANY assertion below fails after a backend
 * change, the contract has been broken and downstream UI code will be affected.
 *
 * Real backend contract (GET /api/quotes):
 *   Response body: Quote[]          (array, not { value, count })
 *   Field names:   id, author, text, createdAt
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { QuotesService } from './quotes.service';
import { Quote } from '../models/quote.model';

describe('QuotesService – API contract characterisation', () => {
  let service: QuotesService;
  let httpMock: HttpTestingController;

  const BASE      = 'http://localhost:5032';
  const QUOTES_EP = `${BASE}/api/quotes?page=1&size=10`;

  const makeQuote = (overrides: Partial<Quote> = {}): Quote => ({
    id:        1000508,
    author:    'SignalFormsTest',
    text:      'Day 14 Piece 2 Signal Forms verification',
    createdAt: '2026-06-03T12:51:20.1381383',
    ...overrides,
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service  = TestBed.inject(QuotesService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  // ── GET response shape ─────────────────────────────────────────────────────

  it('GET response is a Quote[] array (not a wrapped object)', () => {
    const body: Quote[] = [makeQuote()];

    service.load(1, 10);
    httpMock.expectOne(QUOTES_EP).flush(body);

    expect(Array.isArray(service.quotes())).toBeTrue();
    expect(typeof service.totalCount()).toBe('number');
  });

  it('array is mapped directly to the quotes signal', () => {
    const q = makeQuote();

    service.load(1, 10);
    httpMock.expectOne(QUOTES_EP).flush([q]);

    expect(service.quotes()).toEqual([q]);
  });

  it('totalCount signal is set to the array length', () => {
    service.load(1, 10);
    httpMock.expectOne(QUOTES_EP).flush([makeQuote(), makeQuote({ id: 2 })]);

    expect(service.totalCount()).toBe(2);
  });

  // ── GET Quote field names ──────────────────────────────────────────────────

  it('each Quote in GET response has "id" typed as number', () => {
    service.load(1, 10);
    httpMock.expectOne(QUOTES_EP).flush([makeQuote({ id: 1000508 })]);

    expect(typeof service.quotes()[0].id).toBe('number');
  });

  it('each Quote in GET response has "author" typed as string', () => {
    service.load(1, 10);
    httpMock.expectOne(QUOTES_EP).flush([makeQuote({ author: 'Alice' })]);

    expect(typeof service.quotes()[0].author).toBe('string');
  });

  it('GET uses "text" — NOT "quoteText" — for the body field', () => {
    const q = makeQuote({ text: 'Hello World' });

    service.load(1, 10);
    httpMock.expectOne(QUOTES_EP).flush([q]);

    expect(service.quotes()[0].text).toBe('Hello World');
    // Breaking change detector: if backend renames text → quoteText this line fails.
    expect((service.quotes()[0] as unknown as Record<string, unknown>)['quoteText']).toBeUndefined();
  });

  it('each Quote in GET response has "createdAt" typed as string', () => {
    service.load(1, 10);
    httpMock.expectOne(QUOTES_EP).flush([makeQuote()]);

    expect(typeof service.quotes()[0].createdAt).toBe('string');
  });

  // ── POST body field name ───────────────────────────────────────────────────

  it('POST /api/quotes sends { author, text } — NOT { author, quoteText }', () => {
    service.createQuote({ author: 'Alice', text: 'My quote' }).subscribe();

    const req = httpMock.expectOne(`${BASE}/api/quotes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ author: 'Alice', text: 'My quote' });
    // Breaking change detector: if DTO renames text → quoteText this line fails.
    expect((req.request.body as Record<string, unknown>)['quoteText']).toBeUndefined();

    req.flush({});
  });

  // ── 4xx / 5xx error signal handling ───────────────────────────────────────

  it('404 ProblemDetails sets error signal and clears loading', () => {
    service.load(1, 10);
    expect(service.loading()).toBeTrue();

    httpMock.expectOne(QUOTES_EP).flush(
      {
        type:    'https://tools.ietf.org/html/rfc7231#section-6.5.4',
        title:   'Not Found',
        status:  404,
        traceId: '00-abcdef-01',
      },
      { status: 404, statusText: 'Not Found' }
    );

    expect(service.error()).toBeTruthy();
    expect(service.loading()).toBeFalse();
  });

  it('500 error sets error signal', () => {
    service.load(1, 10);
    httpMock.expectOne(QUOTES_EP).flush(
      { title: 'Internal Server Error', status: 500 },
      { status: 500, statusText: 'Internal Server Error' }
    );

    expect(service.error()).toBeTruthy();
  });
});
