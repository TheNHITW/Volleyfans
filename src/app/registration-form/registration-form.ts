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
  dateOptions = [
  { value: '2025-09-14', label: 'Domenica 14 Settembre 2025' },
  { value: '2025-10-05', label: 'Domenica 5 Ottobre 2025' }
];

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.registrationForm = this.fb.group({
      teamName: ['', Validators.required],         
      livello: ['', Validators.required],          
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{7,15}$')]],
      players: this.fb.array([
        this.createPlayer(),
        this.createPlayer(),
        this.createPlayer(),
        this.createPlayer()
      ]),
      selectedDates: [[], [Validators.required, this.minLengthArray(1)]],
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

  minLengthArray(min: number) {
  return (control: FormArray | any) => {
    return control && control.value && control.value.length >= min
      ? null
      : { minLengthArray: true };
  };
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

    const allDates: string[] = formData.selectedDates;
    let allRegistrations: any[] = [];

    Promise.all(
      allDates.map((date: string) =>
        this.http.get<any[]>(`${this.baseUrl}/admin/registrations?date=${date}`).toPromise()
      )
    ).then((results) => {
      allRegistrations = results.flat();

      const teamNameTaken = allRegistrations.some(t => (t.teamName || '').trim().toLowerCase() === teamName);
      if (teamNameTaken) {
        alert('Nome squadra già iscritto.');
        return;
      }

      const allRegisteredNames = allRegistrations.flatMap(t =>
        (t.players || []).map((p: Player) => (p.name || '').trim().toLowerCase())
      );
      const duplicated = names.find(name => allRegisteredNames.includes(name));
      if (duplicated) {
        alert(`Il giocatore "${duplicated}" è già iscritto in un'altra squadra.`);
        return;
      }

      // ✅ Normalizza: lasciamo "livello" nel form, ma inviamo "skillLevel" nel payload
      const payloadBase = {
        teamName: formData.teamName,
        phone: formData.phone,
        players: formData.players,
        privacyConsent: formData.privacyConsent,
        skillLevel: formData.skillLevel || 'Non specificato', // <-- già giusto
      };

      // Supportiamo più date: il backend salverà una entry per ciascuna data
      const payload = { ...payloadBase, selectedDates: allDates };

      this.http.post(`${this.baseUrl}/register`, payload).subscribe({
        next: () => {
          alert('Iscrizione inviata! Squadra registrata.');
          this.registrationForm.reset();
        },
        error: (err) => {
          console.error('Errore iscrizione:', err);
          alert('Si è verificato un errore. Riprova.');
        }
      });
    }).catch((err) => {
      console.error('Errore durante la verifica delle iscrizioni:', err);
      alert('Errore durante la verifica. Riprova più tardi.');
    });
  }
}
