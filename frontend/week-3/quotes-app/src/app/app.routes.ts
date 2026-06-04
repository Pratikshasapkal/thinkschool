import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { LoginComponent } from './components/login/login.component';
import { QuotesListComponent } from './components/quotes-list/quotes-list.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'quotes',
    component: QuotesListComponent,
    canActivate: [authGuard],
  },
  {
    path: 'quotes/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/quote-detail/quote-detail.component')
        .then(m => m.QuoteDetailComponent),
  },
  { path: '', redirectTo: '/quotes', pathMatch: 'full' },
  { path: '**', redirectTo: '/quotes' },
];
