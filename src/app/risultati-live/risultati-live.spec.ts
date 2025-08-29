import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RisultatiLiveComponent } from './risultati-live';

describe('RisultatiLive', () => {
  let component: RisultatiLiveComponent;
  let fixture: ComponentFixture<RisultatiLiveComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RisultatiLiveComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RisultatiLiveComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
