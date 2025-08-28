import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-aperivolley-form',
  templateUrl: './aperivolley-form.html',
  standalone: false,
  styleUrls: ['./aperivolley-form.css']
})
export class AperivolleyForm implements OnInit {
  form: FormGroup;
  isSubmitted = false;

  readonly baseUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:3000'
    : 'https://volleyfans-bh.onrender.com';

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.form = this.fb.group({
      fullName: ['', Validators.required],
      age: ['', [Validators.required, Validators.min(10), Validators.max(99)]],
      gender: ['', Validators.required],
      phone: ['', [Validators.required, Validators.pattern('^[0-9]{7,15}$')]],
      email: ['', [Validators.required, Validators.email]],
      note: [''],
      privacyConsent: [false, Validators.requiredTrue]
    });
  }

  ngOnInit(): void {}

  onSubmit(): void {
    if (this.form.invalid) return;

    this.http.post(`${this.baseUrl}/aperivolley`, this.form.value).subscribe({
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
