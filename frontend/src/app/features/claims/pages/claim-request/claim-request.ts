import { Component, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { CardComponent } from '../../../../shared/components/layout/card.component';
import { FormFieldComponent } from '../../../../shared/components/forms/form-field.component';
import { InputComponent } from '../../../../shared/components/forms/input.component';
import { TextareaComponent } from '../../../../shared/components/forms/textarea.component';
import { ButtonComponent } from '../../../../shared/components/buttons/button.component';
import { ReportStepsComponent } from '../../../../shared/components/navigation/report-steps.component';
import { ClaimsApiService, type CreateClaimResponse } from '../../../../core/services/claims-api.service';
import { AuthService } from '../../../../core/services/auth.service';
import type { ErrorResponse } from '../../../../models';

@Component({
  selector: 'app-claim-request',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    CardComponent,
    FormFieldComponent,
    InputComponent,
    TextareaComponent,
    ButtonComponent,
    ReportStepsComponent,
  ],
  templateUrl: './claim-request.html',
  styleUrl: './claim-request.css',
})
export class ClaimRequest implements OnInit {
  private readonly fb = new FormBuilder();

  readonly form = this.fb.group({
    referenceCode: ['', [Validators.required]],
    itemName: ['', [Validators.required, Validators.minLength(2)]],
    claimReason: ['', [Validators.required, Validators.minLength(20)]],
    proofDetails: ['', [Validators.required, Validators.minLength(20)]],
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: [''],
  });

  readonly stepLabels: [string, string, string] = ['Item', 'Your Claim', 'Contact'];

  private readonly stepFields: Record<number, string[]> = {
    1: ['referenceCode', 'itemName'],
    2: ['claimReason', 'proofDetails'],
    3: ['fullName', 'email'],
  };

  currentStep = 1;
  readonly totalSteps = 3;
  isSubmitting = false;
  submitSuccess = false;
  submitError: string | null = null;
  claimResult: CreateClaimResponse | null = null;

  constructor(
    private readonly router: Router,
    private readonly claimsApi: ClaimsApiService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    const session = this.authService.getStoredSession();
    if (session) {
      this.form.patchValue({
        email: session.user.email,
        fullName: session.user.displayName ?? '',
      });
    }
  }

  getFieldError(field: string): string | null {
    const ctrl = this.form.get(field);
    if (!ctrl?.touched || !ctrl.errors) return null;
    if (ctrl.hasError('required')) return 'This field is required.';
    if (ctrl.hasError('email')) return 'Enter a valid email address.';
    if (ctrl.hasError('minlength')) return `Please provide more detail.`;
    return null;
  }

  isFieldInvalid(field: string): boolean {
    const ctrl = this.form.get(field);
    return !!ctrl && ctrl.touched && ctrl.invalid;
  }

  nextStep(): void {
    const fields = this.stepFields[this.currentStep] ?? [];
    fields.forEach(f => this.form.get(f)?.markAsTouched());
    const anyInvalid = fields.some(f => this.form.get(f)?.invalid);
    if (anyInvalid) return;
    this.currentStep = Math.min(this.currentStep + 1, this.totalSteps);
  }

  previousStep(): void {
    this.currentStep = Math.max(this.currentStep - 1, 1);
  }

  navigateHome(): void {
    this.router.navigate(['/']);
  }

  submitClaim(): void {
    if (this.isSubmitting || this.submitSuccess) {
      return;
    }

    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    const v = this.form.value;

    this.isSubmitting = true;
    this.submitError = null;

    this.claimsApi.createClaim({
      referenceCode: v.referenceCode ?? '',
      itemName: v.itemName ?? '',
      claimReason: v.claimReason ?? '',
      proofDetails: v.proofDetails ?? '',
      claimantName: v.fullName ?? '',
      claimantEmail: v.email ?? '',
      phone: v.phone?.trim() || undefined,
    })
      .pipe(finalize(() => { this.isSubmitting = false; }))
      .subscribe({
        next: (result) => {
          this.claimResult = result;
          this.submitSuccess = true;
        },
        error: (err: ErrorResponse) => {
          this.submitError = this.mapClaimError(err);
        },
      });
  }

  private mapClaimError(err: ErrorResponse): string {
    switch (err.error?.code) {
      case 'NOT_FOUND':
        return 'No item found with that reference code. Please check and try again.';
      case 'ITEM_NOT_ELIGIBLE_FOR_CLAIM':
        return 'This item is not currently available for claim requests.';
      case 'VALIDATION_ERROR':
        return err.error.message || 'Please check your submission and try again.';
      default:
        return 'There was an error submitting your claim. Please try again.';
    }
  }

  resetForm(): void {
    this.form.reset();
    this.submitSuccess = false;
    this.submitError = null;
    this.claimResult = null;
    this.currentStep = 1;
    this.ngOnInit();
  }
}
