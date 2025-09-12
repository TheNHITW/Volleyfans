import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ViewChild } from '@angular/core';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';

interface Player {
  name: string;
  gender: string;
}
interface Team {
  teamName: string;
  phone?: string;
  skillLevel?: string;
  players?: Player[];
}

interface AperitivoReg {
  fullName: string;
  phone?: string;
  peopleCount: number;
  privacyConsent?: boolean;
  source: 'Squadra' | 'Singolo';
  date?: string;
  teamname?: string;
}

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class Admin implements OnInit {
  // 🔽 NEW: modalità vista
  viewMode: 'teams' | 'aperitivo' = 'teams';

  teams: Team[] = [];
  aperitivo: AperitivoReg[] = [];
  aperitivoDS = new MatTableDataSource<AperitivoReg>([]);
  @ViewChild('aperSort', { static: false }) aperSort!: MatSort;

  selectedDate = '';
  isRegistrationOpen = true;

  // colonne tabella squadre
  displayedColumns: string[] = [
    'index',
    'teamName', 'skillLevel',
    'phone',
    'p1Name','p1Gender',
    'p2Name','p2Gender',
    'p3Name','p3Gender',
    'p4Name','p4Gender',
    'actions'
  ];

  // 🔽 NEW: colonne tabella aperitivo
  displayedAperColumns: string[] = [
    'index',
    'fullName',
    'phone',
    'peopleCount',
    'teamName',
  ];

  readonly baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://volleyfans-bh.onrender.com';

  readonly availableDates = [
    { label: '31 Agosto 2025', value: '2025-08-31' },
    { label: '14 Settembre 2025', value: '2025-09-14' },
    { label: '5 Ottobre 2025', value: '2025-10-05' }
  ];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.selectedDate = this.availableDates[1].value;
    this.loadTeams(this.selectedDate);
    this.getRegistrationStatus();
  }

  getRegistrationStatus() {
    this.http.get<{ isRegistrationOpen: boolean }>(`${this.baseUrl}/config`)
      .subscribe({
        next: res => this.isRegistrationOpen = !!res?.isRegistrationOpen,
        error: () => {
          console.error('Errore stato iscrizioni');
          this.isRegistrationOpen = false;
        }
      });
  }

  loadTeams(date: string) {
    this.http.get<Team[]>(`${this.baseUrl}/admin/registrations?date=${date}`)
      .subscribe({
        next: data => {
          // normalizza: sempre array, sempre 4 slot giocatori
          this.teams = (data ?? []).map(t => {
            const players = (t.players ?? []).slice(0, 4);
            while (players.length < 4) players.push({ name: '—', gender: '—' });
            return { ...t, players };
          });

          // se siamo in modalita' aperitivo, ricarico anche la lista per aggiornare "hasTeam"
          if (this.viewMode === 'aperitivo') {
            this.loadAperitivo(this.selectedDate);
          }
        },
        error: err => {
          console.error('Errore nel caricamento squadre:', err);
          this.teams = [];
        }
      });
  }

// 🔽 NEW: carica iscritti aperitivo (merge squadre + singoli)
loadAperitivo(date: string) {
  // 1) Giocatori provenienti dalle squadre
  const fromTeams = (this.teams ?? []).flatMap(t =>
    (t.players ?? [])
      .filter(p => p.name && p.name !== '—')
      .map(p => ({
        fullName: p.name,
        phone: t.phone ?? '',
        peopleCount: 1,        // ogni giocatore conta 1 persona
        source: 'Squadra' as const,
        teamName: t.teamName,
      }))
  );

  // 2) Iscritti singoli dal form
  this.http.get<any[]>(`${this.baseUrl}/admin/aperitivo?date=${date}`)
    .subscribe({
      next: data => {
        const fromForm = (data ?? []).map(r => {
          const peopleCount = Number(r.peopleCount ?? r.age ?? 1);
          return {
            fullName: r.fullName ?? '',
            phone: r.phone ?? '',
            peopleCount: Number.isFinite(peopleCount) && peopleCount > 0 ? peopleCount : 1,
            source: 'Singolo' as const,
            date: r.date,
            createdAt: r.createdAt,
          };
        });
        // 3) Merge finale
        const merged: AperitivoReg[] = [...fromTeams, ...fromForm];
        // aggiorna array e datasource della tabella
        this.aperitivo = merged;
        this.aperitivoDS.data = merged;

        // attach sort e regole di sorting
        setTimeout(() => {
          if (this.aperSort) {
            this.aperitivoDS.sort = this.aperSort;
            this.aperitivoDS.sortingDataAccessor = (item: AperitivoReg, prop: string) => {
              switch (prop) {
                case 'teamName':
                  // i “Singolo” (senza teamName) vanno in fondo
                  return (item.teamname ? item.teamname : '~~zzzz_singolo').toLowerCase();
                case 'fullName':
                  return (item.fullName || '').toLowerCase();
                case 'peopleCount':
                  return item.peopleCount ?? 0;
                case 'phone':
                  return (item.phone || '').toLowerCase();
                case 'source':
                  return item.source;
                default:
                  return (item as any)[prop];
              }
            };
          }
        }, 0);
      },
      error: err => {
        console.error('Errore nel caricamento aperitivo:', err);
        // se fallisce la GET, mostra almeno i giocatori delle squadre
        this.aperitivo = fromTeams;
      }
    });
}


  // accesso sicuro per l’HTML
  getPlayer(team: Team, idx: number, key: 'name' | 'gender'): string {
    return team?.players?.[idx]?.[key] ?? '—';
  }

  // 🔽 NEW: export selettivo in base alla vista
  exportToCSV() {
    if (this.viewMode === 'teams') return this.exportTeamsCSV();
    return this.exportAperitivoCSV();
  }

  private exportTeamsCSV() {
    if (!this.teams?.length) {
      alert('Nessuna iscrizione squadre per questa data.');
      return;
    }
    const esc = (v: any): string => {
      const s = (v ?? '').toString();
      if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    const header = [
      'Nome Squadra', 'skillLevel', 'Telefono',
      'Giocatore 1', 'Sesso 1',
      'Giocatore 2', 'Sesso 2',
      'Giocatore 3', 'Sesso 3',
      'Giocatore 4', 'Sesso 4'
    ];

    const lines = this.teams.map(team => {
      const p = (team.players ?? []).slice(0, 4);
      while (p.length < 4) p.push({ name: '—', gender: '—' });

      const g = (idx: number) => {
        const raw = (p[idx]?.gender ?? '').toString().trim();
        return raw === '—' ? '—' : raw.toUpperCase();
      };

      return [
        esc(team.teamName ?? ''),
        esc(team.skillLevel ?? ''),
        esc(team.phone ?? ''),
        esc(p[0]?.name ?? ''), esc(g(0)),
        esc(p[1]?.name ?? ''), esc(g(1)),
        esc(p[2]?.name ?? ''), esc(g(2)),
        esc(p[3]?.name ?? ''), esc(g(3))
      ].join(',');
    });

    const csv = '\uFEFF' + header.join(',') + '\r\n' + lines.join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `iscrizioni_squadre_${this.selectedDate}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // 🔽 NEW: export CSV aperitivo
private exportAperitivoCSV() {
  if (!this.aperitivo?.length) {
    alert('Nessuna iscrizione aperitivo per questa data.');
    return;
  }
  const esc = (v: any): string => {
    const s = (v ?? '').toString();
    if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = [
    'Nome e Cognome',
    'Telefono',
    'N. Persone',
    'Provenienza'
  ];

  const lines = this.aperitivo.map(r => [
    esc(r.fullName ?? ''),
    esc(r.phone ?? ''),
    esc(r.peopleCount ?? 1),
    esc(r.source === 'Squadra' ? `Squadra ${r.teamname ?? ''}` : 'Singolo')
  ].join(','));

  const csv = '\uFEFF' + header.join(',') + '\r\n' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `iscrizioni_aperitivo_${this.selectedDate}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


  toggleRegistration() {
    this.http.post<{ isRegistrationOpen: boolean }>(`${this.baseUrl}/admin/toggle-registration`, {})
      .subscribe({
        next: res => this.isRegistrationOpen = !!res?.isRegistrationOpen,
        error: () => alert('Errore nel cambiare lo stato delle iscrizioni.')
      });
  }

  deleteTeam(teamNameToDelete: string) {
    if (!confirm(`Vuoi davvero eliminare la squadra "${teamNameToDelete}"?`)) return;

    this.http.delete(`${this.baseUrl}/admin/registrations/${encodeURIComponent(teamNameToDelete)}?date=${this.selectedDate}`)
      .subscribe({
        next: () => {
          this.teams = this.teams.filter(team => team.teamName !== teamNameToDelete);
          alert('Squadra eliminata con successo.');
          // se servisse ricalcolare hasTeam nell'aperitivo:
          if (this.viewMode === 'aperitivo') this.loadAperitivo(this.selectedDate);
        },
        error: err => {
          console.error('Errore durante l\'eliminazione:', err);
          alert('Errore durante l\'eliminazione della squadra.');
        }
      });
  }

  onDateChange() {
    // ricarico ciò che serve in base alla vista
    this.loadTeams(this.selectedDate);
    if (this.viewMode === 'aperitivo') this.loadAperitivo(this.selectedDate);
  }

  // 🔽 NEW: cambio vista
  onModeChange() {
    if (this.viewMode === 'teams') {
      this.loadTeams(this.selectedDate);
    } else {
      // carico prima teams (per calcolare hasTeam), poi aperitivo
      this.loadTeams(this.selectedDate);
      this.loadAperitivo(this.selectedDate);
    }
  }
}
