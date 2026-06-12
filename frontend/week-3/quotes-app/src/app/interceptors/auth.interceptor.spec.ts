import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';

import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../services/auth.service';

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let mockToken: ReturnType<typeof signal<string | null>>;

  beforeEach(() => {
    mockToken = signal<string | null>(null);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: { token: mockToken } },
      ],
    });
    http     = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('adds "Authorization: Bearer <token>" when a token is present', () => {
    mockToken.set('test-jwt-token');

    http.get('/api/quotes').subscribe();
    const req = httpMock.expectOne('/api/quotes');

    expect(req.request.headers.get('Authorization')).toBe('Bearer test-jwt-token');
    req.flush({});
  });

  it('does NOT add an Authorization header when token is null', () => {
    mockToken.set(null);

    http.get('/api/quotes').subscribe();
    const req = httpMock.expectOne('/api/quotes');

    expect(req.request.headers.has('Authorization')).toBeFalse();
    req.flush({});
  });
});
