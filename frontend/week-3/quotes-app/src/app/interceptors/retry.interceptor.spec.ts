import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { retryInterceptor } from './retry.interceptor';

describe('retryInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([retryInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http     = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('retries GET exactly 3 times (4 total attempts) with exponential backoff', fakeAsync(() => {
    let errorCount = 0;

    http.get('/api/quotes').subscribe({ error: () => errorCount++ });

    // Attempt 1 – original request
    httpMock.expectOne('/api/quotes').flush({}, { status: 500, statusText: 'Server Error' });
    tick(2000); // 2^1 × 1000 ms

    // Attempt 2 – retry 1
    httpMock.expectOne('/api/quotes').flush({}, { status: 500, statusText: 'Server Error' });
    tick(4000); // 2^2 × 1000 ms

    // Attempt 3 – retry 2
    httpMock.expectOne('/api/quotes').flush({}, { status: 500, statusText: 'Server Error' });
    tick(8000); // 2^3 × 1000 ms

    // Attempt 4 – retry 3 (final)
    httpMock.expectOne('/api/quotes').flush({}, { status: 500, statusText: 'Server Error' });

    expect(errorCount).toBe(1);           // error propagated after all retries exhausted
    httpMock.expectNone('/api/quotes');   // no further attempts
  }));

  it('succeeds on a retry attempt and delivers the response', fakeAsync(() => {
    let result: unknown;

    http.get('/api/quotes').subscribe({ next: v => (result = v) });

    // First attempt fails
    httpMock.expectOne('/api/quotes').flush({}, { status: 500, statusText: 'Server Error' });
    tick(2000);

    // Retry succeeds
    httpMock.expectOne('/api/quotes').flush({ value: [], count: 0 });

    expect(result).toEqual({ value: [], count: 0 });
  }));

  it('does NOT retry POST requests', () => {
    let errorCount = 0;

    http.post('/api/quotes', { author: 'A', text: 'Q' }).subscribe({ error: () => errorCount++ });
    httpMock.expectOne('/api/quotes').flush({}, { status: 500, statusText: 'Server Error' });

    expect(errorCount).toBe(1);
    httpMock.expectNone('/api/quotes');
  });

  it('does NOT retry PATCH requests', () => {
    let errorCount = 0;

    http.patch('/api/quotes/1', {}).subscribe({ error: () => errorCount++ });
    httpMock.expectOne('/api/quotes/1').flush({}, { status: 500, statusText: 'Server Error' });

    expect(errorCount).toBe(1);
    httpMock.expectNone('/api/quotes/1');
  });
});
