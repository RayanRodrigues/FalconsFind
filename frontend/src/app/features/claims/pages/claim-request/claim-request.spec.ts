import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ClaimRequest } from './claim-request';
import { ClaimsApiService, type CreateClaimResponse } from '../../../../core/services/claims-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import type { LoginResponse } from '../../../../models';

const mockSession: LoginResponse = {
  idToken: 'token',
  refreshToken: 'refresh',
  expiresIn: 3600,
  user: {
    uid: 'u1',
    email: 'student@fanshaweonline.ca',
    role: 'STUDENT' as never,
    displayName: 'Jane Doe',
    trusted: true,
  },
};

const successResult: CreateClaimResponse = {
  id: 'claim-abc',
  status: 'PENDING',
  createdAt: '2026-03-18T00:00:00.000Z',
};

describe('ClaimRequest', () => {
  let component: ClaimRequest;
  let fixture: ComponentFixture<ClaimRequest>;
  let createClaimSpy: ReturnType<typeof vi.fn>;
  let getStoredSessionSpy: ReturnType<typeof vi.fn>;

  async function setup(
    createClaimReturn = of(successResult),
    session: LoginResponse | null = mockSession,
  ): Promise<void> {
    createClaimSpy = vi.fn().mockReturnValue(createClaimReturn);
    getStoredSessionSpy = vi.fn().mockReturnValue(session);

    await TestBed.configureTestingModule({
      imports: [ClaimRequest],
      providers: [
        provideRouter([]),
        { provide: ClaimsApiService, useValue: { createClaim: createClaimSpy } },
        { provide: AuthService, useValue: { getStoredSession: getStoredSessionSpy } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimRequest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  const fillAllSteps = (comp: ClaimRequest) => {
    comp.form.patchValue({
      referenceCode: 'FF-2024-00001',
      itemName: 'Black laptop sleeve',
      claimReason: 'I left this item in room B1040 on Friday morning after class.',
      proofDetails: 'It has a small FalconFind sticker on the back and my name inside.',
      fullName: 'Jane Doe',
      email: 'student@fanshaweonline.ca',
      phone: '519-555-0100',
    });
  };

  it('should create', async () => {
    await setup();
    expect(component).toBeTruthy();
  });

  describe('ngOnInit – session pre-fill', () => {
    it('pre-fills email and fullName from the stored session', async () => {
      await setup();
      expect(component.form.get('email')?.value).toBe('student@fanshaweonline.ca');
      expect(component.form.get('fullName')?.value).toBe('Jane Doe');
    });

    it('leaves email and fullName blank when no session exists', async () => {
      await setup(of(successResult), null);
      expect(component.form.get('email')?.value).toBe('');
      expect(component.form.get('fullName')?.value).toBe('');
    });
  });

  describe('step navigation', () => {
    beforeEach(() => setup());

    it('starts on step 1', () => {
      expect(component.currentStep).toBe(1);
    });

    it('does not advance when step-1 fields are invalid', () => {
      component.nextStep();
      expect(component.currentStep).toBe(1);
    });

    it('advances to step 2 when step-1 fields are valid', () => {
      component.form.patchValue({ referenceCode: 'FF-001', itemName: 'Red backpack' });
      component.nextStep();
      expect(component.currentStep).toBe(2);
    });

    it('does not advance to step 3 when step-2 fields are too short', () => {
      component.form.patchValue({ referenceCode: 'FF-001', itemName: 'Red backpack' });
      component.nextStep();
      component.form.patchValue({ claimReason: 'short', proofDetails: 'short' });
      component.nextStep();
      expect(component.currentStep).toBe(2);
    });

    it('advances to step 3 when all step fields meet the minimum length', () => {
      component.form.patchValue({
        referenceCode: 'FF-001',
        itemName: 'Red backpack',
        claimReason: 'I left this bag in the library yesterday afternoon.',
        proofDetails: 'It has my initials JD scratched on the inside zipper.',
      });
      component.nextStep(); // 1 → 2
      component.nextStep(); // 2 → 3
      expect(component.currentStep).toBe(3);
    });

    it('goes back a step via previousStep()', () => {
      component.form.patchValue({ referenceCode: 'FF-001', itemName: 'Red backpack' });
      component.nextStep();
      component.previousStep();
      expect(component.currentStep).toBe(1);
    });

    it('does not go below step 1', () => {
      component.previousStep();
      expect(component.currentStep).toBe(1);
    });
  });

  describe('submitClaim()', () => {
    it('does not call the API when the form is invalid', async () => {
      await setup();
      component.submitClaim();
      expect(createClaimSpy).not.toHaveBeenCalled();
    });

    it('calls createClaim with the correctly mapped payload', async () => {
      await setup();
      fillAllSteps(component);
      component.submitClaim();

      expect(createClaimSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          referenceCode: 'FF-2024-00001',
          claimantName: 'Jane Doe',
          claimantEmail: 'student@fanshaweonline.ca',
        }),
      );
    });

    it('includes claimReason, proofDetails and phone in the message', async () => {
      await setup();
      fillAllSteps(component);
      component.submitClaim();

      const payload = createClaimSpy.mock.calls[0][0];
      expect(payload.message).toContain('Claim Reason:');
      expect(payload.message).toContain('Proof of Ownership:');
      expect(payload.message).toContain('Phone: 519-555-0100');
    });

    it('omits phone from message when field is empty', async () => {
      await setup();
      fillAllSteps(component);
      component.form.patchValue({ phone: '' });
      component.submitClaim();

      const payload = createClaimSpy.mock.calls[0][0];
      expect(payload.message).not.toContain('Phone:');
    });

    it('sets submitSuccess and stores claimResult on success', async () => {
      await setup();
      fillAllSteps(component);
      component.submitClaim();

      expect(component.submitSuccess).toBe(true);
      expect(component.claimResult?.id).toBe('claim-abc');
      expect(component.claimResult?.status).toBe('PENDING');
    });

    it('sets a reference-code error message for NOT_FOUND', async () => {
      await setup(throwError(() => ({ error: { code: 'NOT_FOUND', message: '' } })));
      fillAllSteps(component);
      component.submitClaim();

      expect(component.submitSuccess).toBe(false);
      expect(component.submitError).toContain('reference code');
    });

    it('sets an ineligible error message for ITEM_NOT_ELIGIBLE_FOR_CLAIM', async () => {
      await setup(throwError(() => ({ error: { code: 'ITEM_NOT_ELIGIBLE_FOR_CLAIM', message: '' } })));
      fillAllSteps(component);
      component.submitClaim();

      expect(component.submitError).toContain('not currently available');
    });

    it('sets a generic error message for unexpected errors', async () => {
      await setup(throwError(() => ({ error: { code: 'INTERNAL_ERROR', message: '' } })));
      fillAllSteps(component);
      component.submitClaim();

      expect(component.submitError).toContain('error submitting');
    });
  });

  describe('resetForm()', () => {
    it('clears state and re-pre-fills from the session', async () => {
      await setup();
      component.submitSuccess = true;
      component.claimResult = { id: 'x', status: 'PENDING', createdAt: '' };
      component.submitError = 'some error';
      component.currentStep = 3;

      component.resetForm();

      expect(component.submitSuccess).toBe(false);
      expect(component.claimResult).toBeNull();
      expect(component.submitError).toBeNull();
      expect(component.currentStep).toBe(1);
      expect(component.form.get('email')?.value).toBe('student@fanshaweonline.ca');
    });
  });
});
