import { Injectable, NgZone } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, interval, of, Subscription } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';

/** Sceglie la base URL del backend (dev vs prod) */
function resolveBaseUrl(): string {
  const host = (typeof window !== 'undefined') ? window.location.hostname : '';
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  return isLocal ? 'http://localhost:3000' : 'https://volleyfans-bh.onrender.com';
}

/** Tipi minimi per lo stato live pubblico */
interface LiveState {
  registrations: any[];
  tournament: {
    groups: Record<string, any[]>;
    matches: Array<any>;
    standings: Record<string, Array<any>>;
  };
}

@Injectable({ providedIn: 'root' })
export class TournamentService {
  private baseUrl = resolveBaseUrl();

  // ======= LIVE state (pubblico) =======
  private liveState$ = new BehaviorSubject<LiveState | null>(null);
  private livePoll?: Subscription;
  private es?: EventSource; // SSE

  constructor(private http: HttpClient, private zone: NgZone) {}

  // ========= ADMIN API =========

  saveGroups(date: string, groups: Record<string, string[]>): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/${date}/groups`, groups);
  }

  generateMatches(date: string): Observable<{ success: boolean; matches: any[] }> {
    return this.http.post<{ success: boolean; matches: any[] }>(
      `${this.baseUrl}/admin/${date}/matches`,
      {}
    );
  }

  getTournament(date: string): Observable<any> {
    return this.http.get<any>(`${this.baseUrl}/admin/${date}/tournament`);
  }

  getMatches(date: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/${date}/matches`);
  }

  saveResult(
    date: string,
    matchId: string,
    puntiA: number,
    puntiB: number,
    teamAName: string,
    teamBName: string
  ): Observable<any> {
    return this.http.post(`${this.baseUrl}/admin/${date}/result`, {
      matchId,
      puntiA,
      puntiB,
      teamAName,
      teamBName
    });
  }

  getStandings(date: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/admin/${date}/standings`);
  }

  /** Iscrizioni */
  getTeams(date: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.baseUrl}/admin/registrations?date=${encodeURIComponent(date)}`);
  }

  // ========= LIVE (pubblico) =========
  /** Avvia aggiornamenti live per una data (SSE con fallback a polling). */
  connectLive(date: string, preferSSE: boolean = true): void {
    this.disconnectLive();
    // carico subito lo stato
    this.fetchPublicStateOnce(date);

    if (preferSSE) {
      try {
        const url = `${this.baseUrl}/public/${encodeURIComponent(date)}/events`;
        // EventSource deve girare fuori da zone per non spammare change detection
        this.zone.runOutsideAngular(() => {
          this.es = new EventSource(url);
          this.es.onmessage = (ev: MessageEvent) => {
            const data = safeParse(ev.data);
            if (!data) return;
            // su "hello" o "state-updated" ricarico lo stato
            if (data.type === 'hello' || data.type === 'state-updated') {
              this.fetchPublicStateOnce(date);
            }
          };
          this.es.onerror = () => {
            this.es?.close();
            this.es = undefined;
            this.startLivePolling(date);
          };
        });
        return;
      } catch {
        // se SSE fallisce, passo a polling
        this.startLivePolling(date);
      }
    } else {
      this.startLivePolling(date);
    }
  }

  /** Ferma SSE/polling live */
  disconnectLive(): void {
    this.es?.close();
    this.es = undefined;
    this.livePoll?.unsubscribe();
    this.livePoll = undefined;
  }

  /** Observable dello stato live (registrations + tournament) */
  liveState(): Observable<LiveState | null> {
    return this.liveState$.asObservable();
  }

  // ---- helpers live ----
  private startLivePolling(date: string): void {
    this.livePoll = interval(10000).pipe(
      switchMap(() =>
        this.http
          .get<{ success: boolean; data: LiveState }>(
            `${this.baseUrl}/public/${encodeURIComponent(date)}/state`
          )
          .pipe(catchError(() => of(null)))
      )
    ).subscribe(resp => {
      if (resp?.success) this.liveState$.next(resp.data);
    });
  }

  private fetchPublicStateOnce(date: string): void {
    this.http
      .get<{ success: boolean; data: LiveState }>(
        `${this.baseUrl}/public/${encodeURIComponent(date)}/state`
      )
      .subscribe(resp => {
        if (resp?.success) this.liveState$.next(resp.data);
      });
  }
}

// ---- util ----
function safeParse(s: string) {
  try { return JSON.parse(s); } catch { return null; }
}
