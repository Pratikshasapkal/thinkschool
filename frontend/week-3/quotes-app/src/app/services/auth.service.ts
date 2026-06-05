import { computed, inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { tap } from 'rxjs';
import { LoginRequest, LoginResponse } from '../models/quote.model';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private readonly API = environment.apiBaseUrl;

  token     = signal<string | null>(null);
  isLoggedIn = computed(() => !!this.token());

  login(credentials: LoginRequest) {
    return this.http
      .post<LoginResponse>(`${this.API}/api/auth/login`, credentials)
      .pipe(tap(res => this.token.set(res.access_token)));
  }

  logout() {
    this.token.set(null);
  }
}
