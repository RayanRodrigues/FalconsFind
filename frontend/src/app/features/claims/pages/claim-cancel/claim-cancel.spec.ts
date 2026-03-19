import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ClaimsApiService } from '../../../../core/services/claims-api.service';
import { ClaimCancel } from './claim-cancel';

describe('ClaimCancel', () => {
  let component: ClaimCancel;
  let fixture: ComponentFixture<ClaimCancel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimCancel],
      providers: [
        {
          provide: ClaimsApiService,
          useValue: {
            listMyClaims: vi.fn().mockReturnValue(of({
              claims: [],
              total: 0,
              summary: {
                totalClaims: 0,
                pendingClaims: 0,
                needsProofClaims: 0,
                approvedClaims: 0,
                rejectedClaims: 0,
                cancelledClaims: 0,
              },
            })),
            cancelClaim: vi.fn().mockReturnValue(of({
              id: 'claim-1',
              status: 'CANCELLED',
              itemId: 'item-1',
              itemStatus: 'VALIDATED',
            })),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimCancel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
