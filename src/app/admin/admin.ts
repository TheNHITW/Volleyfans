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
  isRegistrationOpen = false;
  readonly baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://volleyfans-bh.onrender.com';

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTeams();
    this.http.get<{ isRegistrationOpen: boolean }>(`${this.baseUrl}/config`)
      .subscribe(res => {
        this.isRegistrationOpen = res.isRegistrationOpen;
      });
  }

  loadTeams() {
    this.http.get<Team[]>(`${this.baseUrl}/admin/registrations`)
      .subscribe({
        next: (data) => this.teams = data,
        error: (err) => {
          console.error('Errore nel caricamento:', err);
          alert('Errore nel recuperare le iscrizioni.');
        }
      });
  }

  exportToCSV() {
    if (this.teams.length === 0) {
      alert('Nessuna iscrizione trovata.');
      return;
    }

    let csvContent = 'Nome Squadra,Telefono,Giocatore 1,Sesso 1,Giocatore 2,Sesso 2,Giocatore 3,Sesso 3,Giocatore 4,Sesso 4\n';

    this.teams.forEach((team: Team) => {
      const players = team.players.map(p => `${p.name},${p.gender}`).join(',');
      csvContent += `${team.teamName},${team.phone},${players}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'iscrizioni_torneo.csv');
    link.click();
  }

  toggleRegistration() {
    this.http.post<{ isRegistrationOpen: boolean }>(`${this.baseUrl}/admin/toggle-registration`, {})
      .subscribe(res => {
        this.isRegistrationOpen = res.isRegistrationOpen;
      });
  }

  deleteTeam(teamNameToDelete: string) {
    const conferma = confirm(`Vuoi davvero eliminare la squadra "${teamNameToDelete}"?`);
    if (!conferma) return;

    this.http.delete(`${this.baseUrl}/admin/registrations/${encodeURIComponent(teamNameToDelete)}`)
      .subscribe({
        next: () => {
          this.teams = this.teams.filter(team => team.teamName !== teamNameToDelete);
          alert('Squadra eliminata con successo.');
        },
        error: (err) => {
          console.error('Errore durante l\'eliminazione:', err);
          alert('Errore durante l\'eliminazione della squadra.');
        }
      });
  }
}
