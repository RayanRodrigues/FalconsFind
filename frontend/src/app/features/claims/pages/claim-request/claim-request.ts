import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CardComponent } from '../../../../shared/components/layout/card.component';
import { FormFieldComponent } from '../../../../shared/components/forms/form-field.component';
import { InputComponent } from '../../../../shared/components/forms/input.component';
import { TextareaComponent } from '../../../../shared/components/forms/textarea.component';
import { ButtonComponent } from '../../../../shared/components/buttons/button.component';
import { ReportStepsComponent } from '../../../../shared/components/navigation/report-steps.component';

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
export class ClaimRequest {
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

  constructor(private router: Router) {}

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

  async submitClaim(): Promise<void> {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;

    this.isSubmitting = true;
    this.submitError = null;

    try {
      const response = await fetch('http://localhost:3000/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.form.value),
      });

      if (!response.ok) throw new Error('Failed to submit claim request.');

      this.submitSuccess = true;
    } catch {
      this.submitError = 'There was an error submitting your claim. Please try again.';
    } finally {
      this.isSubmitting = false;
    }
  }

  resetForm(): void {
    this.form.reset();
    this.submitSuccess = false;
    this.submitError = null;
    this.currentStep = 1;
  }
}
