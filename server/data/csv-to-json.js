const fs = require('fs');
const path = require('path');

// Percorsi file
const inputCsvPath = path.join(__dirname, 'registrations.csv');
const outputJsonPath = path.join(__dirname, 'registrations-new.json');

// Leggi CSV
const csv = fs.readFileSync(inputCsvPath, 'utf-8');

// Suddividi per righe
const lines = csv.trim().split('\n');

// Rimuovi intestazione
const header = lines.shift();

// Funzione che pulisce un campo rimuovendo eventuali virgolette esterne
function clean(value) {
  if (!value) return '';
  let v = value.trim();
  // se inizia e finisce con virgolette, rimuovile
  if (v.startsWith('"') && v.endsWith('"')) {
    v = v.slice(1, -1);
  }
  // rimuovi virgolette residue doppie
  v = v.replace(/""/g, '"');
  return v;
}

// Parsea righe rimanenti
const teams = lines.map(line => {
  const [
    teamName,
    skillLevel,
    phone,
    p1, g1,
    p2, g2,
    p3, g3,
    p4, g4
  ] = line.split(',');

  return {
    teamName: clean(teamName),
    skillLevel: clean(skillLevel),
    phone: clean(phone),
    players: [
      { name: clean(p1), gender: clean(g1) },
      { name: clean(p2), gender: clean(g2) },
      { name: clean(p3), gender: clean(g3) },
      { name: clean(p4), gender: clean(g4) }
    ]
  };
});

// Scrivi JSON
fs.writeFileSync(outputJsonPath, JSON.stringify(teams, null, 2), 'utf-8');

console.log(`✅ File JSON generato con successo: ${outputJsonPath}`);
