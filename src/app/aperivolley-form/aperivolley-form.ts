import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-aperivolley-form',
  templateUrl: './aperivolley-form.html',
  standalone: false,
  styleUrls: ['./aperivolley-form.css'],
})

export class AperivolleyForm implements OnInit {
  displayedAperColumns: string[] = [
    'index', 'fullName', 'phone', 'peopleCount', 'hasTeam'
  ];
  
  readonly availableDates = [
  { label: 'Domenica 14 Settembre 2025', value: '2025-09-14' },
  { label: 'Domenica 5 Ottobre 2025',     value: '2025-10-05' }
];

  form: FormGroup;
  isSubmitted = false;

  readonly baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://volleyfans-bh.onrender.com';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.form = this.fb.group({
      fullName: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{7,15}$')]],
      age: [
        '',
        [
          Validators.required,
          Validators.pattern('^[0-9]+$'), // solo cifre
          Validators.min(0),              // 0 può venire anche da solo
          Validators.max(20)              // opzionale: limite superiore ragionevole
        ]
      ],
      note: [''],
      privacyConsent: [false, Validators.requiredTrue],
      eventDate: ['', Validators.required],
    });
  } 

  ngOnInit(): void {}

  onSubmit(): void {
    if (this.form.invalid) return;

    // normalizza numero
    const raw = this.form.value;
    const peopleCount = parseInt(raw.age, 10);
    const payload = {
      fullName: raw.fullName?.trim(),
      phone: (raw.phone ?? '').toString().trim(),
      peopleCount: Number.isFinite(peopleCount) ? peopleCount : 1,
      note: raw.note ?? '',
      privacyConsent: !!raw.privacyConsent,
      date: raw.eventDate
    };

    this.http.post(`${this.baseUrl}/aperivolley`, payload).subscribe({
      next: () => {
        this.isSubmitted = true;
        this.form.reset();
      },
      error: err => {
        console.error('Errore invio:', err);
        alert('Errore durante l’invio. Riprova più tardi.');
      }
    });
  }
}
