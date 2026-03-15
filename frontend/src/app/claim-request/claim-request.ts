import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-claim-request',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './claim-request.html',
  styleUrl: './claim-request.css'
})
export class ClaimRequest {
  claim = {
    fullName: '',
    email: '',
    phone: '',
    referenceCode: '',
    itemName: '',
    claimReason: '',
    proofDetails: ''
  };

  isSubmitting = false;
  successMessage = '';
  errorMessage = '';

  async submitClaim() {
    this.successMessage = '';
    this.errorMessage = '';

    if (
      !this.claim.fullName.trim() ||
      !this.claim.email.trim() ||
      !this.claim.referenceCode.trim() ||
      !this.claim.itemName.trim() ||
      !this.claim.claimReason.trim() ||
      !this.claim.proofDetails.trim()
    ) {
      this.errorMessage = 'Please fill in all required fields.';
      return;
    }

    this.isSubmitting = true;

    try {
      // Replace this URL later with your real backend endpoint
      const response = await fetch('http://localhost:3000/api/claims', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(this.claim)
      });

      if (!response.ok) {
        throw new Error('Failed to submit claim request.');
      }

      this.successMessage = 'Your claim request has been submitted successfully.';

      this.claim = {
        fullName: '',
        email: '',
        phone: '',
        referenceCode: '',
        itemName: '',
        claimReason: '',
        proofDetails: ''
      };
    } catch (error) {
      this.errorMessage = 'There was an error submitting your claim. Please try again.';
      console.error('Claim submission error:', error);
    } finally {
      this.isSubmitting = false;
    }
  }
}