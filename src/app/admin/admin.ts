import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Player {
  name: string;
  gender: string;
}
interface Team {
  teamName: string;
  phone?: string;
  players?: Player[];
}

@Component({
  selector: 'app-admin',
  standalone: false,
  templateUrl: './admin.html',
  styleUrls: ['./admin.css']
})
export class Admin implements OnInit {
  teams: Team[] = [];
  selectedDate = '';
  isRegistrationOpen = true;

  // colonne per mat-table (match con gli ng-container dell'HTML)
  displayedColumns: string[] = [
    'teamName', 'phone',
    'p1Name','p1Gender',
    'p2Name','p2Gender',
    'p3Name','p3Gender',
    'p4Name','p4Gender',
    'actions'
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
    this.selectedDate = this.availableDates[0].value;
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
        },
        error: err => {
          console.error('Errore nel caricamento:', err);
          this.teams = [];
        }
      });
  }

  // accesso sicuro per l’HTML
  getPlayer(team: Team, idx: number, key: 'name' | 'gender'): string {
    return team?.players?.[idx]?.[key] ?? '—';
  }

  exportToCSV() {
    if (!this.teams?.length) {
      alert('Nessuna iscrizione trovata per questa data.');
      return;
    }

    const header = [
      'Nome Squadra','Telefono',
      'Giocatore 1','Sesso 1',
      'Giocatore 2','Sesso 2',
      'Giocatore 3','Sesso 3',
      'Giocatore 4','Sesso 4'
    ].join(',') + '\n';

    const safe = (v: string | undefined) =>
      (v ?? '').toString().replace(/"/g, '""'); // escape "

    const rows = this.teams.map(team => {
      const p = team.players ?? [];
      const cells = [
        team.teamName ?? '',
        team.phone ?? '',
        p[0]?.name ?? '', p[0]?.gender ?? '',
        p[1]?.name ?? '', p[1]?.gender ?? '',
        p[2]?.name ?? '', p[2]?.gender ?? '',
        p[3]?.name ?? '', p[3]?.gender ?? ''
      ].map(safe).map(v => `"${v}"`);
      return cells.join(',');
    }).join('\n');

    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `iscrizioni_${this.selectedDate}.csv`;
    link.click();
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
        },
        error: err => {
          console.error('Errore durante l\'eliminazione:', err);
          alert('Errore durante l\'eliminazione della squadra.');
        }
      });
  }

  onDateChange() {
    this.loadTeams(this.selectedDate);
  }
}
