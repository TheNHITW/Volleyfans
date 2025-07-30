import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

interface Team {
  teamName: string;
  players: string[];
  
}

interface Match {
  girone: string;     // A, B, C, D
  teamA: string;
  teamB: string;
  referee: string;
  field: number;
  round: number;
}

type Gironi = {
  [key: string]: Team[]; // es. { A: [...], B: [...], ... }
};

@Component({
  selector: 'app-admin-classifiche',
  templateUrl: './admin-classifiche.html',
  styleUrls: ['./admin-classifiche.css'],
  standalone: false,
})
export class AdminClassificheComponent implements OnInit {
  teams: Team[] = [];
  selectedTeamCount: number = 16;
  filteredTeams: Team[] = [];
  matchList: Match[] = [];

  availableDates: string[] = ['2025-08-31', '2025-09-12', '2025-10-12'];
  selectedDate: string = this.availableDates[0];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadTeams();
  }

  onDateChange() {
  this.loadTeams();
}

loadTeams() {
  const url = `http://localhost:3000/registrations/${this.selectedDate}`;
  this.http.get<Team[]>(url).subscribe({
    next: (data) => {
      console.log(`✅ Squadre caricate da ${url}:`, data);
      this.teams = data;
      this.updateFilteredTeams();
      this.aggiornaGironi();
    },
    error: (err) => {
      console.error(`❌ Errore nel caricamento file ${url}`, err);
      this.teams = [];
      this.filteredTeams = [];
    }
  });
}

gironi: Gironi = { A: [], B: [], C: [], D: [] };
assegnazioni: { [teamName: string]: string } = {}; // es. { "Squadra Gialla": "B" }

onAssignGirone(teamName: string, girone: string) {
  console.log(`Assegnata ${teamName} al girone ${girone}`);
  this.assegnazioni[teamName] = girone;
  this.aggiornaGironi();
}

aggiornaGironi() {
  this.gironi = { A: [], B: [], C: [], D: [] };
  for (const team of this.filteredTeams) {
    const girone = this.assegnazioni[team.teamName];
    if (girone) {
      this.gironi[girone].push(team);
    }
  }
}

generaMatchGironi() {
  this.matchList = [];
  let round = 1;

  const gironiKeys = Object.keys(this.gironi).filter(g => this.gironi[g].length === 3);
  const matchPerGirone = (girone: string, squadre: Team[]): Match[] => [
    {
      girone,
      teamA: squadre[0].teamName,
      teamB: squadre[1].teamName,
      referee: squadre[2].teamName,
      field: this.getFieldForGirone(girone),
      round: 0 // sarà assegnato dopo
    },
    {
      girone,
      teamA: squadre[0].teamName,
      teamB: squadre[2].teamName,
      referee: squadre[1].teamName,
      field: this.getFieldForGirone(girone),
      round: 0
    },
    {
      girone,
      teamA: squadre[1].teamName,
      teamB: squadre[2].teamName,
      referee: squadre[0].teamName,
      field: this.getFieldForGirone(girone),
      round: 0
    }
  ];

  // raccogli tutti i match divisi per girone
  const matchQueue: Match[][] = gironiKeys.map(key => matchPerGirone(key, this.gironi[key]));

  // interleaving round-based
  for (let i = 0; i < 3; i++) {
    for (let g = 0; g < matchQueue.length; g++) {
      const match = matchQueue[g][i];
      match.round = round;
      this.matchList.push(match);
    }
    round++;
  }

  console.log("🗓️ Match generati:", this.matchList);
}

getFieldForGirone(girone: string): number {
  const mapping: { [key: string]: number } = { A: 1, B: 2, C: 3, D: 4 };
  return mapping[girone] || 0;
}


handleSelectChange(event: Event, teamName: string) {
  const selectElement = event.target as HTMLSelectElement;
  const girone = selectElement.value;
  this.onAssignGirone(teamName, girone);
}

  updateFilteredTeams() {
    this.filteredTeams = this.teams.slice(0, this.selectedTeamCount);
  }

  onTeamCountChange() {
    this.updateFilteredTeams();
  }
}