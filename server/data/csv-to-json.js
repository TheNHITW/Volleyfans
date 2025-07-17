const fs = require('fs');
const path = require('path');

// Percorsi file
const inputCsvPath = path.join(__dirname, 'registrations.csv');
const outputJsonPath = path.join(__dirname, 'registrations.json');

// Leggi CSV
const csv = fs.readFileSync(inputCsvPath, 'utf-8');

// Suddividi per righe
const lines = csv.trim().split('\n');

// Rimuovi intestazione
const header = lines.shift();

// Parsea righe rimanenti
const teams = lines.map(line => {
  const [
    teamName,
    phone,
    p1, g1,
    p2, g2,
    p3, g3,
    p4, g4
  ] = line.split(',');

  return {
    teamName: teamName.trim(),
    phone: phone.trim(),
    players: [
      { name: p1.trim(), gender: g1.trim() },
      { name: p2.trim(), gender: g2.trim() },
      { name: p3.trim(), gender: g3.trim() },
      { name: p4.trim(), gender: g4.trim() }
    ]
  };
});

// Scrivi JSON
fs.writeFileSync(outputJsonPath, JSON.stringify(teams, null, 2), 'utf-8');

console.log(`✅ File JSON generato con successo: ${outputJsonPath}`);