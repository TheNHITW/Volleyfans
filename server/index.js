const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middleware abilitati
app.use(cors());
app.use(express.json());

// ✅ Percorso file JSON
const dataFile = path.join(__dirname, 'data', 'registrations.json');

// ✅ Se non esiste -> crealo vuoto
if (!fs.existsSync(dataFile)) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true }); // crea cartella 'data' se non esiste
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// ✅ ROTTA PING (per UptimeRobot)
app.get('/ping', (req, res) => {
  res.status(200).send('pong');
});

// ✅ Endpoint POST → registra una squadra
app.post('/register', (req, res) => {
  const newTeam = req.body; // dovrebbe contenere { teamName, phone, players }
  console.log('Nuova squadra ricevuta:', newTeam);

  const rawData = fs.readFileSync(dataFile);
  const registrations = JSON.parse(rawData);

  registrations.push(newTeam);

  fs.writeFileSync(dataFile, JSON.stringify(registrations, null, 2));

  res.json({ success: true, message: 'Squadra registrata con successo!' });
});

// ✅ Endpoint GET → ottieni tutte le iscrizioni (admin)
app.get('/admin/registrations', (req, res) => {
  const rawData = fs.readFileSync(dataFile);
  const registrations = JSON.parse(rawData);
  res.json(registrations);
});

// DELETE singola squadra
app.delete('/admin/registrations/:teamName', (req, res) => {
  const teamToDelete = decodeURIComponent(req.params.teamName).trim().toLowerCase();

  const rawData = fs.readFileSync(dataFile);
  const registrations = JSON.parse(rawData);

  const updated = registrations.filter(
    team => team.teamName.trim().toLowerCase() !== teamToDelete
  );

  if (updated.length === registrations.length) {
    return res.status(404).json({ success: false, message: 'Squadra non trovata.' });
  }

  fs.writeFileSync(dataFile, JSON.stringify(updated, null, 2));
  res.json({ success: true, message: `Squadra eliminata.` });
});

// ✅ Avvio server
app.listen(PORT, () => {
  console.log(`🚀 Backend in ascolto su http://localhost:${PORT}`);
});
