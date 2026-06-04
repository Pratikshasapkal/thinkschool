import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { problemDetailsInterceptor } from './problem-details.interceptor';
import { AppError } from '../models/app-error.model';

describe('problemDetailsInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([problemDetailsInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http     = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('passes successful responses through unchanged', () => {
    let response: unknown;
    http.get('/api/quotes').subscribe({ next: r => (response = r) });
    httpMock.expectOne('/api/quotes').flush({ value: [], count: 0 });
    expect(response).toEqual({ value: [], count: 0 });
  });

  it('maps 401 → kind "authorization" with a message', () => {
    let err: AppError | undefined;
    http.get('/api/quotes').subscribe({ error: e => (err = e) });
    httpMock.expectOne('/api/quotes').flush(
      { title: 'Unauthorized', status: 401 },
      { status: 401, statusText: 'Unauthorized' }
    );
    expect(err?.kind).toBe('authorization');
    expect(err?.message).toBeTruthy();
  });

  it('maps 403 → kind "authorization"', () => {
    let err: AppError | undefined;
    http.get('/api/quotes').subscribe({ error: e => (err = e) });
    httpMock.expectOne('/api/quotes').flush(
      { title: 'Forbidden', status: 403 },
      { status: 403, statusText: 'Forbidden' }
    );
    expect(err?.kind).toBe('authorization');
  });

  it('maps 400 ValidationProblemDetails (errors record) → kind "validation" with field messages', () => {
    let err: AppError | undefined;

    http.post('/api/quotes', {}).subscribe({ error: e => (err = e) });
    httpMock.expectOne('/api/quotes').flush(
      {
        title:  'One or more validation errors occurred.',
        status: 400,
        errors: {
          Author: ['Author is required.'],
          Text:   ['Text too long.'],
        },
      },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(err?.kind).toBe('validation');
    expect(err?.message).toContain('Author is required.');
    expect(err?.message).toContain('Text too long.');
  });

  it('maps 400 ProblemDetails (no errors, has detail) → kind "validation" using detail', () => {
    let err: AppError | undefined;

    http.post('/api/quotes', {}).subscribe({ error: e => (err = e) });
    httpMock.expectOne('/api/quotes').flush(
      { detail: 'Author must not be empty.', status: 400 },
      { status: 400, statusText: 'Bad Request' }
    );

    expect(err?.kind).toBe('validation');
    expect(err?.message).toBe('Author must not be empty.');
  });

  it('maps 500 → kind "server" with a message', () => {
    let err: AppError | undefined;
    http.get('/api/quotes').subscribe({ error: e => (err = e) });
    httpMock.expectOne('/api/quotes').flush(
      { title: 'Internal Server Error', status: 500 },
      { status: 500, statusText: 'Internal Server Error' }
    );
    expect(err?.kind).toBe('server');
    expect(err?.message).toBeTruthy();
  });

  it('maps network error (status 0) → kind "network"', () => {
    let err: AppError | undefined;
    http.get('/api/quotes').subscribe({ error: e => (err = e) });
    httpMock.expectOne('/api/quotes').error(new ProgressEvent('network'));
    expect(err?.kind).toBe('network');
  });
});
