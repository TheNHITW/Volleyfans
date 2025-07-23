import { Component, OnInit } from '@angular/core';
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
export class RegistrationForm implements OnInit {
  registrationForm: FormGroup;
  registrationOpen = true;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.registrationForm = this.fb.group({
      teamName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{7,15}$')]],
      players: this.fb.array([
        this.createPlayer(),
        this.createPlayer(),
        this.createPlayer(),
        this.createPlayer()
      ]),
      privacyConsent: [false, Validators.requiredTrue]
    });
  }
  readonly baseUrl = window.location.hostname === 'localhost'
  ? 'http://localhost:3000'
  : 'https://volleyfans-bh.onrender.com';

  ngOnInit() {
    
    this.http.get<{ isRegistrationOpen: boolean }>(`${this.baseUrl}/config`)
      .subscribe(res => {
        this.registrationOpen = res.isRegistrationOpen;
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
    const teamName = formData.teamName.trim().toLowerCase();
    const players: Player[] = formData.players;

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
      alert('I nomi dei giocatori devono essere univoci nella stessa squadra.');
      return;
    }

    const males = players.filter(p => p.gender === 'M').length;
    const females = players.filter(p => p.gender === 'F').length;
    if (males !== 2 || females !== 2) {
      alert('Devi iscrivere esattamente 2 maschi e 2 femmine.');
      return;
    }

    this.http.get<any[]>('${this.baseUrl}/registrations').subscribe({
      next: (registrations) => {
        const teamNameTaken = registrations.some(t => t.teamName.trim().toLowerCase() === teamName);
        if (teamNameTaken) {
          alert('Nome squadra già iscritto.');
          return;
        }

        const allRegisteredNames = registrations.flatMap(t =>
          t.players.map((p: Player) => p.name.trim().toLowerCase())
        );
        const duplicated = names.find(name => allRegisteredNames.includes(name));
        if (duplicated) {
          alert(`Il giocatore "${duplicated}" è già iscritto in un'altra squadra.`);
          return;
        }

        this.http.post('${this.baseUrl}/register', formData)
          .subscribe({
            next: () => {
              alert('Iscrizione inviata! Squadra registrata.');
              this.registrationForm.reset();
            },
            error: (err) => {
              console.error('Errore iscrizione:', err);
              alert('Si è verificato un errore. Riprova.');
            }
          });
      },
      error: (err) => {
        console.error('Errore durante il controllo duplicati:', err);
        alert('Errore durante la verifica delle iscrizioni. Riprova più tardi.');
      }
    });
  }
}
