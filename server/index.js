const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ Percorso file dati
const dataFile = path.join(__dirname, 'data', 'registrations.json');

// ✅ Inizializza file JSON se non esiste
if (!fs.existsSync(dataFile)) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify([]));
}

// ✅ Serve Angular build statica
app.use(express.static(path.join(__dirname, '../dist/volleyfans/browser')));

// ✅ PING per UptimeRobot
app.get('/ping', (req, res) => res.send('pong'));

// ✅ API REST
app.post('/register', (req, res) => {
  const newTeam = req.body;
  console.log('Nuova squadra ricevuta:', newTeam);

  const registrations = JSON.parse(fs.readFileSync(dataFile));
  registrations.push(newTeam);
  fs.writeFileSync(dataFile, JSON.stringify(registrations, null, 2));

  res.json({ success: true, message: 'Squadra registrata con successo!' });
});

app.get('/admin/registrations', (req, res) => {
  const registrations = JSON.parse(fs.readFileSync(dataFile));
  res.json(registrations);
});

app.delete('/admin/registrations/:teamName', (req, res) => {
  const teamToDelete = decodeURIComponent(req.params.teamName).trim().toLowerCase();

  const registrations = JSON.parse(fs.readFileSync(dataFile));
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
  console.log(`🚀 Backend + Frontend in ascolto su http://localhost:${PORT}`);
});
