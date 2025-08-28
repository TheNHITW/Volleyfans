import { ComponentFixture, TestBed } from '@angular/core/testing';

import { IscrivitiHome } from './iscriviti-home';

describe('IscrivitiHome', () => {
  let component: IscrivitiHome;
  let fixture: ComponentFixture<IscrivitiHome>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IscrivitiHome]
    })
    .compileComponents();

    fixture = TestBed.createComponent(IscrivitiHome);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
