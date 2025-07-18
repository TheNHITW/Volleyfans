import { Routes } from '@angular/router';
import { Home } from './home/home';
import { RegistrationForm } from './registration-form/registration-form';
import { Admin } from './admin/admin';
import { AuthGuard } from './auth.guard';
import { LoginComponent } from './login';
import { FormsModule } from '@angular/forms';

export const routes: Routes = [
  { path: '', component: Home },
  { path: 'register', component: RegistrationForm },
  { path: 'login', component: LoginComponent },
  { path: 'admin', component: Admin, canActivate: [AuthGuard] }
];
