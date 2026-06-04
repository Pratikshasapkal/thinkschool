import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="wrapper">
      <div class="card">
        <h2>Quotes API</h2>

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }

        <input [(ngModel)]="email" type="email" placeholder="Email" />
        <input [(ngModel)]="password" type="password" placeholder="Password"
               (keyup.enter)="login()" />

        <button (click)="login()" [disabled]="loading()">
          {{ loading() ? 'Signing in…' : 'Sign in' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .wrapper {
      display: flex; justify-content: center; align-items: center;
      min-height: 100vh; background: #f0f2f5;
    }
    .card {
      background: white; padding: 2rem; border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
      width: 320px; display: flex; flex-direction: column; gap: .75rem;
    }
    h2 { margin: 0 0 .5rem; text-align: center; font-size: 1.4rem; }
    input {
      padding: .6rem .8rem; border: 1px solid #d9d9d9;
      border-radius: 4px; font-size: 1rem; outline: none;
    }
    input:focus { border-color: #1890ff; }
    button {
      padding: .7rem; background: #1890ff; color: white;
      border: none; border-radius: 4px; font-size: 1rem; cursor: pointer;
    }
    button:disabled { opacity: .6; cursor: not-allowed; }
    .error { color: #ff4d4f; font-size: .875rem; margin: 0; }
  `]
})
export class LoginComponent {
  private auth   = inject(AuthService);
  private router = inject(Router);

  email = '';
  password = '';
  loading = signal(false);
  error = signal<string | null>(null);

  login() {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login({ email: this.email, password: this.password }).subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/quotes']);
      },
      error: () => {
        this.error.set('Invalid email or password.');
        this.loading.set(false);
      },
    });
  }
}