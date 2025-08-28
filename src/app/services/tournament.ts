import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// 👇 funzione che sceglie baseUrl
function resolveBaseUrl(): string {
  const host = (typeof window !== 'undefined') ? window.location.hostname : '';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal ? 'http://localhost:3000' : 'https://volleyfans-bh.onrender.com';
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private baseUrl = resolveBaseUrl();

  constructor(private http: HttpClient) {}

  saveGroups(date: string, groups: Record<string, string[]>): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/${date}/groups`, groups);
  }

  generateMatches(date: string): Observable<{ success: boolean; matches: any[] }> {
    return this.http.post<{ success: boolean; matches: any[] }>(
      `${this.baseUrl}/admin/${date}/matches`, {}
    );
  }

    getTournament(date: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/admin/${date}/tournament`);
  }

  getMatches(date: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/${date}/matches`);
  }

  saveResult(date: string, matchId: string, puntiA: number, puntiB: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/${date}/result`, { matchId, puntiA, puntiB });
  }

  getStandings(date: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/${date}/standings`);
  }

  // 🔹 Rotta per recuperare iscrizioni
  getTeams(date: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/registrations?date=${date}`);
  }
}
