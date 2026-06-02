import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from './services/auth.service';
import { LoginComponent } from './components/login/login.component';
import { QuotesListComponent } from './components/quotes-list/quotes-list.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LoginComponent, QuotesListComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (auth.isLoggedIn()) {
      <app-quotes-list />
    } @else {
      <app-login />
    }
  `
})
export class AppComponent {
  auth = inject(AuthService);
}