import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { finalize } from 'rxjs';
import { ClaimStatus } from '../../../../models';
import type { Claim, ErrorResponse } from '../../../../models';
import { ClaimsApiService } from '../../../../core/services/claims-api.service';

@Component({
  selector: 'app-claim-cancel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './claim-cancel.html',
  styleUrl: './claim-cancel.css'
})
export class ClaimCancel implements OnInit {
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly claims = signal<(Claim & { isCancelling?: boolean })[]>([]);
  readonly summary = signal({
    totalClaims: 0,
    pendingClaims: 0,
    needsProofClaims: 0,
    approvedClaims: 0,
    rejectedClaims: 0,
    cancelledClaims: 0,
  });

  constructor(
    private readonly claimsApi: ClaimsApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadClaims();
      return;
    }

    this.loading.set(false);
  }

  loadClaims(): void {
    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    this.claimsApi.listMyClaims()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.claims.set((response.claims ?? []).map((claim) => ({ ...claim, isCancelling: false })));
          this.summary.set(response.summary);
        },
        error: () => {
          this.errorMessage.set('Unable to load your claim requests right now.');
        },
      });
  }

  canCancel(claim: Claim): boolean {
    return claim.status === ClaimStatus.PENDING || claim.status === ClaimStatus.NEEDS_PROOF;
  }

  cancelClaim(claim: Claim & { isCancelling?: boolean }): void {
    if (!this.canCancel(claim) || claim.isCancelling) {
      return;
    }

    const previousStatus = claim.status;
    claim.isCancelling = true;
    this.errorMessage.set('');
    this.successMessage.set('');

    this.claimsApi.cancelClaim(claim.id)
      .pipe(finalize(() => { claim.isCancelling = false; }))
      .subscribe({
        next: () => {
          claim.status = ClaimStatus.CANCELLED;
          this.summary.update((value) => ({
            ...value,
            pendingClaims: previousStatus === ClaimStatus.PENDING ? Math.max(0, value.pendingClaims - 1) : value.pendingClaims,
            needsProofClaims: previousStatus === ClaimStatus.NEEDS_PROOF ? Math.max(0, value.needsProofClaims - 1) : value.needsProofClaims,
            cancelledClaims: value.cancelledClaims + 1,
          }));
          this.successMessage.set(`Claim ${claim.referenceCode} was cancelled successfully.`);
        },
        error: (error: ErrorResponse) => {
          this.errorMessage.set(this.mapCancelError(error));
        },
      });
  }

  statusLabel(status: ClaimStatus): string {
    switch (status) {
      case ClaimStatus.PENDING:
        return 'Pending Review';
      case ClaimStatus.NEEDS_PROOF:
        return 'Needs Proof';
      case ClaimStatus.APPROVED:
        return 'Approved';
      case ClaimStatus.REJECTED:
        return 'Rejected';
      case ClaimStatus.CANCELLED:
        return 'Cancelled';
      default:
        return status;
    }
  }

  statusClass(status: ClaimStatus): string {
    switch (status) {
      case ClaimStatus.PENDING:
        return 'status-badge pending';
      case ClaimStatus.NEEDS_PROOF:
        return 'status-badge needs-proof';
      case ClaimStatus.APPROVED:
        return 'status-badge approved';
      case ClaimStatus.REJECTED:
        return 'status-badge rejected';
      case ClaimStatus.CANCELLED:
        return 'status-badge cancelled';
      default:
        return 'status-badge';
    }
  }

  private mapCancelError(error: ErrorResponse): string {
    switch (error.error?.code) {
      case 'CLAIM_STATUS_CONFLICT':
        return 'This claim can no longer be cancelled.';
      case 'FORBIDDEN':
        return 'You can only cancel your own claim requests.';
      case 'NOT_FOUND':
        return 'This claim could not be found anymore.';
      default:
        return 'There was an error cancelling the claim request.';
    }
  }
}
