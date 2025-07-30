import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  strutturaGironiSuggerita: { [key: string]: number } = {};
  gironiLettere: string[] = ['A', 'B', 'C', 'D'];

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadTeams();
  }

  onDateChange() {
  this.loadTeams();
}

loadTeams() {
  const url = `https://volleyfans-bh.onrender.com/registrations/${this.selectedDate}`;
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
risultatiGironi: {
  [girone: string]: {
    [teamA: string]: {
      [teamB: string]: { puntiA: number | null, puntiB: number | null }
    }
  }
} = {};

onAssignGirone(teamName: string, girone: string) {
  console.log(`Assegnata ${teamName} al girone ${girone}`);
  this.assegnazioni[teamName] = girone;
  this.aggiornaGironi();
  
}

assegnaGironiAutomaticamente() {
  this.assegnazioni = {}; // reset
  const squadre = [...this.filteredTeams]; // copia per sicurezza
  let index = 0;

  for (const girone of this.gironiLettere) {
    const n = this.strutturaGironiSuggerita[girone] || 0;
    for (let i = 0; i < n; i++) {
      const team = squadre[index++];
      if (team) {
        this.assegnazioni[team.teamName] = girone;
      }
    }
  }

  this.aggiornaGironi();
}

initRisultatiGironi() {
  this.risultatiGironi = {};

  for (const girone of Object.keys(this.gironi)) {
    const squadre = this.gironi[girone];
    this.risultatiGironi[girone] = {};

    for (let i = 0; i < squadre.length; i++) {
      const teamA = squadre[i].teamName;
      this.risultatiGironi[girone][teamA] = {};

      for (let j = 0; j < squadre.length; j++) {
        if (i !== j) {
          const teamB = squadre[j].teamName;
          this.risultatiGironi[girone][teamA][teamB] = { puntiA: null, puntiB: null };
        }
      }
    }
  }
}

aggiornaGironi() {
  this.gironi = { A: [], B: [], C: [], D: [] };
  for (const team of this.filteredTeams) {
    const girone = this.assegnazioni[team.teamName];
    if (girone) {
      this.gironi[girone].push(team);
      this.initRisultatiGironi();
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

generaPDF() {
  const doc = new jsPDF();

  // Titolo
  doc.setFontSize(18);
  doc.text('Report Torneo VolleyFans', 14, 20);

  // Data
  doc.setFontSize(12);
  doc.text(`Data torneo: ${this.selectedDate}`, 14, 28);
  doc.text(`Numero squadre selezionate: ${this.filteredTeams.length}`, 14, 36);

  // Lista squadre
  const squadreRows = this.filteredTeams.map((team, index) => [index + 1, team.teamName]);
  autoTable(doc, {
    startY: 42,
    head: [['#', 'Nome Squadra']],
    body: squadreRows,
    theme: 'grid',
    styles: { fontSize: 10 }
  });

  // Assegnazione gironi
  doc.addPage();
  doc.text('Assegnazione squadre ai gironi', 14, 20);
  const gironeData: any[] = [];
  for (const lettera of ['A', 'B', 'C', 'D']) {
    this.gironi[lettera].forEach(team => {
      gironeData.push([lettera, team.teamName]);
    });
  }
  autoTable(doc, {
    startY: 28,
    head: [['Girone', 'Squadra']],
    body: gironeData,
    theme: 'grid',
    styles: { fontSize: 10 }
  });

  // Match list
  doc.addPage();
  doc.text('Calendario Match Gironi', 14, 20);
  const matchRows = this.matchList.map((match, index) => [
    match.round,
    match.girone,
    match.teamA,
    match.teamB,
    match.referee,
    match.field
  ]);
  autoTable(doc, {
    startY: 28,
    head: [['Round', 'Girone', 'Team A', 'Team B', 'Arbitro', 'Campo']],
    body: matchRows,
    theme: 'grid',
    styles: { fontSize: 10 }
  });

  // Salva
  doc.save(`torneo-volleyfans-${this.selectedDate}.pdf`);
}

generaPDFRisultati() {
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Risultati Torneo VolleyFans – ${this.selectedDate}`, 14, 20);

  this.gironiLettere.forEach((gironeLettera, index) => {
    const girone = this.gironi[gironeLettera];
    if (!girone?.length) return;

    doc.addPage();
    doc.text(`Girone ${gironeLettera}`, 14, 20);

    const headerRow = ['Squadra', ...girone.map(s => s.teamName), 'Vittorie', 'Diff. Punti', 'Punti'];
    const bodyRows: any[] = [];

    for (let i = 0; i < girone.length; i++) {
      const squadraRow = girone[i];
      const row: any[] = [squadraRow.teamName];

      for (let j = 0; j < girone.length; j++) {
        if (i === j) {
          row.push('—');
        } else {
          const risultato = this.risultatiGironi[gironeLettera]?.[squadraRow.teamName]?.[girone[j].teamName];
          if (risultato?.puntiA === 21) {
            row.push('V');
          } else if (typeof risultato?.puntiA === 'number') {
            row.push(risultato.puntiA);
          } else {
            row.push('');
          }
        }
      }

      row.push(
        this.calcolaVittorie(gironeLettera, squadraRow.teamName),
        this.calcolaDifferenzaPunti(gironeLettera, squadraRow.teamName),
        this.calcolaPuntiTotali(gironeLettera, squadraRow.teamName)
      );

      bodyRows.push(row);
    }

    autoTable(doc, {
      startY: 28,
      head: [headerRow],
      body: bodyRows,
      styles: { fontSize: 10 },
      theme: 'grid'
    });
  });

  doc.save(`classifiche-${this.selectedDate}.pdf`);
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
  this.strutturaGironiSuggerita = this.generaStrutturaGironi();
}

getInputValue(event: Event): string {
  return (event.target as HTMLInputElement).value;
}

calcolaVittorie(girone: string, team: string): number {
  const dati = this.risultatiGironi[girone]?.[team] || {};
  return Object.values(dati).filter(d => d.puntiA != null && d.puntiB != null && d.puntiA > d.puntiB).length;
}

calcolaDifferenzaPunti(girone: string, team: string): number {
  const dati = this.risultatiGironi[girone]?.[team] || {};
  let diff = 0;
  for (const d of Object.values(dati)) {
    if (d.puntiA != null && d.puntiB != null) {
      diff += d.puntiA - d.puntiB;
    }
  }
  return diff;
}

calcolaPuntiTotali(girone: string, team: string): number {
  return this.calcolaVittorie(girone, team) * 3;
}

getDisplayValue(girone: string, teamA: string, teamB: string): string | number {
  const match = this.risultatiGironi[girone]?.[teamA]?.[teamB];
  if (!match) return '';
  if (match.puntiA === 21) return 'V';
  return match.puntiA ?? '';
}

aggiornaRisultatoConVittoria(girone: string, teamA: string, teamB: string, input: string) {
  if (!this.risultatiGironi[girone]) this.risultatiGironi[girone] = {};
  if (!this.risultatiGironi[girone][teamA]) this.risultatiGironi[girone][teamA] = {};
  if (!this.risultatiGironi[girone][teamB]) this.risultatiGironi[girone][teamB] = {};

  if (input.trim().toUpperCase() === 'V') {
    this.risultatiGironi[girone][teamA][teamB] = { puntiA: 21, puntiB: null };
    this.risultatiGironi[girone][teamB][teamA] = { puntiA: null, puntiB: 21 };
  } else {
    const punti = parseInt(input, 10);
    if (!isNaN(punti)) {
      this.risultatiGironi[girone][teamA][teamB] = { puntiA: punti, puntiB: 21 };
      this.risultatiGironi[girone][teamB][teamA] = { puntiA: 21, puntiB: punti };
    }
  }
}
generaStrutturaGironi(): { [key: string]: number } {
  const totalTeams = this.selectedTeamCount;
  const struttura: { [key: string]: number } = {};

  switch (totalTeams) {
    case 12:
      struttura['A'] = 3;
      struttura['B'] = 3;
      struttura['C'] = 3;
      struttura['D'] = 3;
      break;
    case 13:
      struttura['A'] = 4;
      struttura['B'] = 3;
      struttura['C'] = 3;
      struttura['D'] = 3;
      break;
    case 14:
      struttura['A'] = 4;
      struttura['B'] = 4;
      struttura['C'] = 3;
      struttura['D'] = 3;
      break;
    case 15:
      struttura['A'] = 4;
      struttura['B'] = 4;
      struttura['C'] = 4;
      struttura['D'] = 3;
      break;
    case 16:
      struttura['A'] = 4;
      struttura['B'] = 4;
      struttura['C'] = 4;
      struttura['D'] = 4;
      break;
    default:
      console.warn("Numero di squadre non gestito.");
  }

  console.log("📌 Formula di gara suggerita:", struttura);
  return struttura;
  }
}