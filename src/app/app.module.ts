import { NgModule, Component } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http'; // ✅ Importa HttpClientModule
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';

import { routes } from './app.routes';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { Home } from './home/home';
import { RegistrationForm } from './registration-form/registration-form';
import { Admin } from './admin/admin';
import { LoginComponent } from './login';
import { AdminClassificheComponent } from './admin-classifiche/admin-classifiche';

@Component({
  selector: 'app-root',
  standalone: false,
  templateUrl: './app.html',
  styleUrls: ['./app.css']
})
export class AppComponent { }


@NgModule({
  declarations: [
    AppComponent,
    Home,
    RegistrationForm,
    Admin,
    LoginComponent,
    AdminClassificheComponent
  ],
  imports: [
    BrowserModule,
    RouterModule.forRoot(routes),
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule, // ✅ Inserito
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  bootstrap: [AppComponent]
})
export class AppModule { }
