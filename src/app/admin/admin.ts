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
  templateUrl: './admin.html',
  standalone: false,
  styleUrls: ['./admin.css']
})
export class Admin implements OnInit {

  teams: Team[] = [];

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadTeams();
  }

  loadTeams() {
    this.http.get<Team[]>('https://volleyfans-bh.onrender.com/admin/registrations')
      .subscribe({
        next: (res) => {
          this.teams = res;
        },
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
      const players = team.players
        .map((p: Player) => `${p.name},${p.gender}`)
        .join(',');
      csvContent += `${team.teamName},${team.phone},${players}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'iscrizioni_torneo.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}
