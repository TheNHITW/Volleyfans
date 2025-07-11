import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

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

  constructor(private fb: FormBuilder, private http: HttpClient) {
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

    // 1️⃣ Verifica giocatori
    if (players.length !== 4) {
      alert('Devi inserire esattamente 4 giocatori.');
      return;
    }

    if (players.some(p => !p.name.trim() || !p.gender)) {
      alert('Tutti i giocatori devono avere nome e sesso.');
      return;
    }

    const names = players.map(p => p.name.trim().toLowerCase());
    const uniqueNames = new Set(names);
    if (uniqueNames.size !== names.length) {
      alert('Nessun nome duplicato nella squadra.');
      return;
    }

    const males = players.filter(p => p.gender === 'M').length;
    const females = players.filter(p => p.gender === 'F').length;

    if (males !== 2 || females !== 2) {
      alert('Devi avere esattamente 2 maschi e 2 femmine.');
      return;
    }

    // 2️⃣ Tutto OK → Invia al backend
    this.http.post('https://volleyfans-jo89.onrender.com/register', formData)
      .subscribe({
        next: (res) => {
          alert('Iscrizione inviata! Squadra registrata.');
          this.registrationForm.reset();
        },
        error: (err) => {
          console.error('Errore iscrizione:', err);
          alert('Si è verificato un errore. Riprova.');
        }
      });
  }
}
