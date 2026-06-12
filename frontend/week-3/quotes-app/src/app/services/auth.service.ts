import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { LoginRequest, LoginResponse } from '../models/quote.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly API = environment.apiBaseUrl;
  private readonly TOKEN_KEY = 'access_token';

  token      = signal<string | null>(localStorage.getItem(this.TOKEN_KEY));
  isLoggedIn = computed(() => !!this.token());

  login(credentials: LoginRequest) {
    return this.http
      .post<LoginResponse>(`${this.API}/api/auth/login`, credentials)
      .pipe(
        tap(res => {
          localStorage.setItem(this.TOKEN_KEY, res.access_token);
          this.token.set(res.access_token);
        })
      );
  }

  logout() {
    localStorage.removeItem(this.TOKEN_KEY);
    this.token.set(null);
  }
}
