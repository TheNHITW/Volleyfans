const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Serve Angular build statica
app.use(express.static(path.join(__dirname, '../dist/volleyfans/browser')));

// ✅ Funzione: restituisce path al file JSON per una data
function getFilePathForDate(date) {
  const dir = path.join(__dirname, 'data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `registrations-${date}.json`);
}

// ✅ Rotta PING per UptimeRobot
app.get('/ping', (req, res) => res.send('pong'));

// ✅ REGISTRAZIONE squadra
app.post('/register', (req, res) => {
  const newTeam = req.body;
  const dates = newTeam.selectedDates;

  if (!Array.isArray(dates) || dates.length === 0) {
    return res.status(400).json({ success: false, message: 'Nessuna data selezionata.' });
  }

  console.log(`🏐 Nuova squadra: ${newTeam.teamName} per ${dates.join(', ')}`);

  dates.forEach(date => {
    const filePath = getFilePathForDate(date);
    const registrations = fs.existsSync(filePath)
      ? JSON.parse(fs.readFileSync(filePath))
      : [];

    registrations.push(newTeam);
    fs.writeFileSync(filePath, JSON.stringify(registrations, null, 2));
  });
cd 
  res.json({ success: true, message: 'Iscrizione registrata.' });
});

// ✅ RECUPERO iscrizioni per data
app.get('/admin/registrations', (req, res) => {
  const date = req.query.date;

  if (!date) {
    return res.status(400).json({ success: false, message: 'Data mancante nella richiesta.' });
  }

  const filePath = path.join(__dirname, 'data', `registrations-${date}.json`);

  if (!fs.existsSync(filePath)) {
    return res.json([]); // file non ancora creato? restituiamo array vuoto
  }

  const registrations = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  res.json(registrations);
});

// ✅ ELIMINA squadra per data
app.delete('/admin/registrations/:teamName', (req, res) => {
  const teamToDelete = decodeURIComponent(req.params.teamName).trim().toLowerCase();
  const date = req.query.date;
  if (!date) return res.status(400).json({ success: false, message: 'Parametro "date" mancante.' });

  const filePath = getFilePathForDate(date);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'Nessun file per questa data.' });
  }

  const registrations = JSON.parse(fs.readFileSync(filePath));
  const updated = registrations.filter(
    team => team.teamName.trim().toLowerCase() !== teamToDelete
  );

  if (updated.length === registrations.length) {
    return res.status(404).json({ success: false, message: 'Squadra non trovata.' });
  }

  fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
  res.json({ success: true, message: `Squadra eliminata per ${date}.` });
});

// ✅ CONFIG: stato iscrizioni
const configFile = path.join(__dirname, 'data', 'config.json');

function getConfig() {
  if (!fs.existsSync(configFile)) {
    fs.writeFileSync(configFile, JSON.stringify({ isRegistrationOpen: true }, null, 2));
  }
  return JSON.parse(fs.readFileSync(configFile, 'utf8'));
}

function setConfig(newConfig) {
  fs.writeFileSync(configFile, JSON.stringify(newConfig, null, 2));
}

app.get('/config', (req, res) => {
  res.json(getConfig());
});

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

// Servizio dei file JSON per classifiche
app.get('/registrations/:date', (req, res) => {
  const date = req.params.date; // es. "2025-08-31"
  const filename = `registrations-${date}.json`;
  const filePath = path.join(__dirname, 'data', filename);

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: `File ${filename} non trovato.` });
  }
});

// ✅ Avvio server
app.listen(PORT, () => {
  console.log(`🚀 Backend + Frontend in ascolto su http://localhost:${PORT}`);
});
