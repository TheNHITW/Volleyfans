import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminClassificheComponent } from './admin-classifiche';

describe('AdminClassifiche', () => {
  let component: AdminClassificheComponent;
  let fixture: ComponentFixture<AdminClassificheComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminClassificheComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminClassificheComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
