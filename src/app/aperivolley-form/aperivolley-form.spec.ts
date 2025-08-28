import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AperivolleyForm } from './aperivolley-form';

describe('AperivolleyForm', () => {
  let component: AperivolleyForm;
  let fixture: ComponentFixture<AperivolleyForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AperivolleyForm]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AperivolleyForm);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
