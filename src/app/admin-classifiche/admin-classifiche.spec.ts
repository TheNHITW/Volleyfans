import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminClassifiche } from './admin-classifiche';

describe('AdminClassifiche', () => {
  let component: AdminClassifiche;
  let fixture: ComponentFixture<AdminClassifiche>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminClassifiche]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminClassifiche);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
