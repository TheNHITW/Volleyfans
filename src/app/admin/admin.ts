import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface Player {
  name: string;
  gender: string;
}

interface Team {
  teamName: string;
  phone: string;
  players: Player[];
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
  isRegistrationOpen = false;

  readonly baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://volleyfans-bh.onrender.com';

  readonly availableDates = [
    { label: '31 Agosto 2025', value: '2025-08-31' },
    { label: '12 Settembre 2025', value: '2025-09-12' },
    { label: '12 Ottobre 2025', value: '2025-10-12' }
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
        next: res => this.isRegistrationOpen = res.isRegistrationOpen,
        error: () => {
          alert('Errore nel recuperare lo stato delle iscrizioni.');
          this.isRegistrationOpen = false;
        }
      });
  }

  loadTeams(date: string) {
    this.http.get<Team[]>(`${this.baseUrl}/admin/registrations?date=${date}`)
      .subscribe({
        next: data => this.teams = data,
        error: err => {
          console.error('Errore nel caricamento:', err);
          alert('Errore nel recuperare le iscrizioni.');
        }
      });
  }

  exportToCSV() {
    if (this.teams.length === 0) {
      alert('Nessuna iscrizione trovata per questa data.');
      return;
    }

    const header = 'Nome Squadra,Telefono,Giocatore 1,Sesso 1,Giocatore 2,Sesso 2,Giocatore 3,Sesso 3,Giocatore 4,Sesso 4\n';
    const rows = this.teams.map(team => {
      const players = team.players.map(p => `${p.name},${p.gender}`).join(',');
      return `${team.teamName},${team.phone},${players}`;
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
        next: res => this.isRegistrationOpen = res.isRegistrationOpen,
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
