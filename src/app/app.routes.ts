import { Routes } from '@angular/router';
import { Home } from './home/home';
import { RegistrationForm } from './registration-form/registration-form';
import { Admin } from './admin/admin';
import { AuthGuard } from './auth.guard';
import { LoginComponent } from './login';
import { AdminClassificheComponent } from './admin-classifiche/admin-classifiche';
import { IscrivitiHome } from './iscriviti-home/iscriviti-home';
import { AperivolleyForm } from './aperivolley-form/aperivolley-form';
import { RisultatiLiveComponent } from './risultati-live/risultati-live';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'register', component: RegistrationForm },
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: Admin, canActivate: [AuthGuard] },
  { path: 'admin/classifiche', component: AdminClassificheComponent },
  { path: 'iscriviti', component: IscrivitiHome },
  { path: 'registrazione-aperivolley', component: AperivolleyForm },
  { path: 'live', component: RisultatiLiveComponent }
];
