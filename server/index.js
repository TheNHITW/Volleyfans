const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ================== MIDDLEWARE ================== //
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../dist/volleyfans/browser')));

// ================== UTILITY FILE ================== //
function ensureDir() {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function getFilePathForDate(date) {
  return path.join(ensureDir(), `registrations-${date}.json`);
}
function getTournamentFile(date) {
  const dir = ensureDir();
  return path.join(dir, `tournament-${date}.json`);
}
function readTournament(date) {
  const filePath = getTournamentFile(date);
  if (!fs.existsSync(filePath)) {
    return { date, groups: {}, matches: [], results: {}, standings: {} };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}
function writeTournament(date, data) {
  fs.writeFileSync(getTournamentFile(date), JSON.stringify(data, null, 2));
}

// ================== PING ================== //
app.get('/ping', (req, res) => res.send('pong'));

// ================== REGISTRAZIONI ================== //
app.post('/register', (req, res) => {
  const newTeam = req.body;
  const dates = newTeam.selectedDates;

  if (!Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ success: false, message: 'Nessuna data selezionata.' });
  }

  dates.forEach(date => {
    const filePath = getFilePathForDate(date);
    const registrations = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath, 'utf8'))
      : [];
    registrations.push(newTeam);
    fs.writeFileSync(filePath, JSON.stringify(registrations, null, 2));
  });

  res.json({ success: true, message: 'Iscrizione registrata.' });
});

app.get('/admin/registrations', (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ success: false, message: 'Data mancante.' });

  const filePath = getFilePathForDate(date);
  if (!fs.existsSync(filePath)) return res.json([]);

  const registrations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  res.json(registrations);
});

app.delete('/admin/registrations/:teamName', (req, res) => {
  const teamToDelete = decodeURIComponent(req.params.teamName).trim().toLowerCase();
  const date = req.query.date;
  if (!date) return res.status(400).json({ success: false, message: 'Parametro "date" mancante.' });

  const filePath = getFilePathForDate(date);
  if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, message: 'Nessun file per questa data.' });

  const registrations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const updated = registrations.filter(t => t.teamName.trim().toLowerCase() !== teamToDelete);

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  res.json({ success: true, message: `Squadra eliminata per ${date}.` });
});

// ================== CONFIG ================== //
const configFile = path.join(ensureDir(), 'config.json');
function getConfig() {
  if (!fs.existsSync(configFile)) fs.writeFileSync(configFile, JSON.stringify({ isRegistrationOpen: true }, null, 2));
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}
function setConfig(newConfig) {
  fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));
}
app.get('/config', (req, res) => res.json(getConfig()));
app.post('/config/registration', (req, res) => {
  const { isRegistrationOpen } = req.body;
  const config = getConfig();
  config.isRegistrationOpen = isRegistrationOpen;
  setConfig(config);
  res.json({ success: true });
});
app.post('/admin/toggle-registration', (req, res) => {
  const config = getConfig();
  config.isRegistrationOpen = !config.isRegistrationOpen;
  setConfig(config);
  res.json({ success: true, isRegistrationOpen: config.isRegistrationOpen });
});

// ================== APERIVOLLEY ================== //
app.post('/aperivolley', (req, res) => {
  const partecipante = req.body;
  const filePath = path.join(ensureDir(), 'aperivolley.json');
  const esistenti = fs.existsSync(filePath) ? JSON.parse(fs.readFileSync(filePath)) : [];
  esistenti.push(partecipante);
  fs.writeFileSync(filePath, JSON.stringify(esistenti, null, 2));
  res.json({ success: true });
});

// ================== GESTIONE TORNEO ================== //
app.post('/admin/:date/groups', (req, res) => {
  const { date } = req.params;
  const groups = req.body;
  const data = readTournament(date);
  data.groups = groups;
  writeTournament(date, data);
  res.json({ success: true, groups });
});

app.post('/admin/:date/matches', (req, res) => {
  const { date } = req.params;
  const data = readTournament(date);
  const matches = generateMatchesForAllGroups(data.groups || {});
  data.matches = matches;
  writeTournament(date, data);
  res.json({ success: true, matches });
});

// 🔥 SALVATAGGIO RISULTATO con ordine fisso (match.teamA / match.teamB)
app.post('/admin/:date/result', (req, res) => {
  const { date } = req.params;
  const { matchId, puntiA, puntiB } = req.body;
  const data = readTournament(date);

  const match = (data.matches || []).find(m => m.id === matchId);
  if (!match) {
    return res.status(404).json({ success: false, message: 'Match non trovato' });
  }

  // Conversione sicura a numeri
  const a = Number(puntiA);
  const b = Number(puntiB);

  // 📝 Debug log
  console.log("📝 Salvataggio risultato", {
    matchId,
    teamA: match.teamA,
    teamB: match.teamB,
    puntiA: a,
    puntiB: b
  });

  // Salva SEMPRE nello stesso ordine
  match.score = { puntiA: a, puntiB: b };
  data.results[matchId] = {
    teamA: match.teamA,
    teamB: match.teamB,
    puntiA: a,
    puntiB: b
  };

  // Aggiorna standings
  data.standings = computeStandings(data);
  writeTournament(date, data);

  res.json({ success: true, match, standings: data.standings });
});


app.get('/admin/:date/tournament', (req, res) => {
  const { date } = req.params;
  res.json(readTournament(date));
});

app.get('/admin/:date/standings', (req, res) => {
  const { date } = req.params;
  const data = readTournament(date);
  // opzionale: ricalcolare sempre
  data.standings = computeStandings(data);
  writeTournament(date, data);
  res.json(data.standings || {});
});

// === PUBBLICO: stato live (sostituisci l'handler esistente) ===
app.get('/public/:date/state', (req, res) => {
  const date = req.params.date;

  // usa la stessa sorgente dei percorsi admin
  const data = readTournament(date); // { groups, matches, results, standings }

  // se standings mancano o vuoi essere sicuro, ricalcola e salva
  if (!data.standings || Object.keys(data.standings).length === 0) {
    data.standings = computeStandings(data);
    writeTournament(date, data);
  }

  // mappa MATCHES: da { score:{puntiA,puntiB} } a { scoreA, scoreB }
  const matchesLive = (data.matches || []).map(m => ({
    ...m,
    scoreA: m.score?.puntiA ?? null,
    scoreB: m.score?.puntiB ?? null,
  }));

  // calcola "giocate" per standings (quante partite con punteggio)
  const played = new Map(); // key: `${girone}:${team}` -> count
  for (const m of data.matches || []) {
    if (!m?.score) continue;
    const aKey = `${m.girone}:${m.teamA}`;
    const bKey = `${m.girone}:${m.teamB}`;
    played.set(aKey, (played.get(aKey) || 0) + 1);
    played.set(bKey, (played.get(bKey) || 0) + 1);
  }

  // mappa STANDINGS: nel formato atteso dalla pagina live
  const standingsLive = {};
  for (const g of Object.keys(data.standings || {})) {
    standingsLive[g] = (data.standings[g] || []).map(row => ({
      teamName: row.team,
      giocate: played.get(`${g}:${row.team}`) || 0,
      vittorie: row.wins,
      pf: row.pf,
      ps: row.pa,
      diff: row.diff,
      pt: row.points,
    }));
  }

  // opzionale: iscrizioni dal tuo archivio "data"
  const regPath = getFilePathForDate(date);
  const registrations = fs.existsSync(regPath)
    ? JSON.parse(fs.readFileSync(regPath, 'utf8'))
    : [];

  res.json({
    success: true,
    data: {
      registrations,
      tournament: {
        groups: data.groups || {},
        matches: matchesLive,
        standings: standingsLive,
      }
    }
  });
});

// Tutti i client collegati a questa data riceveranno notifiche sugli aggiornamenti
app.get('/public/:date/events', (req, res) => {
  const date = req.params.date;

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders && res.flushHeaders();

  if (!sseClients.has(date)) sseClients.set(date, new Set());
  sseClients.get(date).add(res);

  req.on('close', () => {
    sseClients.get(date)?.delete(res);
  });
});

// body: { id?:string, girone?:string, teamA?:string, teamB?:string, scoreA:number, scoreB:number }
app.post('/admin/:date/result', (req, res) => {
  const date = req.params.date;
  const { id, girone, teamA, teamB, scoreA, scoreB } = req.body || {};

  const state = loadTournamentState(date);

  // trova match per id o per (girone, teamA, teamB)
  let m = null;
  if (id) {
    m = (state.matches || []).find(x => x.id === id);
  } else if (girone && teamA && teamB) {
    m = (state.matches || []).find(x =>
      x.girone === girone &&
      ((x.teamA === teamA && x.teamB === teamB) || (x.teamA === teamB && x.teamB === teamA))
    );
  }

  if (!m) {
    return res.status(404).json({ success:false, message:'Match non trovato.' });
  }

  m.scoreA = Number(scoreA);
  m.scoreB = Number(scoreB);

  // ricalcola standings
  state.standings = computeStandings(state.groups, state.matches);

  saveTournamentState(date, state); // scrive e notifica SSE
  res.json({ success: true, data: { tournament: state } });
});


function generateMatchesForAllGroups(groups) {
  // --- NORMALIZZA nomi (gestisce sia string che {teamName}) ---
  const nameOf = (t) => (typeof t === 'string' ? t : (t && t.teamName) ? t.teamName : String(t));
  const groupKeys = Object.keys(groups || {}).sort();
  const LATE = { group: 'A', team: 'Se me la dai te l’appoggio', startRound: 4 }; // oppure null

  // Mappa "pura" solo con NOME squadra
  const pure = {};
  for (const g of groupKeys) {
    pure[g] = (groups[g] || []).map(nameOf);
  }

  const FIELDS_PER_ROUND = 4;

  // Helpers comuni
  const berger4 = (t) => [
    [[t[0], t[3]], [t[1], t[2]]], // blocco 1
    [[t[0], t[2]], [t[3], t[1]]], // blocco 2
    [[t[0], t[1]], [t[2], t[3]]], // blocco 3
  ];
  const rr3 = (t) => [
    [t[0], t[1]], // 1–2
    [t[1], t[2]], // 2–3
    [t[0], t[2]], // 1–3
  ];
  const idFor = (gKey, tA, tB) => {
    const arr = pure[gKey] || [];
    const i = arr.indexOf(tA), j = arr.indexOf(tB);
    const a = Math.min(i, j), b = Math.max(i, j);
    return `${gKey}-${a}-${b}`;
  };
  const g3RefOf = (teams, pair) => {
    const s = new Set(pair);
    return teams.find(x => !s.has(x)) || null;
  };

  // Conta formati
  const g4Keys = groupKeys.filter(k => (pure[k] || []).length === 4);
  const g3Keys = groupKeys.filter(k => (pure[k] || []).length === 3);

  // === SCENARIO 1 già presente: 1×G4 + 3×G3 (il tuo) ===
  if (g4Keys.length === 1 && g3Keys.length === 3 && FIELDS_PER_ROUND === 4) {
    const g4Key = g4Keys[0];
    const G4  = pure[g4Key].slice();
    const G3A = pure[g3Keys[0]].slice();
    const G3B = pure[g3Keys[1]].slice();
    const G3C = pure[g3Keys[2]].slice();

    const g4Pairs = berger4(G4);
    const A = rr3(G3A), B = rr3(G3B), C = rr3(G3C);

    const scheduled = [];

    // ROUND 1
    scheduled.push(
      { id:idFor(g4Key, g4Pairs[0][0][0], g4Pairs[0][0][1]), girone:g4Key, teamA:g4Pairs[0][0][0], teamB:g4Pairs[0][0][1], referee:G3C[0]||null, field:1, round:1 },
      { id:idFor(g4Key, g4Pairs[0][1][0], g4Pairs[0][1][1]), girone:g4Key, teamA:g4Pairs[0][1][0], teamB:g4Pairs[0][1][1], referee:G3C[1]||null, field:2, round:1 },
      { id:idFor(g3Keys[0], A[0][0], A[0][1]), girone:g3Keys[0], teamA:A[0][0], teamB:A[0][1], referee:g3RefOf(G3A, A[0]), field:3, round:1 },
      { id:idFor(g3Keys[1], B[0][0], B[0][1]), girone:g3Keys[1], teamA:B[0][0], teamB:B[0][1], referee:g3RefOf(G3B, B[0]), field:4, round:1 }
    );

    // ROUND 2
    scheduled.push(
      { id:idFor(g4Key, g4Pairs[1][0][0], g4Pairs[1][0][1]), girone:g4Key, teamA:g4Pairs[1][0][0], teamB:g4Pairs[1][0][1], referee:G3B[0]||null, field:1, round:2 },
      { id:idFor(g4Key, g4Pairs[1][1][0], g4Pairs[1][1][1]), girone:g4Key, teamA:g4Pairs[1][1][0], teamB:g4Pairs[1][1][1], referee:G3B[1]||null, field:2, round:2 },
      { id:idFor(g3Keys[2], C[0][0], C[0][1]), girone:g3Keys[2], teamA:C[0][0], teamB:C[0][1], referee:g3RefOf(G3C, C[0]), field:3, round:2 },
      { id:idFor(g3Keys[0], A[1][0], A[1][1]), girone:g3Keys[0], teamA:A[1][0], teamB:A[1][1], referee:g3RefOf(G3A, A[1]), field:4, round:2 }
    );

    // ROUND 3 (solo G3)
    scheduled.push(
      { id:idFor(g3Keys[0], A[2][0], A[2][1]), girone:g3Keys[0], teamA:A[2][0], teamB:A[2][1], referee:G4[0]||null, field:1, round:3 },
      { id:idFor(g3Keys[1], B[1][0], B[1][1]), girone:g3Keys[1], teamA:B[1][0], teamB:B[1][1], referee:G4[1]||null, field:2, round:3 },
      { id:idFor(g3Keys[2], C[1][0], C[1][1]), girone:g3Keys[2], teamA:C[1][0], teamB:C[1][1], referee:G4[2]||null, field:3, round:3 }
    );

    // ROUND 4
    scheduled.push(
      { id:idFor(g4Key, g4Pairs[2][0][0], g4Pairs[2][0][1]), girone:g4Key, teamA:g4Pairs[2][0][0], teamB:g4Pairs[2][0][1], referee:G3A[0]||null, field:1, round:4 },
      { id:idFor(g4Key, g4Pairs[2][1][0], g4Pairs[2][1][1]), girone:g4Key, teamA:g4Pairs[2][1][0], teamB:g4Pairs[2][1][1], referee:G3A[1]||null, field:2, round:4 },
      { id:idFor(g3Keys[1], B[2][0], B[2][1]), girone:g3Keys[1], teamA:B[2][0], teamB:B[2][1], referee:g3RefOf(G3B, B[2]), field:3, round:4 },
      { id:idFor(g3Keys[2], C[2][0], C[2][1]), girone:g3Keys[2], teamA:C[2][0], teamB:C[2][1], referee:g3RefOf(G3C, C[2]), field:4, round:4 }
    );

    return scheduled;
  }

  // === NUOVO SCENARIO 2: 2×G4 + 2×G3 ===
  if (g4Keys.length === 2 && g3Keys.length === 2 && FIELDS_PER_ROUND === 4) {
    const [g4AKey, g4BKey] = g4Keys;
    const [g3AKey, g3BKey] = g3Keys;

    const G4A = pure[g4AKey].slice();
    const G4B = pure[g4BKey].slice();
    const G3A = pure[g3AKey].slice();
    const G3B = pure[g3BKey].slice();

    const g4A = berger4(G4A);
    const g4B = berger4(G4B);
    const A3 = rr3(G3A);
    const B3 = rr3(G3B);

    const scheduled = [];

    /**
     * Piano (5 round):
     * R1: G4A blk1 (campi 1-2) + G4B blk1 (campi 3-4)      → arbitri: squadre G3 (alternate)
     * R2: G4A blk2 (1-2)     + G4B blk2 (3-4)              → arbitri: squadre G3 (alternate)
     * R3: G4A blk3 (1-2)     + G3A(1–2) (3) + G3B(1–2) (4) → arbitri: idle G4B
     * R4: G4B blk3 (1-2)     + G3A(2–3) (3) + G3B(2–3) (4) → arbitri: idle G4A
     * R5: G3A(1–3) (1)       + G3B(1–3) (2)                → arbitri: due squadre G4 (una per match)
     */

    // R1
    scheduled.push(
      { id:idFor(g4AKey, g4A[0][0][0], g4A[0][0][1]), girone:g4AKey, teamA:g4A[0][0][0], teamB:g4A[0][0][1], referee:G3A[0]||null, field:1, round:1 },
      { id:idFor(g4AKey, g4A[0][1][0], g4A[0][1][1]), girone:g4AKey, teamA:g4A[0][1][0], teamB:g4A[0][1][1], referee:G3B[0]||null, field:2, round:1 },
      { id:idFor(g4BKey, g4B[0][0][0], g4B[0][0][1]), girone:g4BKey, teamA:g4B[0][0][0], teamB:g4B[0][0][1], referee:G3A[1]||null, field:3, round:1 },
      { id:idFor(g4BKey, g4B[0][1][0], g4B[0][1][1]), girone:g4BKey, teamA:g4B[0][1][0], teamB:g4B[0][1][1], referee:G3B[1]||null, field:4, round:1 }
    );

    // R2
    scheduled.push(
      { id:idFor(g4AKey, g4A[1][0][0], g4A[1][0][1]), girone:g4AKey, teamA:g4A[1][0][0], teamB:g4A[1][0][1], referee:G3B[2]||null, field:1, round:2 },
      { id:idFor(g4AKey, g4A[1][1][0], g4A[1][1][1]), girone:g4AKey, teamA:g4A[1][1][0], teamB:g4A[1][1][1], referee:G3A[2]||null, field:2, round:2 },
      { id:idFor(g4BKey, g4B[1][0][0], g4B[1][0][1]), girone:g4BKey, teamA:g4B[1][0][0], teamB:g4B[1][0][1], referee:G3B[0]||null, field:3, round:2 },
      { id:idFor(g4BKey, g4B[1][1][0], g4B[1][1][1]), girone:g4BKey, teamA:g4B[1][1][0], teamB:g4B[1][1][1], referee:G3A[0]||null, field:4, round:2 }
    );

    // R3
    scheduled.push(
      { id:idFor(g4AKey, g4A[2][0][0], g4A[2][0][1]), girone:g4AKey, teamA:g4A[2][0][0], teamB:g4A[2][0][1], referee:G4B[0]||null, field:1, round:3 },
      { id:idFor(g4AKey, g4A[2][1][0], g4A[2][1][1]), girone:g4AKey, teamA:g4A[2][1][0], teamB:g4A[2][1][1], referee:G4B[1]||null, field:2, round:3 },
      { id:idFor(g3AKey, A3[0][0], A3[0][1]),          girone:g3AKey, teamA:A3[0][0],     teamB:A3[0][1],     referee:g3RefOf(G3A, A3[0]), field:3, round:3 },
      { id:idFor(g3BKey, B3[0][0], B3[0][1]),          girone:g3BKey, teamA:B3[0][0],     teamB:B3[0][1],     referee:g3RefOf(G3B, B3[0]), field:4, round:3 }
    );

    // R4
    scheduled.push(
      { id:idFor(g4BKey, g4B[2][0][0], g4B[2][0][1]), girone:g4BKey, teamA:g4B[2][0][0], teamB:g4B[2][0][1], referee:G4A[0]||null, field:1, round:4 },
      { id:idFor(g4BKey, g4B[2][1][0], g4B[2][1][1]), girone:g4BKey, teamA:g4B[2][1][0], teamB:g4B[2][1][1], referee:G4A[1]||null, field:2, round:4 },
      { id:idFor(g3AKey, A3[1][0], A3[1][1]),          girone:g3AKey, teamA:A3[1][0],     teamB:A3[1][1],     referee:g3RefOf(G3A, A3[1]), field:3, round:4 },
      { id:idFor(g3BKey, B3[1][0], B3[1][1]),          girone:g3BKey, teamA:B3[1][0],     teamB:B3[1][1],     referee:g3RefOf(G3B, B3[1]), field:4, round:4 }
    );

    // R5
    scheduled.push(
      { id:idFor(g3AKey, A3[2][0], A3[2][1]), girone:g3AKey, teamA:A3[2][0], teamB:A3[2][1], referee:G4A[2]||G4B[2]||null, field:1, round:5 },
      { id:idFor(g3BKey, B3[2][0], B3[2][1]), girone:g3BKey, teamA:B3[2][0], teamB:B3[2][1], referee:G4B[3]||G4A[3]||null, field:2, round:5 },
    );

    return scheduled;
  }

  // === NUOVO SCENARIO 3: 3×G4 + 1×G3 ===
  if (g4Keys.length === 3 && g3Keys.length === 1 && FIELDS_PER_ROUND === 4) {
    const [g4AKey, g4BKey, g4CKey] = g4Keys;
    const g3Key = g3Keys[0];

    const G4A = pure[g4AKey].slice();
    const G4B = pure[g4BKey].slice();
    const G4C = pure[g4CKey].slice();
    const G3D = pure[g3Key].slice();

    const A = berger4(G4A);
    const B = berger4(G4B);
    const C = berger4(G4C);
    const D = rr3(G3D);

    const scheduled = [];

    // Helper per prendere arbitri da un girone G4 (lista 4 squadre distinte)
    const takeRefsFrom = (teams4, n) => teams4.slice(0, n);

    /**
     * Piano (6 round):
     * R1: A blk1 + B blk1 (4 campi)  → arbitra C (tutte e 4 le squadre, una per campo)
     * R2: C blk1 + D(1–2) (3 campi)  → arbitri C: da A e B; D interno (g3RefOf)
     * R3: A blk2 + B blk2 (4 campi)  → arbitra C
     * R4: C blk2 + D(2–3) (3 campi)  → arbitri C: da A e B; D interno
     * R5: A blk3 + B blk3 (4 campi)  → arbitra C
     * R6: C blk3 + D(1–3) (3 campi)  → arbitri C: da A e B; D interno
     */

    // R1 — A blk1 (2) + B blk1 (2) — arbitri: C[0..3]
    {
      const refs = takeRefsFrom(G4C, 4);
      scheduled.push(
        { id:idFor(g4AKey, A[0][0][0], A[0][0][1]), girone:g4AKey, teamA:A[0][0][0], teamB:A[0][0][1], referee:refs[0], field:1, round:1 },
        { id:idFor(g4AKey, A[0][1][0], A[0][1][1]), girone:g4AKey, teamA:A[0][1][0], teamB:A[0][1][1], referee:refs[1], field:2, round:1 },
        { id:idFor(g4BKey, B[0][0][0], B[0][0][1]), girone:g4BKey, teamA:B[0][0][0], teamB:B[0][0][1], referee:refs[2], field:3, round:1 },
        { id:idFor(g4BKey, B[0][1][0], B[0][1][1]), girone:g4BKey, teamA:B[0][1][0], teamB:B[0][1][1], referee:refs[3], field:4, round:1 }
      );
    }

    // R2 — C blk1 (2) + D(1–2) (1) — arbitri C: da A[0],B[0]; D interno
    {
      scheduled.push(
        { id:idFor(g4CKey, C[0][0][0], C[0][0][1]), girone:g4CKey, teamA:C[0][0][0], teamB:C[0][0][1], referee:G4A[0], field:1, round:2 },
        { id:idFor(g4CKey, C[0][1][0], C[0][1][1]), girone:g4CKey, teamA:C[0][1][0], teamB:C[0][1][1], referee:G4B[0], field:2, round:2 },
        { id:idFor(g3Key,   D[0][0],    D[0][1]),   girone:g3Key, teamA:D[0][0],    teamB:D[0][1],    referee:g3RefOf(G3D, D[0]), field:3, round:2 }
        // campo 4 libero
      );
    }

    // R3 — A blk2 (2) + B blk2 (2) — arbitri: C[0..3]
    {
      const refs = takeRefsFrom(G4C, 4);
      scheduled.push(
        { id:idFor(g4AKey, A[1][0][0], A[1][0][1]), girone:g4AKey, teamA:A[1][0][0], teamB:A[1][0][1], referee:refs[0], field:1, round:3 },
        { id:idFor(g4AKey, A[1][1][0], A[1][1][1]), girone:g4AKey, teamA:A[1][1][0], teamB:A[1][1][1], referee:refs[1], field:2, round:3 },
        { id:idFor(g4BKey, B[1][0][0], B[1][0][1]), girone:g4BKey, teamA:B[1][0][0], teamB:B[1][0][1], referee:refs[2], field:3, round:3 },
        { id:idFor(g4BKey, B[1][1][0], B[1][1][1]), girone:g4BKey, teamA:B[1][1][0], teamB:B[1][1][1], referee:refs[3], field:4, round:3 }
      );
    }

    // R4 — C blk2 (2) + D(2–3) (1) — arbitri C: da A[1],B[1]; D interno
    {
      scheduled.push(
        { id:idFor(g4CKey, C[1][0][0], C[1][0][1]), girone:g4CKey, teamA:C[1][0][0], teamB:C[1][0][1], referee:G4A[1], field:1, round:4 },
        { id:idFor(g4CKey, C[1][1][0], C[1][1][1]), girone:g4CKey, teamA:C[1][1][0], teamB:C[1][1][1], referee:G4B[1], field:2, round:4 },
        { id:idFor(g3Key,   D[1][0],    D[1][1]),   girone:g3Key, teamA:D[1][0],    teamB:D[1][1],    referee:g3RefOf(G3D, D[1]), field:3, round:4 }
        // campo 4 libero
      );
    }

    // R5 — A blk3 (2) + B blk3 (2) — arbitri: C[0..3]
    {
      const refs = takeRefsFrom(G4C, 4);
      scheduled.push(
        { id:idFor(g4AKey, A[2][0][0], A[2][0][1]), girone:g4AKey, teamA:A[2][0][0], teamB:A[2][0][1], referee:refs[0], field:1, round:5 },
        { id:idFor(g4AKey, A[2][1][0], A[2][1][1]), girone:g4AKey, teamA:A[2][1][0], teamB:A[2][1][1], referee:refs[1], field:2, round:5 },
        { id:idFor(g4BKey, B[2][0][0], B[2][0][1]), girone:g4BKey, teamA:B[2][0][0], teamB:B[2][0][1], referee:refs[2], field:3, round:5 },
        { id:idFor(g4BKey, B[2][1][0], B[2][1][1]), girone:g4BKey, teamA:B[2][1][0], teamB:B[2][1][1], referee:refs[3], field:4, round:5 }
      );
    }

    // R6 — C blk3 (2) + D(1–3) (1) — arbitri C: da A[2],B[2]; D interno
    {
      scheduled.push(
        { id:idFor(g4CKey, C[2][0][0], C[2][0][1]), girone:g4CKey, teamA:C[2][0][0], teamB:C[2][0][1], referee:G4A[2], field:1, round:6 },
        { id:idFor(g4CKey, C[2][1][0], C[2][1][1]), girone:g4CKey, teamA:C[2][1][0], teamB:C[2][1][1], referee:G4B[2], field:2, round:6 },
        { id:idFor(g3Key,   D[2][0],    D[2][1]),   girone:g3Key, teamA:D[2][0],    teamB:D[2][1],    referee:g3RefOf(G3D, D[2]), field:3, round:6 }
        // campo 4 libero
      );
    }

    return scheduled;
  }

  // === SCENARIO 4: 4×G4 (16 squadre) — arbitri SOLO dal proprio girone
  // Supporta 1 squadra "in ritardo", presente solo da un certo round (es. round 4).
  // Campi fissi: A→1, B→2, C→3, D→4
  if (g4Keys.length === 4 && g3Keys.length === 0 && FIELDS_PER_ROUND === 4) {

    // opzionale: secondo parametro con { lateArrival: { group, team, startRound } }
    const late = (typeof arguments[1] === 'object' && arguments[1] && arguments[1].lateArrival)
      ? arguments[1].lateArrival
      : (typeof LATE !== 'undefined' ? LATE : null);

    const [gA, gB, gC, gD] = g4Keys; // ordinati
    const groups4 = { [gA]: pure[gA].slice(), [gB]: pure[gB].slice(), [gC]: pure[gC].slice(), [gD]: pure[gD].slice() };

    // Berger per ogni girone → 6 match
    const perGroup = {}; // gKey -> { teams, matches:[{a,b,idle:[x,y]}] }
    for (const gKey of [gA, gB, gC, gD]) {
      const T = groups4[gKey]; // [t0,t1,t2,t3]
      const blocks = berger4(T); // 3 blocchi x 2 partite

      const matches = [];
      for (let b = 0; b < 3; b++) {
        for (let m = 0; m < 2; m++) {
          const pair = blocks[b][m];                               // [p,q]
          const idle = T.filter(x => x !== pair[0] && x !== pair[1]); // 2 che riposano
          matches.push({ a: pair[0], b: pair[1], idle });
        }
      }

      perGroup[gKey] = { teams: T, matches };
    }

    // Se esiste una squadra "late" in un girone da 4:
    // - metti nei round 1–3 SOLO match che NON la coinvolgono
    // - sposta tutti i match che la coinvolgono in round 4–6
  function reorderForLate(gKey, teamName, startRound) {
    const PG = perGroup[gKey];
    if (!PG) return;

    const tLate = teamName;
    const early = [];
    const lateM = [];

    for (const m of PG.matches) {
      const involvesLate = (m.a === tLate || m.b === tLate);
      if (involvesLate) lateM.push(m); else early.push(m);
    }

    // servono 3 early e 3 late
    if (early.length === 3 && lateM.length === 3 && startRound >= 4) {
      // Squadre "presenti" (le 3 senza la late)
      const T = PG.teams.filter(t => t !== tLate);

      // Individua chi ha giocato R3 tra le presenti (sono i due team di early[2])
      const r3Teams = new Set([early[2].a, early[2].b]);

      // Scegli per il Round 4 la squadra che NON ha giocato il Round 3
      const preferForR4 = T.find(t => !r3Teams.has(t)) || T[0];

      // Trova il match "late" contro preferForR4
      const idxFirstLate = lateM.findIndex(m => (m.a === tLate ? m.b : m.a) === preferForR4);
      const firstLate = (idxFirstLate >= 0) ? lateM.splice(idxFirstLate, 1)[0] : lateM.shift();

      // Ordine finale: 1..3 early, 4 il match "sicuro", poi gli altri due
      PG.matches = [...early, firstLate, ...lateM];
    }
}


    if (late && groups4[late.group]?.includes(late.team)) {
      reorderForLate(late.group, late.team, Number(late.startRound) || 4);
    }

    // Assegnazione ARBITRI:
    // - SOLO dal girone stesso
    // - per i gironi SENZA "late": puntiamo al pattern 2–1–2–1 (come prima)
    // - per il girone CON "late": scegliamo al volo in base a chi è disponibile al round
    //   (la squadra in ritardo non può arbitrare prima di startRound)
    const scheduled = [];
    const perGroupRefCount = {}; // gKey -> Map(team->count)
    const perGroupLastRef  = {}; // gKey -> last team

    const availableAt = (gKey, team, round) => {
      if (!late) return true;
      if (late.group !== gKey) return true;
      if (team !== late.team) return true;
      // la squadra late non è disponibile come arbitro prima di startRound
      return round >= (Number(late.startRound) || 4);
    };

    // Target 2–1–2–1 per i gironi senza "late" (offset = 0: T[0],T[2] hanno 2; T[1],T[3] hanno 1)
    function targetFor(gKey) {
      if (late && late.group === gKey) return null; // nessun target rigido
      const T = perGroup[gKey].teams;
      const target = new Map(T.map((t, i) => [t, (i % 2 === 0) ? 2 : 1]));
      return target;
    }

    // Mappatura fissa campi
    const orderByField = [gA, gB, gC, gD];

    for (let r = 1; r <= 6; r++) {
      for (let f = 0; f < 4; f++) {
        const gKey = orderByField[f];
        const PG = perGroup[gKey];
        const T  = PG.teams;
        const M  = PG.matches[r - 1]; // match del girone per questo round

        // prepara contatori per girone
        if (!perGroupRefCount[gKey]) perGroupRefCount[gKey] = new Map(T.map(t => [t, 0]));
        const refCount = perGroupRefCount[gKey];
        let lastRef = perGroupLastRef[gKey] || null;

        // Idle del match → filtra per disponibilità al round
        const idleAvail = M.idle.filter(t => availableAt(gKey, t, r));
        // per normalità in 4×G4 idle sono 2; se uno è "late" nei primi 3 round, resterà 1 solo candidato.
        if (idleAvail.length === 0) {
          // estrema sicurezza: se nessuno disponibile, prendi comunque il primo idle "non disponibile"
          idleAvail.push(M.idle[0]);
        }

        // Se abbiamo un target (girone senza late), privilegiamo chi è sotto target
        const target = targetFor(gKey);

        let pick = null;
        if (target) {
          // tra i candidati disponibili, scegli sotto-target; altrimenti il meno carico; evita back-to-back
          const cand = idleAvail.slice().sort((a, b) => {
            const aNeed = (refCount.get(a) || 0) - (target.get(a) || 0);
            const bNeed = (refCount.get(b) || 0) - (target.get(b) || 0);
            if (aNeed !== bNeed) return aNeed - bNeed; // più negativo = più sotto-target
            const ra = refCount.get(a) || 0, rb = refCount.get(b) || 0;
            if (ra !== rb) return ra - rb;
            if (lastRef && (a === lastRef) !== (b === lastRef)) return (a === lastRef) ? 1 : -1;
            return T.indexOf(a) - T.indexOf(b);
          });
          pick = cand[0];
        } else {
          // girone con late: scegli il meno carico; evita back-to-back
          const cand = idleAvail.slice().sort((a, b) => {
            const ra = refCount.get(a) || 0, rb = refCount.get(b) || 0;
            if (ra !== rb) return ra - rb;
            if (lastRef && (a === lastRef) !== (b === lastRef)) return (a === lastRef) ? 1 : -1;
            return T.indexOf(a) - T.indexOf(b);
          });
          pick = cand[0];
        }

        // registra
        refCount.set(pick, (refCount.get(pick) || 0) + 1);
        perGroupLastRef[gKey] = pick;

        scheduled.push({
          id: idFor(gKey, M.a, M.b),
          girone: gKey,
          teamA: M.a,
          teamB: M.b,
          referee: pick,
          field: f + 1,  // A:1, B:2, C:3, D:4
          round: r
        });
      }
    }

    return scheduled;
  }




  // ====== FALLBACK: TUA LOGICA ORIGINALE (INVARIATA) ======
  const queues = {};
  const allTeams = new Set();

  for (const g of Object.keys(groups || {})) {
    const teams = (groups[g] || []).slice().map(nameOf);
    if (teams.length < 2) continue;

    teams.forEach(t => allTeams.add(`${g}::${t}`));

    const list = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        list.push({
          id: `${g}-${i}-${j}`,
          girone: g,
          teamA: teams[i],
          teamB: teams[j],
          referee: null,
          field: null,
          round: null
        });
      }
    }
    queues[g] = list;
  }

  const lastRoundPlayed = new Map(); // "G::Team" -> round
  const consecPlayed    = new Map(); // "G::Team" -> consecutivi
  const refCount        = new Map(); // "G::Team" -> # arbitraggi
  const lastRoundRef    = new Map(); // "G::Team" -> round
  const consecRef       = new Map(); // "G::Team" -> consecutivi
  const keyOf = (g, t) => `${g}::${t}`;

  for (const k of allTeams) refCount.set(k, 0);

  const MAX_CONSEC_PLAY  = 2; // <=2 di fila (mai 3)
  const MAX_CONSEC_REF   = 2; // evita 3 arbitraggi consecutivi

  function canPlaceMatch(m, teamsBusyThisRound, round) {
    const kA = keyOf(m.girone, m.teamA);
    const kB = keyOf(m.girone, m.teamB);
    if (teamsBusyThisRound.has(kA) || teamsBusyThisRound.has(kB)) return false;

    const lastA = lastRoundPlayed.get(kA) ?? -Infinity;
    const lastB = lastRoundPlayed.get(kB) ?? -Infinity;
    const consA = consecPlayed.get(kA) ?? 0;
    const consB = consecPlayed.get(kB) ?? 0;

    const wouldConsA = (lastA === round - 1) ? (consA + 1) : 1;
    const wouldConsB = (lastB === round - 1) ? (consB + 1) : 1;

    if (wouldConsA > MAX_CONSEC_PLAY || wouldConsB > MAX_CONSEC_PLAY) return false;
    return true;
  }

  function pickReferee(m, teamsBusyThisRound, round, requireOutsideGroup) {
    const sameGroupTeams = (pure[m.girone] || []).filter(t => t !== m.teamA && t !== m.teamB);
    const sameGroupIdleKeys = sameGroupTeams
      .map(t => keyOf(m.girone, t))
      .filter(k => !teamsBusyThisRound.has(k));

    const globalIdleKeys = [];
    for (const k of allTeams) {
      if (teamsBusyThisRound.has(k)) continue;
      const [gName] = String(k).split('::');
      if (requireOutsideGroup && gName === m.girone) continue; // obbliga arbitro esterno
      globalIdleKeys.push(k);
    }

    function best(cands) {
      if (!cands.length) return null;
      cands.sort((ka, kb) => {
        const ca = refCount.get(ka) ?? 0;
        const cb = refCount.get(kb) ?? 0;

        const la = lastRoundRef.get(ka) ?? -Infinity;
        const lb = lastRoundRef.get(kb) ?? -Infinity;
        const cra = consecRef.get(ka) ?? 0;
        const crb = consecRef.get(kb) ?? 0;

        const wouldA = (la === round - 1) ? (cra + 1) : 1;
        const wouldB = (lb === round - 1) ? (crb + 1) : 1;

        const penA = (wouldA > MAX_CONSEC_REF) ? 1 : 0;
        const penB = (wouldB > MAX_CONSEC_REF) ? 1 : 0;

        if (penA !== penB) return penA - penB;
        if (ca !== cb) return ca - cb;
        if (cra !== crb) return cra - crb;
        return String(ka).localeCompare(String(kb));
      });
      return cands[0];
    }

    if (!requireOutsideGroup) {
      const pick = best(sameGroupIdleKeys);
      if (pick) return pick;
    }

    return best(globalIdleKeys);
  }

  const scheduled = [];
  let round = 1;

  while (Object.values(queues).some(q => q.length > 0)) {
    const teamsBusyThisRound = new Set();
    const groupPlacedCount = new Map();
    let fieldsUsed = 0;
    let progress = true;

    while (fieldsUsed < FIELDS_PER_ROUND && progress) {
      progress = false;

      const groupOrder = Object.keys(queues).sort((a, b) => (queues[b]?.length || 0) - (queues[a]?.length || 0));

      let chosen = null, chosenIdx = -1, chosenGroup = null, chosenRef = null;

      for (const g of groupOrder) {
        const q = queues[g];
        if (!q || q.length === 0) continue;

        const alreadyPlaced = groupPlacedCount.get(g) ?? 0;
        const requireOutside = alreadyPlaced >= 1;

        for (let i = 0; i < q.length; i++) {
          const cand = q[i];
          if (!canPlaceMatch(cand, teamsBusyThisRound, round)) continue;

          const refK = pickReferee(cand, teamsBusyThisRound, round, requireOutside);
          if (!refK) continue;

          chosen = cand;
          chosenIdx = i;
          chosenGroup = g;
          chosenRef = refK;
          break;
        }
        if (chosen) break;
      }

      if (!chosen) break;

      const kA = `${chosen.girone}::${chosen.teamA}`;
      const kB = `${chosen.girone}::${chosen.teamB}`;

      teamsBusyThisRound.add(kA);
      teamsBusyThisRound.add(kB);
      teamsBusyThisRound.add(chosenRef);

      fieldsUsed += 1;
      chosen.round = round;
      chosen.field = fieldsUsed;

      const [, refTeam] = String(chosenRef).split('::');
      chosen.referee = refTeam;

      const lastA = lastRoundPlayed.get(kA) ?? -Infinity;
      const lastB = lastRoundPlayed.get(kB) ?? -Infinity;
      consecPlayed.set(kA, (lastA === round - 1) ? ((consecPlayed.get(kA) ?? 0) + 1) : 1);
      consecPlayed.set(kB, (lastB === round - 1) ? ((consecPlayed.get(kB) ?? 0) + 1) : 1);
      lastRoundPlayed.set(kA, round);
      lastRoundPlayed.set(kB, round);

      const lastR = lastRoundRef.get(chosenRef) ?? -Infinity;
      consecRef.set(chosenRef, (lastR === round - 1) ? ((consecRef.get(chosenRef) ?? 0) + 1) : 1);
      lastRoundRef.set(chosenRef, round);
      refCount.set(chosenRef, (refCount.get(chosenRef) ?? 0) + 1);

      queues[chosenGroup].splice(chosenIdx, 1);
      scheduled.push(chosen);

      groupPlacedCount.set(chosenGroup, (groupPlacedCount.get(chosenGroup) ?? 0) + 1);
      progress = true;
    }

    round++;
  }

  return scheduled;
}

// ========= CALCOLO CLASSIFICHE =========
function computeStandings(groups, matches) {
  // init struttura
  const standings = {};
  for (const g of Object.keys(groups || {})) {
    standings[g] = (groups[g] || []).map(team => ({
      teamName: (typeof team === 'string') ? team : team?.teamName || String(team),
      giocate: 0,
      vittorie: 0,
      perse: 0,
      pf: 0,   // punti fatti
      ps: 0,   // punti subiti
      diff: 0, // pf - ps
      pt: 0    // punti classifica (3 per vittoria)
    }));
  }

  // index rapido per aggiornare
  const idx = {};
  for (const g of Object.keys(standings)) {
    idx[g] = new Map(standings[g].map((r, i) => [r.teamName, i]));
  }

  // applica risultati
  for (const m of matches || []) {
    if (m?.girone == null || m?.teamA == null || m?.teamB == null) continue;
    if (m?.scoreA == null || m?.scoreB == null) continue; // non giocata

    const g = m.girone;
    const a = m.teamA;
    const b = m.teamB;

    const ia = idx[g]?.get(a);
    const ib = idx[g]?.get(b);
    if (ia == null || ib == null) continue;

    const ra = standings[g][ia];
    const rb = standings[g][ib];

    ra.giocate++; rb.giocate++;
    ra.pf += Number(m.scoreA); ra.ps += Number(m.scoreB);
    rb.pf += Number(m.scoreB); rb.ps += Number(m.scoreA);

    if (m.scoreA > m.scoreB) {
      ra.vittorie++; rb.perse++;
      ra.pt += 3;
    } else {
      rb.vittorie++; ra.perse++;
      rb.pt += 3;
    }
  }

  // diff + sort
  for (const g of Object.keys(standings)) {
    for (const r of standings[g]) r.diff = r.pf - r.ps;
    standings[g].sort((x, y) => {
      if (y.vittorie !== x.vittorie) return y.vittorie - x.vittorie;
      if (y.diff     !== x.diff)     return y.diff - x.diff;
      if (y.pf       !== x.pf)       return y.pf - x.pf;
      return String(x.teamName).localeCompare(String(y.teamName));
    });
  }

  return standings;
}

function generateG4Rounds(group) {
  const [t1,t2,t3,t4] = group.teams;
  const g = group.id;
  return [
    [{ groupId: g, round: 1, teamA: t1, teamB: t4 }, { groupId: g, round: 1, teamA: t2, teamB: t3 }],
    [{ groupId: g, round: 2, teamA: t1, teamB: t3 }, { groupId: g, round: 2, teamA: t4, teamB: t2 }],
    [{ groupId: g, round: 3, teamA: t1, teamB: t2 }, { groupId: g, round: 3, teamA: t3, teamB: t4 }]
  ];
}

function generateG3Rounds(group) {
  const [a,b,c] = group.teams;
  const g = group.id;
  return [
    [{ groupId: g, round: 1, teamA: a, teamB: b, resting: c }],
    [{ groupId: g, round: 2, teamA: b, teamB: c, resting: a }],
    [{ groupId: g, round: 3, teamA: a, teamB: c, resting: b }]
  ];
}

function scheduleAllG4(groups4) {
  const slots = [];
  const roundsByGroup = groups4.map(g => ({ id: g.id, rounds: generateG4Rounds(g), teams: g.teams }));
  for (const gr of roundsByGroup) {
    for (let r = 0; r < gr.rounds.length; r++) {
      const roundMatches = gr.rounds[r];
      const slot = slots[r] || (slots[r] = { index: r+1, assignments: [] });
      slot.assignments.push({ field: null, match: roundMatches[0] });
      slot.assignments.push({ field: null, match: roundMatches[1] });
    }
  }
  return slots;
}

function scheduleAllG3(groups3) {
  const slots = [];
  const roundsByG = new Map(groups3.map(g => [g.id, generateG3Rounds(g)]));
  for (let r = 0; r < 3; r++) {
    const slot = { index: r+1, assignments: [] };
    let f = 1;
    groups3.forEach(g => {
      const m = roundsByG.get(g.id)[r][0];
      slot.assignments.push({ field: f++, match: m });
    });
    slots.push(slot);
  }
  return slots;
}

function schedule_1G4_3G3(g4, groups3) {
  const slots = [];
  const g4Rounds = generateG4Rounds(g4);
  const g3Rounds = groups3.map(generateG3Rounds);
  const rotations = [[0,1],[1,2],[2,0]];

  for (let r = 0; r < 3; r++) {
    const slot = { index: r+1, assignments: [] };
    slot.assignments.push({ field: 1, match: g4Rounds[r][0] });
    slot.assignments.push({ field: 2, match: g4Rounds[r][1] });
    const [a,b] = rotations[r];
    slot.assignments.push({ field: 3, match: g3Rounds[a][r][0] });
    slot.assignments.push({ field: 4, match: g3Rounds[b][r][0] });
    slots.push(slot);
  }

  // Slot 4: 3 match residui (uno per G3)
  const slot4 = { index: 4, assignments: [] };
  groups3.forEach((g, i) => {
    const played = rotations.flat().filter(x => x === i).length;
    if (played === 2) {
      const missing = [0,1,2].find(rr => !rotations.some((x, idx) => x.includes(i) && idx === rr));
      slot4.assignments.push({ field: slot4.assignments.length+1, match: g3Rounds[i][missing][0] });
    }
  });
  slots.push(slot4);

  return slots;
  }
  function schedule_2G4_2G3(groups4, groups3) {
    const slots = [];
    const [A,B] = groups4;
    const [C,D] = groups3;

    const ARounds = generateG4Rounds(A);
    const BRounds = generateG4Rounds(B);
    const CRounds = generateG3Rounds(C);
    const DRounds = generateG3Rounds(D);

    // Slot 1–3: G4A completo su 2 campi, G4B 1 partita/slot, C/D alternati
    for (let r = 0; r < 3; r++) {
      const slot = { index: slots.length+1, assignments: [] };
      slot.assignments.push({ field: 1, match: ARounds[r][0] });
      slot.assignments.push({ field: 2, match: ARounds[r][1] });
      slot.assignments.push({ field: 3, match: BRounds[r][r%2===0 ? 0 : 1] });
      slot.assignments.push({ field: 4, match: (r%2===0 ? CRounds[r][0] : DRounds[r][0]) });
      slots.push(slot);
    }

    // Recupero match rimanenti di B, C, D
    const usedB = [0,1,0]; // pattern scelto sopra
    const BRemaining = [];
    for (let r = 0; r < 3; r++) {
      const other = usedB[r] === 0 ? 1 : 0;
      BRemaining.push(BRounds[r][other]);
    }

    // Slot 4: due match di B + uno di C + uno di D
    const slot4 = { index: 4, assignments: [] };
    slot4.assignments.push({ field: 1, match: BRemaining[0] });
    slot4.assignments.push({ field: 2, match: BRemaining[1] });
    slot4.assignments.push({ field: 3, match: CRounds[1][0] }); // quello non ancora giocato
    slot4.assignments.push({ field: 4, match: DRounds[0][0] }); // quello non ancora giocato
    slots.push(slot4);

    // Slot 5: ultimo match di B + ultimi residui C/D
    const slot5 = { index: 5, assignments: [] };
    slot5.assignments.push({ field: 1, match: BRemaining[2] });
    slot5.assignments.push({ field: 2, match: DRounds[2][0] });
    slot5.assignments.push({ field: 3, match: CRounds[2][0] });
    slots.push(slot5);

    return slots;
  }

  function schedule_3G4_1G3(groups4, group3) {
    const slots = [];
    const [A,B,C] = groups4;
    const G3 = group3;

    const ARounds = generateG4Rounds(A);
    const BRounds = generateG4Rounds(B);
    const CRounds = generateG4Rounds(C);
    const G3Rounds = generateG3Rounds(G3);

    // Slot 1–3: G4A completo su 2 campi, G4B 1 partita/slot, G3 1 partita/slot
    for (let r = 0; r < 3; r++) {
      const slot = { index: slots.length+1, assignments: [] };
      slot.assignments.push({ field: 1, match: ARounds[r][0] });
      slot.assignments.push({ field: 2, match: ARounds[r][1] });
      slot.assignments.push({ field: 3, match: BRounds[r][r%2===0 ? 0 : 1] });
      slot.assignments.push({ field: 4, match: G3Rounds[r][0] });
      slots.push(slot);
    }

    // Recupero match mancanti di B
    const usedB = [0,1,0];
    const BRemaining = [];
    for (let r = 0; r < 3; r++) {
      const other = usedB[r] === 0 ? 1 : 0;
      BRemaining.push(BRounds[r][other]);
    }

    // Slot 4: due match di B + primo round di C
    const slot4 = { index: 4, assignments: [] };
    slot4.assignments.push({ field: 1, match: BRemaining[0] });
    slot4.assignments.push({ field: 2, match: BRemaining[1] });
    slot4.assignments.push({ field: 3, match: CRounds[0][0] });
    slot4.assignments.push({ field: 4, match: CRounds[0][1] });
    slots.push(slot4);

    // Slot 5: ultimo match di B + secondo round di C
    const slot5 = { index: 5, assignments: [] };
    slot5.assignments.push({ field: 1, match: BRemaining[2] });
    slot5.assignments.push({ field: 2, match: CRounds[1][0] });
    slot5.assignments.push({ field: 3, match: CRounds[1][1] });
    slots.push(slot5);

    // Slot 6: ultimo round di C
    const slot6 = { index: 6, assignments: [] };
    slot6.assignments.push({ field: 1, match: CRounds[2][0] });
    slot6.assignments.push({ field: 2, match: CRounds[2][1] });
    slots.push(slot6);

    return slots;
  }


// Call assignReferees similar to above (omitted for brevity)...



// ================== STANDINGS ================== //
function computeStandings(data) {
  const standings = {};
  for (const g in data.groups) {
    standings[g] = data.groups[g].map(team => ({
      team,
      wins: 0, pf: 0, pa: 0, diff: 0, points: 0
    }));
  }

  const lookup = {};
  for (const g in standings) {
    standings[g].forEach(row => (lookup[`${g}:${row.team}`] = row));
  }

  for (const m of data.matches) {
    if (!m.score) continue;
    const { puntiA, puntiB } = m.score;
    const rowA = lookup[`${m.girone}:${m.teamA}`];
    const rowB = lookup[`${m.girone}:${m.teamB}`];

    rowA.pf += puntiA; rowA.pa += puntiB;
    rowB.pf += puntiB; rowB.pa += puntiA;

    if (puntiA > puntiB) { rowA.wins++; rowA.points += 3; }
    else if (puntiB > puntiA) { rowB.wins++; rowB.points += 3; }
  }

  for (const g in standings) {
    standings[g].forEach(r => r.diff = r.pf - r.pa);
    standings[g].sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pf - a.pf);
  }
  return standings;
}

// ✅ Avvio server
app.listen(PORT, () => {
  console.log(`🚀 Backend + Frontend in ascolto su http://localhost:${PORT}`);
});

// ✅ Campo suggerito per girone
function fieldForGirone(g) {
  const mapping = { A:1, B:2, C:3, D:4 };
  return mapping[g] || null;
}

// ✅ Generazione match per un girone
function scheduleGroupMatches(girone, teams, startRound) {
  const list = [];
  let round = startRound;

  // Caso 3 squadre: 3 partite, arbitra chi riposa
  if (teams.length === 3) {
    list.push({ id:`${girone}-0-1`, girone, teamA:teams[0], teamB:teams[1], referee:teams[2], field:fieldForGirone(girone), round: round++ });
    list.push({ id:`${girone}-0-2`, girone, teamA:teams[0], teamB:teams[2], referee:teams[1], field:fieldForGirone(girone), round: round++ });
    list.push({ id:`${girone}-1-2`, girone, teamA:teams[1], teamB:teams[2], referee:teams[0], field:fieldForGirone(girone), round: round++ });
    return { matches:list, nextRound: round };
  }

  // Caso 4 (o più) squadre: tutte le coppie; referee = uno degli altri a rotazione
  for (let i = 0; i < teams.length; i++) {
    for (let j = i + 1; j < teams.length; j++) {
      const others = teams.filter(t => t !== teams[i] && t !== teams[j]);
      const referee = others[0] || null; // semplice rotazione
      list.push({
        id: `${girone}-${i}-${j}`,
        girone,
        teamA: teams[i],
        teamB: teams[j],
        referee,
        field: fieldForGirone(girone),
        round: round++
      });
    }
  }
  return { matches:list, nextRound: round };
}