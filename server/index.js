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

// ================== LOGICA MATCH ================== //
function generateMatchesForAllGroups(groups) {
  // 1. Genero match divisi per girone
  const queues = {};
  for (const g in groups) {
    const teams = groups[g];
    if (!teams || teams.length < 2) continue;

    queues[g] = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i + 1; j < teams.length; j++) {
        const others = teams.filter(t => t !== teams[i] && t !== teams[j]);
        queues[g].push({
          id: `${g}-${i}-${j}`,
          girone: g,
          teamA: teams[i],
          teamB: teams[j],
          referee: others[0] || null,
          field: null,
          round: null
        });
      }
    }
  }

  // 2. Interleaving round-based
  const scheduled = [];
  let round = 1;

  while (Object.values(queues).some(q => q.length > 0)) {
    let field = 1;
    for (const g of Object.keys(queues).sort()) {
      if (queues[g].length > 0) {
        const match = queues[g].shift();
        match.round = round;
        match.field = field++;
        scheduled.push(match);
      }
    }
    round++;
  }
  return scheduled;
}

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
