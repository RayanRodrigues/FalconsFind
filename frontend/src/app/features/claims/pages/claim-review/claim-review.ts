import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ClaimRequestItem {
  id: string;
  fullName: string;
  email: string;
  referenceCode: string;
  itemName: string;
  claimReason: string;
  proofDetails: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Needs Proof';
  additionalProofRequest?: string;
  proofInput?: string;
}

@Component({
  selector: 'app-claim-review',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './claim-review.html',
  styleUrl: './claim-review.css'
})
export class ClaimReview {
  successMessage = '';
  errorMessage = '';

  claims: ClaimRequestItem[] = [
    {
      id: 'CLM-001',
      fullName: 'Maria Brown',
      email: 'maria@email.com',
      referenceCode: 'FF-1024',
      itemName: 'Black Backpack',
      claimReason: 'I lost it in the library on Tuesday.',
      proofDetails: 'It has a silver water bottle in the side pocket and a Dell laptop inside.',
      status: 'Pending',
      additionalProofRequest: '',
      proofInput: ''
    },
    {
      id: 'CLM-002',
      fullName: 'John Smith',
      email: 'john@email.com',
      referenceCode: 'FF-2048',
      itemName: 'Blue Jacket',
      claimReason: 'I left it in the cafeteria.',
      proofDetails: 'There is a bus pass in the inside pocket.',
      status: 'Pending',
      additionalProofRequest: '',
      proofInput: ''
    }
  ];

  approveClaim(claim: ClaimRequestItem) {
    this.successMessage = '';
    this.errorMessage = '';

    try {
      claim.status = 'Approved';
      this.successMessage = `Claim ${claim.id} was approved successfully.`;
    } catch (error) {
      this.errorMessage = 'There was an error approving the claim.';
      console.error(error);
    }
  }

  rejectClaim(claim: ClaimRequestItem) {
    this.successMessage = '';
    this.errorMessage = '';

    try {
      claim.status = 'Rejected';
      this.successMessage = `Claim ${claim.id} was rejected successfully.`;
    } catch (error) {
      this.errorMessage = 'There was an error rejecting the claim.';
      console.error(error);
    }
  }

  requestAdditionalProof(claim: ClaimRequestItem) {
    this.successMessage = '';
    this.errorMessage = '';

    const message = claim.proofInput?.trim();

    if (!message) {
      this.errorMessage = 'Please enter a proof request message before submitting.';
      return;
    }

    try {
      claim.status = 'Needs Proof';
      claim.additionalProofRequest = message;
      claim.proofInput = '';
      this.successMessage = `Additional proof was requested for claim ${claim.id}.`;
    } catch (error) {
      this.errorMessage = 'There was an error requesting additional proof.';
      console.error(error);
    }
  }
}