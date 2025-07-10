import { Component, OnInit } from '@angular/core';

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

  constructor() {}

  ngOnInit(): void {
    this.teams = JSON.parse(localStorage.getItem('teams') || '[]');
  }

  exportToCSV() {
    if (this.teams.length === 0) {
      alert('Nessuna iscrizione trovata.');
      return;
    }

    let csvContent = 'Nome Squadra,Telefono, Giocatore 1, Sesso 1, Giocatore 2, Sesso 2, Giocatore 3, Sesso 3, Giocatore 4, Sesso 4\n';

    this.teams.forEach((team: Team) => {
      const players = team.players
        .map((p: Player) => `${p.name},${p.gender}`)
        .join(',');
      csvContent += `${team.teamName},${players}\n`;
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

  clearAll() {
    localStorage.removeItem('teams');
    this.teams = [];
    alert('Tutte le iscrizioni sono state cancellate.');
  }

}