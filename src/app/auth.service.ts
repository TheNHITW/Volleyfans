import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private loggedIn = false;

  login(username: string, password: string): boolean {
    // ✅ Qui fai il controllo finto (o da DB/API)
    if (username === 'admin' && password === 'lollogay123.') {
      this.loggedIn = true;
      localStorage.setItem('isLoggedIn', 'true');
      return true;
    }
    return false;
  }

  logout(): void {
    this.loggedIn = false;
    localStorage.removeItem('isLoggedIn');
  }

  isAuthenticated(): boolean {
    return this.loggedIn || localStorage.getItem('isLoggedIn') === 'true';
  }
}
