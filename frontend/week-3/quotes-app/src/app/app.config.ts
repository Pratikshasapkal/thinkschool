import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withViewTransitions } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { retryInterceptor } from './interceptors/retry.interceptor';
import { problemDetailsInterceptor } from './interceptors/problem-details.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    provideRouter(routes, withViewTransitions()),
    // Interceptor order: auth (adds header) → retry (retries GET) → problemDetails (maps to AppError)
    provideHttpClient(withInterceptors([
      authInterceptor,
      retryInterceptor,
      problemDetailsInterceptor,
    ])),
  ],
};
