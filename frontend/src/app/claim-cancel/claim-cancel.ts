import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-claim-cancel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './claim-cancel.html',
  styleUrl: './claim-cancel.css'
})
export class ClaimCancel {
  claim = {
    claimId: 'CLM-001',
    fullName: 'Maria Brown',
    itemName: 'Black Backpack',
    referenceCode: 'FF-1024',
    status: 'Pending'
  };

  confirmationText = '';
  successMessage = '';
  errorMessage = '';
  isCancelling = false;

  cancelClaim() {
    this.successMessage = '';
    this.errorMessage = '';

    if (this.claim.status !== 'Pending') {
      this.errorMessage = 'Only pending claim requests can be cancelled.';
      return;
    }

    if (this.confirmationText.trim().toUpperCase() !== 'CANCEL') {
      this.errorMessage = 'Please type CANCEL to confirm.';
      return;
    }

    this.isCancelling = true;

    try {
      this.claim.status = 'Cancelled';
      this.successMessage = `Claim ${this.claim.claimId} has been cancelled successfully.`;
      this.confirmationText = '';
    } catch (error) {
      this.errorMessage = 'There was an error cancelling the claim request.';
      console.error(error);
    } finally {
      this.isCancelling = false;
    }
  }
}