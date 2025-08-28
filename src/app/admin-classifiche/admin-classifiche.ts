import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TournamentService } from '../services/tournament';


interface Team {
  teamName: string;
  players: string[];
  
}

interface Match {
  id: string;
  girone: string;     // A, B, C, D
  teamA: string;
  teamB: string;
  referee: string;
  field: number;
  round: number;
  score: { puntiA: number; puntiB: number };
}

interface TeamStats {
  team: string;
  vittorie: number;
  partiteGiocate: number;
  coeffVS: number;     // vittorie / partite giocate
  puntiTotali: number;  // somma punti segnati (non i 3 pt per vittoria)
  diffPunti: number;   // punti fatti - subiti
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

  availableDates: string[] = ['2025-08-31', '2025-09-12', '2025-10-05'];
  selectedDate: string = this.availableDates[0];

  strutturaGironiSuggerita: { [key: string]: number } = {};
  gironiLettere: string[] = ['A', 'B', 'C', 'D'];

  displayedColumns: { [girone: string]: string[] } = {};
  displayedColumnsGenerale: string[] = ['rank','team','girone','coeffVS','puntiTotali','diffPunti'];

  

  constructor(private http: HttpClient, private tournament: TournamentService) {}

  private findMatchId(girone: string, teamA: string, teamB: string): string | null {
  const m = this.matchList.find(x =>
    x.girone === girone &&
    ((x.teamA === teamA && x.teamB === teamB) || (x.teamA === teamB && x.teamB === teamA))
  );
  return m ? m.id : null;
  }

ngOnInit() {
  this.loadTeams();

  // 👇 carico subito lo stato del torneo per la data selezionata
  this.tournament.getTournament(this.selectedDate).subscribe({
    next: (data: any) => {
      // normalizza gironi
      this.gironi = { A: [], B: [], C: [], D: [] };

      for (const g of Object.keys(data.groups || {})) {
        this.gironi[g] = (data.groups[g] || []).map((t: any) =>
          typeof t === 'string' ? { teamName: t, players: [] } : t
        );
      }

      // ricostruisci assegnazioni
      this.assegnazioni = {};
      for (const g of Object.keys(this.gironi)) {
        for (const team of this.gironi[g]) {
          this.assegnazioni[team.teamName] = g;
        }
      }

      // ripristina match
      this.matchList = data.matches || [];

      // ricostruzione risultatiGironi
      this.risultatiGironi = {};
      for (const matchId in data.results || {}) {
        const r = data.results[matchId];
        const girone = r.girone || this.matchList.find(m => m.id === matchId)?.girone;
        if (!girone) continue;

        if (!this.risultatiGironi[girone]) this.risultatiGironi[girone] = {};
        if (!this.risultatiGironi[girone][r.teamA]) this.risultatiGironi[girone][r.teamA] = {};
        if (!this.risultatiGironi[girone][r.teamB]) this.risultatiGironi[girone][r.teamB] = {};

        this.risultatiGironi[girone][r.teamA][r.teamB] = { puntiA: r.puntiA, puntiB: r.puntiB };
        this.risultatiGironi[girone][r.teamB][r.teamA] = { puntiA: r.puntiB, puntiB: r.puntiA };
      }

      console.log('📊 Stato torneo ricaricato all\'avvio:', data);
    },
    error: (e: any) => {
      console.error('❌ Errore caricamento torneo all\'avvio', e);
      this.gironi = { A:[], B:[], C:[], D:[] };
      this.assegnazioni = {};
      this.matchList = [];
      this.risultatiGironi = {};
    }
  });
}

onDateChange() {
  this.loadTeams();

  this.tournament.getTournament(this.selectedDate).subscribe({
    next: (data: any) => {
      // ✅ normalizza gironi (stringhe → Team[])
      this.gironi = { A: [], B: [], C: [], D: [] };

      for (const g of Object.keys(data.groups || {})) {
        this.gironi[g] = (data.groups[g] || []).map((t: any) =>
          typeof t === 'string' ? { teamName: t, players: [] } : t
        );
      }
      // costruisci le colonne per ogni girone
      for (const g of Object.keys(this.gironi)) {
        this.displayedColumns[g] = [
          'num',
          'teamName',
          ...this.gironi[g].map((_, j) => 'col' + j),
          'wins',
          'diff',
          'points'
        ];
      }

      // ✅ ricostruisco assegnazioni (per i <select>)
      this.assegnazioni = {};
      for (const g of Object.keys(this.gironi)) {
        for (const team of this.gironi[g]) {
          this.assegnazioni[team.teamName] = g;
        }
      }

      // ✅ ripristino match
      this.matchList = data.matches || [];

      // ✅ ricostruzione risultatiGironi in formato tabella
      this.risultatiGironi = {};
      for (const matchId in data.results || {}) {
        const r = data.results[matchId];
        const girone = r.girone || this.matchList.find(m => m.id === matchId)?.girone;
        if (!girone) continue;

        if (!this.risultatiGironi[girone]) this.risultatiGironi[girone] = {};
        if (!this.risultatiGironi[girone][r.teamA]) this.risultatiGironi[girone][r.teamA] = {};
        if (!this.risultatiGironi[girone][r.teamB]) this.risultatiGironi[girone][r.teamB] = {};

        this.risultatiGironi[girone][r.teamA][r.teamB] = { puntiA: r.puntiA, puntiB: r.puntiB };
        this.risultatiGironi[girone][r.teamB][r.teamA] = { puntiA: r.puntiB, puntiB: r.puntiA };
      }

      console.log('📊 Stato torneo ricaricato:', data);
    },
    error: (e: any) => {
      console.error('❌ Errore caricamento torneo', e);
      this.gironi = { A:[], B:[], C:[], D:[] };
      this.assegnazioni = {};
      this.matchList = [];
      this.risultatiGironi = {};
    }
  });
}



loadTeams() {
  this.tournament.getTeams(this.selectedDate).subscribe({
    next: (data: any[]) => {
      console.log(`✅ Squadre caricate da server per ${this.selectedDate}:`, data);
      this.teams = data;
      this.updateFilteredTeams();
      this.aggiornaGironi();
    },
    error: (err: any) => {
      console.error(`❌ Errore nel caricamento squadre per ${this.selectedDate}`, err);
      this.teams = [];
      this.filteredTeams = [];
      
    }
  });
}

private buildGroupsPayload(): Record<string, string[]> {
  return {
    A: (this.gironi['A'] || []).map(t => t.teamName),
    B: (this.gironi['B'] || []).map(t => t.teamName),
    C: (this.gironi['C'] || []).map(t => t.teamName),
    D: (this.gironi['D'] || []).map(t => t.teamName),
  };
}

private saveGroupsDebounce?: any;

salvaGironiServer() {
  const payload = this.buildGroupsPayload();
  this.tournament.saveGroups(this.selectedDate, payload).subscribe({
    next: () => console.log('✅ Gironi salvati su server'),
    error: (e: any) => console.error('❌ Salvataggio gironi fallito', e)
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
  this.assegnazioni[teamName] = girone;
  this.aggiornaGironi();

  clearTimeout(this.saveGroupsDebounce);
  this.saveGroupsDebounce = setTimeout(() => this.salvaGironiServer(), 400);
}

// 🔢 Garantisco che round/field siano numeri e ordino prima di raggruppare
private normalizeAndSortMatches(list: Match[]): Match[] {
  return [...(list || [])]
    .map(m => ({
      ...m,
      round: Number((m as any).round),
      field: Number((m as any).field)
    }))
    .sort((a, b) =>
      a.round - b.round ||
      a.field - b.field ||
      a.girone.localeCompare(b.girone)
    );
}

// 👇 Gruppo i match per round in modo affidabile
getGroupedRounds(): { round: number; matches: Match[] }[] {
  const sorted = this.normalizeAndSortMatches(this.matchList);
  const byRound: Record<number, Match[]> = {};

  for (const m of sorted) {
    if (!byRound[m.round]) byRound[m.round] = [];
    byRound[m.round].push(m);
  }

  return Object.keys(byRound)
    .map(r => ({ round: Number(r), matches: byRound[Number(r)] }))
    .sort((a, b) => a.round - b.round);
}

// Evita che Angular ricicli DOM tra round diversi
trackMatch = (_: number, m: Match) =>
  m.id ?? `${m.girone}-${m.teamA}-${m.teamB}-${m.round}-${m.field}`;

assegnaGironiAutomaticamente() {
  this.assegnazioni = {};
  const squadre = [...this.filteredTeams];
  let index = 0;
  for (const girone of this.gironiLettere) {
    const n = this.strutturaGironiSuggerita[girone] || 0;
    for (let i = 0; i < n; i++) {
      const team = squadre[index++];
      if (team) this.assegnazioni[team.teamName] = girone;
    }
  }
  this.aggiornaGironi();
  this.salvaGironiServer();
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
  // costruisci le colonne per ogni girone
  for (const g of Object.keys(this.gironi)) {
    this.displayedColumns[g] = [
      'num',
      'teamName',
      ...this.gironi[g].map((_, j) => 'col' + j),
      'wins',
      'diff',
      'points'
    ];
  }
}

generaMatchGironi() {
  this.tournament.generateMatches(this.selectedDate).subscribe({
    next: (res: any) => {
      const raw = Array.isArray(res?.matches) ? res.matches : [];

      // 🔧 Coercizza i numeri + id stabile per trackBy
      this.matchList = raw.map((m: any) => ({
        ...m,
        round: Number(m?.round),
        field: Number(m?.field),
        id: `${m.girone}-${m.teamA}-${m.teamB}-${m.round}-${m.field}`
      }));

      // (Opzionale) log di verifica: tutti number?
      console.log(
        '🗓️ Match generati dal server (normalizzati):',
        this.matchList.map(x => ({ round: x.round, field: x.field, girone: x.girone, A: x.teamA, B: x.teamB }))
      );
    },
    error: (e: any) => console.error('❌ Errore generazione match', e)
  });
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

calcolaDiffVS(girone: string, team: string): string {
  const vittorie = this.calcolaVittorie(girone, team);
  const partiteGiocate = (this.gironi[girone]?.length || 0) - 1;

  if (partiteGiocate <= 0) return "0.00"; // sicurezza

  const coeff = vittorie / partiteGiocate;
  return coeff.toFixed(2);
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

calcolaPuntiFatti(girone: string, team: string): number {
  const dati = this.risultatiGironi[girone]?.[team] || {};
  let fatti = 0;
  for (const d of Object.values(dati)) {
    if (d.puntiA != null && d.puntiB != null) {
      fatti += d.puntiA;
    }
  }
  return fatti;
}

calcolaPuntiTotali(girone: string, team: string): number {
  return this.calcolaVittorie(girone, team) * 3;
}

getClassificaGirone(girone: string): TeamStats[] {
  const squadre = this.gironi[girone] || [];

  const stats: TeamStats[] = squadre.map(sq => {
    const name = sq.teamName;

    // Partite giocate = (numero squadre del girone) - 1
    const partiteGiocate = Math.max(0, (squadre.length || 0) - 1);
    const vittorie = this.calcolaVittorie(girone, name);

    const coeffVS = partiteGiocate > 0 ? (vittorie / partiteGiocate) : 0;

    const puntiTotali = this.calcolaPuntiTotali(girone, name);           // 👈 tie-breaker #2
    const diffPunti = this.calcolaDifferenzaPunti(girone, name);       // 👈 tie-breaker #3
    

    return {
      team: name,
      vittorie,
      partiteGiocate,
      coeffVS,
      puntiTotali,
      diffPunti
    };
  });

  // Ordinamento: coeffVS desc, puntiFatti desc, diffPunti desc, poi nome asc
  stats.sort((a, b) =>
    (b.coeffVS - a.coeffVS) ||
    (b.puntiTotali - a.puntiTotali) ||
    (b.diffPunti - a.diffPunti) ||
    a.team.localeCompare(b.team)
  );

  return stats;
}

getClassificaGenerale(): Array<{
  team: string;
  girone: string;
  vittorie: number;
  partiteGiocate: number;
  coeffVS: number;
  puntiTotali: number;
  diffPunti: number;
}> {
  const out: Array<{
    team: string;
    girone: string;
    vittorie: number;
    partiteGiocate: number;
    coeffVS: number;
    puntiTotali: number;
    diffPunti: number;
  }> = [];

  for (const g of this.gironiLettere) {
    const sq = this.gironi[g] || [];
    for (const s of sq) {
      const name = s.teamName;
      const partiteGiocate = Math.max(0, (sq.length || 0) - 1);
      const vittorie = this.calcolaVittorie(g, name);
      const coeffVS = partiteGiocate > 0 ? (vittorie / partiteGiocate) : 0;
      const puntiTotali = this.calcolaPuntiTotali(g, name);
      const diffPunti = this.calcolaDifferenzaPunti(g, name);

      out.push({
        team: name,
        girone: g,
        vittorie,
        partiteGiocate,
        coeffVS,
        puntiTotali,
        diffPunti
      });
    }
  }

  out.sort((a, b) =>
    (b.coeffVS - a.coeffVS) ||
    (b.puntiTotali - a.puntiTotali) ||
    (b.diffPunti - a.diffPunti) ||
    a.team.localeCompare(b.team)
  );

  return out;
}

getColumnsForGirone(girone: string): string[] {
  const n = this.gironi[girone]?.length || 0;
  const dynamic = Array.from({ length: n }, (_, j) => 'vs' + j);
  return ['index','teamName', ...dynamic, 'diffVS','puntiTotali','diffPunti'];
}

getClassificheTuttiGironi(): Record<string, TeamStats[]> {
  const out: Record<string, TeamStats[]> = {};
  for (const g of this.gironiLettere) {
    if (this.gironi[g]?.length) out[g] = this.getClassificaGirone(g);
  }
  return out;
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

  let puntiA: number | null = null;
  let puntiB: number | null = null;

  if (input.trim().toUpperCase() === 'V') {
    puntiA = 21; puntiB = 0;
  } else {
    const punti = parseInt(input, 10);
    if (!isNaN(punti)) { puntiA = punti; puntiB = 21; }
  }

  this.risultatiGironi[girone][teamA][teamB] = { puntiA, puntiB };
  this.risultatiGironi[girone][teamB][teamA] = { puntiA: puntiB, puntiB: puntiA };

  // 🔗 salva anche sul backend
  const matchId = this.findMatchId(girone, teamA, teamB);
  if (matchId && puntiA != null && puntiB != null) {
    this.tournament.saveResult(this.selectedDate, matchId, puntiA, puntiB).subscribe({
      next: (res: any) => console.log('✅ Risultato salvato su server', res),
      error: (e: any) => console.error('❌ Errore salvataggio risultato', e)
    });
  }
}

generaStrutturaGironi(): { [key: string]: number } {
  const totalTeams = this.selectedTeamCount;
  const struttura: { [key: string]: number } = {};

  switch (totalTeams) {
    case 12:
      struttura['A'] = 4;
      struttura['B'] = 4;
      struttura['C'] = 4;
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

  getMatchesGroupedByRound(): { round: number, matches: Match[] }[] {
    const grouped: { round: number, matches: Match[] }[] = [];
    const matchesSorted = [...this.matchList].sort((a, b) => a.round - b.round);

    let currentRound = 1;
    let buffer: Match[] = [];

    for (const match of matchesSorted) {
      buffer.push(match);

      // quando buffer raggiunge 4 partite, o è l’ultima iterazione, pushiamo il round
      if (buffer.length === 4) {
        grouped.push({ round: currentRound++, matches: buffer });
        buffer = [];
      }
    }

    // aggiungi l’eventuale "avanzo" (tipo 3 match se ci sono 3 gironi)
    if (buffer.length > 0) {
      grouped.push({ round: currentRound++, matches: buffer });
    }

    return grouped;
  }

}