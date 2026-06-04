import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { AppError, ValidationProblemDetails } from '../models/app-error.model';

export const problemDetailsInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((err: unknown) => {
      if (!(err instanceof HttpErrorResponse)) {
        return throwError(() => err);
      }
      return throwError(() => toAppError(err));
    })
  );

function toAppError(err: HttpErrorResponse): AppError {
  if (err.status === 0) {
    return { kind: 'network', message: 'Network error — check your connection.' };
  }

  const body = err.error as ValidationProblemDetails | null;

  if (err.status === 401 || err.status === 403) {
    return {
      kind: 'authorization',
      message:
        body?.detail ??
        (err.status === 401
          ? 'Unauthorized — please log in.'
          : 'Forbidden — access denied.'),
    };
  }

  if (err.status === 400 || err.status === 422) {
    if (body?.errors) {
      const messages = Object.values(body.errors).flat().join(', ');
      return { kind: 'validation', message: messages || 'Validation failed.' };
    }
    return {
      kind: 'validation',
      message: body?.detail ?? body?.title ?? 'Validation error.',
    };
  }

  if (err.status >= 500) {
    return { kind: 'server', message: 'Server error — try again later.' };
  }

  return {
    kind: 'server',
    message: body?.detail ?? body?.title ?? `HTTP ${err.status} error.`,
  };
}
