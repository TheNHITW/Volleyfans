import { Component, OnDestroy, OnInit } from '@angular/core';
// ⬇️ ADATTA IL PATH in base a dove sta davvero il tuo TournamentService
import { TournamentService } from '../services/tournament'; // es: '../services/tournament.service'

interface Cell {
  text: string;
  cls?: string;
}

type RoundGroup = { round: number; matches: any[] };

@Component({
  selector: 'app-risultati-live',
  templateUrl: './risultati-live.html',
  styleUrls: ['./risultati-live.css'],
  standalone: false
})
export class RisultatiLiveComponent implements OnInit, OnDestroy {
  selectedDate = '2025-08-31';
  state: any = null;

  // Classifica Generale (Material)
  displayedColumnsGenerale = ['rank','team', 'pt','girone','giocate','vittorie','pf','ps','diff'];

  constructor(private tournament: TournamentService) {}

  ngOnInit(): void {
    this.tournament.connectLive(this.selectedDate);
    this.tournament.liveState().subscribe(s => this.state = s);
  }

  ngOnDestroy(): void {
    this.tournament.disconnectLive();
  }

  // ---------- HELPERS ----------
  private nameOf(t: any): string {
    if (t == null) return '';
    return (typeof t === 'string') ? t : (t.teamName ?? t.name ?? String(t));
  }

  /** Composizione gironi */
  groupEntries(): Array<{ key: string; teams: string[] }> {
    const groups = this.state?.tournament?.groups || {};
    return Object.keys(groups).sort().map(key => ({
      key,
      teams: (groups[key] || [])
        .map((t: any) => this.nameOf(t))
        .sort((a: string, b: string) => a.localeCompare(b))
    }));
  }

  /** Sezione per ogni girone: matrice + stats di riga + risultati per round */
  resultSections(): Array<{
    key: string;
    teams: string[];
    rows: Cell[][];
    stats: Array<{ v: number; s: number; puntiTotali: number; diffPunti: number }>;
    rounds: RoundGroup[];
  }> {
    const groups = this.state?.tournament?.groups || {};
    const allMatches: any[] = (this.state?.tournament?.matches || [])
      .filter((m: any) => m?.scoreA != null && m?.scoreB != null);

    // indicizza match per girone e per coppia squadra
    type Rec = { a: string; b: string; sA: number; sB: number };
    const byGroupPair: Record<string, Map<string, Rec>> = {};
    const byGroupRounds: Record<string, Map<number, any[]>> = {};
    const pairKey = (x: string, y: string) => (x < y) ? `${x}||${y}` : `${y}||${x}`;

    for (const m of allMatches) {
      const g = m.girone;
      if (!byGroupPair[g]) byGroupPair[g] = new Map();
      byGroupPair[g].set(pairKey(m.teamA, m.teamB), {
        a: m.teamA, b: m.teamB, sA: Number(m.scoreA), sB: Number(m.scoreB)
      });

      if (!byGroupRounds[g]) byGroupRounds[g] = new Map();
      const r = Number(m.round) || 0;
      const arr = byGroupRounds[g].get(r) || [];
      arr.push(m);
      byGroupRounds[g].set(r, arr);
    }

    const out: Array<{
      key: string; teams: string[]; rows: Cell[][];
      stats: Array<{ v: number; s: number; puntiTotali: number; diffPunti: number }>;
      rounds: RoundGroup[];
    }> = [];

    for (const g of Object.keys(groups).sort()) {
      const teams = (groups[g] || [])
        .map((t: any) => this.nameOf(t))
        .sort((a: string, b: string) => a.localeCompare(b));

      // stats per riga squadra (come in admin: Diff V/S, Punti totali = PF, Diff punti = PF-PS)
      const stats = teams.map(() => ({ v: 0, s: 0, puntiTotali: 0, diffPunti: 0 }));
      const grid: Cell[][] = [];

      for (let i = 0; i < teams.length; i++) {
        const row: Cell[] = [];
        for (let j = 0; j < teams.length; j++) {
          if (i === j) { row.push({ text: '■', cls: 'diag' }); continue; }

          const tR = teams[i], tC = teams[j];
          const rec = byGroupPair[g]?.get(pairKey(tR, tC));
          if (!rec) { row.push({ text: '—', cls: 'empty' }); continue; }

          // punteggio dal punto di vista della riga
          const rsA = (rec.a === tR) ? rec.sA : rec.sB;
          const rsB = (rec.a === tR) ? rec.sB : rec.sA;
          let cls: Cell['cls'] = 'draw';
          if (rsA > rsB) cls = 'win';
          else if (rsA < rsB) cls = 'loss';
          row.push({ text: `${rsA}–${rsB}`, cls });

          // aggiorna stats
          stats[i].puntiTotali += rsA;
          stats[i].diffPunti   += (rsA - rsB);
          if (rsA > rsB) stats[i].v++;
          else if (rsA < rsB) stats[i].s++;
        }
        grid.push(row);
      }

      // rounds (ordinati) per pannello a destra
      const rounds: RoundGroup[] = Array.from(byGroupRounds[g]?.entries() || [])
        .sort((a, b) => a[0] - b[0])
        .map(([round, arr]) => ({
          round,
          matches: arr.slice().sort((x: any, y: any) =>
            (x.field ?? 0) - (y.field ?? 0) || String(x.teamA).localeCompare(String(y.teamA))
          )
        }));

      out.push({ key: g, teams, rows: grid, stats, rounds });
    }

    return out;
  }

  /** Classifica generale (invariata) */
  globalStandings(): Array<{ team: string; girone: string; giocate: number; vittorie: number; pf: number; ps: number; diff: number; pt: number; }> {
    const st = this.state?.tournament?.standings || {};
    const out: any[] = [];
    for (const g of Object.keys(st)) {
      for (const row of st[g] || []) {
        out.push({
          team: row.teamName ?? row.team ?? '',
          girone: g,
          giocate: row.giocate ?? 0,
          vittorie: row.vittorie ?? row.wins ?? 0,
          pf: row.pf ?? 0,
          ps: row.ps ?? row.pa ?? 0,
          diff: row.diff ?? ((row.pf ?? 0) - (row.ps ?? row.pa ?? 0)),
          pt: row.pt ?? row.points ?? ((row.vittorie ?? row.wins ?? 0) * 3),
        });
      }
    }
    out.sort((a, b) => {
      if (b.pt !== a.pt) return b.pt - a.pt;
      if (b.vittorie !== a.vittorie) return b.vittorie - a.vittorie;
      if (b.diff !== a.diff) return b.diff - a.diff;
      if (b.pf !== a.pf) return b.pf - a.pf;
      return a.team.localeCompare(b.team);
    });
    return out;
  }
}
