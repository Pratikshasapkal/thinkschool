import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { retryInterceptor } from './interceptors/retry.interceptor';
import { problemDetailsInterceptor } from './interceptors/problem-details.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(),
    // Interceptor order matters — each wraps the next:
    // auth (adds header) → retry (retries GET) → problemDetails (maps errors to AppError)
    provideHttpClient(withInterceptors([
      authInterceptor,
      retryInterceptor,
      problemDetailsInterceptor,
    ])),
  ],
};
