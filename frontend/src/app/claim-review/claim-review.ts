import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

interface ClaimRequestItem {
  id: string;
  fullName: string;
  email: string;
  referenceCode: string;
  itemName: string;
  claimReason: string;
  proofDetails: string;
  status: 'Pending' | 'Approved' | 'Rejected';
}

@Component({
  selector: 'app-claim-review',
  standalone: true,
  imports: [CommonModule],
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
      status: 'Pending'
    },
    {
      id: 'CLM-002',
      fullName: 'John Smith',
      email: 'john@email.com',
      referenceCode: 'FF-2048',
      itemName: 'Blue Jacket',
      claimReason: 'I left it in the cafeteria.',
      proofDetails: 'There is a bus pass in the inside pocket.',
      status: 'Pending'
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
}