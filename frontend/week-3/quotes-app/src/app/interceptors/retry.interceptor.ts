import { HttpInterceptorFn } from '@angular/common/http';
import { retry, timer } from 'rxjs';

const MAX_RETRIES = 3;

export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }

  return next(req).pipe(
    retry({
      count: MAX_RETRIES,
      // attempt is 1-indexed: first retry = 2s, second = 4s, third = 8s
      delay: (_err, attempt) => timer(Math.pow(2, attempt) * 1000),
    })
  );
};
