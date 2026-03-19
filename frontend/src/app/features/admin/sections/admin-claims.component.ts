import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ClaimStatus } from '../../../models';
import type { Claim, ErrorResponse } from '../../../models';
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
  readonly showArchived = signal(false);
  expandedId: string | null = null;
  claims: ClaimRow[] = [];
  archivedIds = new Set<string>();

  constructor(
    private readonly adminClaimsApi: AdminClaimsApiService,
    @Inject(PLATFORM_ID) private readonly platformId: object,
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.loadArchivedIds();
      this.load();
      return;
    }

    this.loading.set(false);
  }

  get stats() {
    const activeClaims = this.visibleClaims;
    return {
      total: activeClaims.length,
      pending: activeClaims.filter(c => c.status === ClaimStatus.PENDING).length,
      needsProof: activeClaims.filter(c => c.status === ClaimStatus.NEEDS_PROOF).length,
      approved: activeClaims.filter(c => c.status === ClaimStatus.APPROVED).length,
      rejected: activeClaims.filter(c => c.status === ClaimStatus.REJECTED).length,
    };
  }

  get visibleClaims(): ClaimRow[] {
    return this.claims.filter((claim) => this.showArchived() || !this.archivedIds.has(claim.id));
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

  canArchive(claim: Claim): boolean {
    return claim.status === ClaimStatus.APPROVED
      || claim.status === ClaimStatus.REJECTED
      || claim.status === ClaimStatus.CANCELLED;
  }

  isArchived(claimId: string): boolean {
    return this.archivedIds.has(claimId);
  }

  toggleArchivedVisibility(): void {
    this.showArchived.set(!this.showArchived());
  }

  archiveClaim(claim: ClaimRow): void {
    if (!this.canArchive(claim)) {
      return;
    }

    this.archivedIds = new Set(this.archivedIds).add(claim.id);
    this.persistArchivedIds();
    if (this.expandedId === claim.id) {
      this.expandedId = null;
    }
    this.showToast('success', `Claim ${claim.id} archived from the dashboard list.`);
  }

  restoreClaim(claim: ClaimRow): void {
    if (!this.archivedIds.has(claim.id)) {
      return;
    }

    const next = new Set(this.archivedIds);
    next.delete(claim.id);
    this.archivedIds = next;
    this.persistArchivedIds();
    this.showToast('success', `Claim ${claim.id} restored to the dashboard list.`);
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
        error: (error: ErrorResponse) => this.showToast('error', this.mapClaimActionError(error, fallbackMessage)),
      });
  }

  private mapClaimActionError(error: ErrorResponse, fallbackMessage: string): string {
    switch (error.error?.code) {
      case 'CLAIM_STATUS_CONFLICT':
        return 'This claim is no longer awaiting review. Refresh the dashboard to see its latest status.';
      case 'NOT_FOUND':
      case 'CLAIM_ITEM_NOT_FOUND':
        return 'This claim or its related item could not be found anymore.';
      case 'FORBIDDEN':
        return 'You do not have permission to manage this claim.';
      default:
        return fallbackMessage;
    }
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 4000);
  }

  private loadArchivedIds(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    try {
      const rawValue = window.localStorage.getItem('falconfind.admin.claims.archived');
      const parsed = rawValue ? JSON.parse(rawValue) : [];
      this.archivedIds = new Set(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []);
    } catch {
      this.archivedIds = new Set<string>();
    }
  }

  private persistArchivedIds(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    window.localStorage.setItem(
      'falconfind.admin.claims.archived',
      JSON.stringify(Array.from(this.archivedIds)),
    );
  }
}
