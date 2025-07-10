import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';

interface Player {
  name: string;
  gender: string;
}

@Component({
  selector: 'app-registration-form',
  standalone: false,
  templateUrl: './registration-form.html',
  styleUrls: ['./registration-form.css']
})
export class RegistrationForm {
  registrationForm: FormGroup;

  constructor(private fb: FormBuilder) {
    this.registrationForm = this.fb.group({
      teamName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{7,15}$')]],
      players: this.fb.array([
        this.createPlayer(),
        this.createPlayer(),
        this.createPlayer(),
        this.createPlayer()
      ])
    });
  }

  createPlayer(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      gender: ['', Validators.required]
    });
  }

  get players(): FormArray {
    return this.registrationForm.get('players') as FormArray;
  }

  onSubmit() {
    const formData = this.registrationForm.value;
    const teamName = formData.teamName.trim();
    const players: Player[] = formData.players;

    // 🚩 1. Controlla 4 giocatori
    if (players.length !== 4) {
      alert('Devi avere esattamente 4 giocatori.');
      return;
    }

    // 🚩 2. Nessun nome vuoto
    if (players.some((p: Player) => !p.name.trim() || !p.gender)) {
      alert('Tutti i giocatori devono avere nome e sesso.');
      return;
    }

    // 🚩 3. Nessun nome duplicato nella squadra
    const names = players.map((p: Player) => p.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      alert('Non puoi inserire lo stesso nome due volte nella stessa squadra.');
      return;
    }

    // 🚩 4. Nome squadra unico
    const savedTeams = JSON.parse(localStorage.getItem('teams') || '[]');
    const teamExists = savedTeams.some((t: any) =>
      t.teamName.trim().toLowerCase() === teamName.toLowerCase()
    );
    if (teamExists) {
      alert('Nome squadra già registrato. Scegli un altro nome.');
      return;
    }

    // 🚩 5. 2 maschi + 2 femmine
    const males = players.filter((p: Player) => p.gender === 'M').length;
    const females = players.filter((p: Player) => p.gender === 'F').length;

    if (males !== 2 || females !== 2) {
      alert('La squadra deve avere esattamente 2 maschi e 2 femmine.');
      return;
    }

    // 🚩 6. Giocatori univoci tra tutte le squadre
    const allExistingPlayers: string[] = [];
    savedTeams.forEach((t: any) => {
      t.players.forEach((p: any) => {
        allExistingPlayers.push(p.name.trim().toLowerCase());
      });
    });

    const duplicateInOtherTeams = names.some(name => allExistingPlayers.includes(name));
    if (duplicateInOtherTeams) {
      alert('Uno o più giocatori sono già iscritti in un\'altra squadra.');
      return;
    }

    // ✅ Tutto ok → salva
    savedTeams.push(formData);
    localStorage.setItem('teams', JSON.stringify(savedTeams));

    alert('Iscrizione completata! Squadra registrata con successo.');
    this.registrationForm.reset();
  }
}
