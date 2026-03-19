import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ClaimStatus } from '../../../models';
import type { Claim } from '../../../models';
import { AdminClaimsApiService } from '../../../core/services/admin-claims-api.service';
type ClaimRow = Claim & { proofInput?: string; isUpdating?: boolean };

@Component({
  selector: 'app-admin-claims',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-claims.component.html',
})
export class AdminClaimsComponent implements OnInit {
  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  expandedId: string | null = null;
  claims: ClaimRow[] = [];

  constructor(
    private readonly adminClaimsApi: AdminClaimsApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.load();
      return;
    }

    this.loading.set(false);
  }

  get stats() {
    return {
      total: this.claims.length,
      pending: this.claims.filter(c => c.status === ClaimStatus.PENDING).length,
      needsProof: this.claims.filter(c => c.status === ClaimStatus.NEEDS_PROOF).length,
      approved: this.claims.filter(c => c.status === ClaimStatus.APPROVED).length,
      rejected: this.claims.filter(c => c.status === ClaimStatus.REJECTED).length,
    };
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.adminClaimsApi.listClaims()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.claims = (response.claims ?? []).map((claim) => ({
            ...claim,
            proofInput: '',
            isUpdating: false,
          }));
        },
        error: () => {
          this.error.set('Failed to load claim requests.');
        },
      });
  }

  toggle(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  approve(claim: ClaimRow): void {
    this.runClaimAction(claim, () => this.adminClaimsApi.approveClaim(claim.id), () => {
      claim.status = ClaimStatus.APPROVED;
      this.showToast('success', `Claim ${claim.id} approved.`);
    }, 'Failed to approve claim.');
  }

  reject(claim: ClaimRow): void {
    this.runClaimAction(claim, () => this.adminClaimsApi.rejectClaim(claim.id), () => {
      claim.status = ClaimStatus.REJECTED;
      this.showToast('success', `Claim ${claim.id} rejected.`);
    }, 'Failed to reject claim.');
  }

  requestProof(claim: ClaimRow): void {
    const msg = claim.proofInput?.trim();
    if (!msg) { this.showToast('error', 'Enter a proof request message first.'); return; }
    this.runClaimAction(
      claim,
      () => this.adminClaimsApi.requestAdditionalProof(claim.id, msg),
      () => {
        claim.status = ClaimStatus.NEEDS_PROOF;
        claim.additionalProofRequest = msg;
        claim.proofInput = '';
        this.showToast('success', `Additional proof requested for ${claim.id}.`);
      },
      'Failed to request additional proof.',
    );
  }

  statusClass(status: ClaimStatus): string {
    const map: Record<string, string> = {
      [ClaimStatus.PENDING]: 'bg-warning/15 text-warning border-warning/30',
      [ClaimStatus.APPROVED]: 'bg-success/10 text-success border-success/30',
      [ClaimStatus.REJECTED]: 'bg-error/10 text-error border-error/30',
      [ClaimStatus.NEEDS_PROOF]: 'bg-info/10 text-info border-info/30',
      [ClaimStatus.CANCELLED]: 'bg-border/20 text-text-secondary border-border',
    };
    return map[status] ?? 'bg-border/20 text-text-secondary border-border';
  }

  statusLabel(status: ClaimStatus): string {
    switch (status) {
      case ClaimStatus.PENDING:
        return 'Pending';
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

  private runClaimAction(
    claim: ClaimRow,
    action: () => import('rxjs').Observable<unknown>,
    onSuccess: () => void,
    fallbackMessage: string,
  ): void {
    if (claim.isUpdating) {
      return;
    }

    claim.isUpdating = true;
    action()
      .pipe(finalize(() => {
        claim.isUpdating = false;
      }))
      .subscribe({
        next: () => onSuccess(),
        error: () => this.showToast('error', fallbackMessage),
      });
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
