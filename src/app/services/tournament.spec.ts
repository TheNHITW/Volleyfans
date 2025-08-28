import { TestBed } from '@angular/core/testing';

import { TournamentService } from './tournament';

describe('Tournament', () => {
  let service: TournamentService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TournamentService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
