import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ChangeDetectorRef, Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { ClaimStatus } from '../../../../models';
import type { Claim, ErrorResponse } from '../../../../models';
import { ClaimsApiService } from '../../../../core/services/claims-api.service';
import { PhotoUploadFieldComponent } from '../../../../shared/components/forms/photo-upload-field.component';
import { mergeSelectedPhotos } from '../../../../shared/utils/photo-upload.util';

type ClaimRow = Claim & {
  isCancelling?: boolean;
  isEditing?: boolean;
  isSavingEdit?: boolean;
  isSubmittingProof?: boolean;
  editItemName?: string;
  editClaimReason?: string;
  editProofDetails?: string;
  editPhone?: string;
  proofResponseDraft?: string;
  pendingProofPhotos?: File[];
  pendingProofPreviewUrls?: string[];
  proofError?: string;
  editError?: string;
};

@Component({
  selector: 'app-claim-cancel',
  standalone: true,
  imports: [CommonModule, FormsModule, PhotoUploadFieldComponent],
  templateUrl: './claim-cancel.html',
  styleUrl: './claim-cancel.css'
})
export class ClaimCancel implements OnInit {
  readonly loading = signal(true);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly claims = signal<ClaimRow[]>([]);
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
    private readonly cdr: ChangeDetectorRef,
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
          this.claims.set((response.claims ?? []).map((claim) => ({
            ...claim,
            isCancelling: false,
            isEditing: false,
            isSavingEdit: false,
            isSubmittingProof: false,
            editItemName: claim.itemName,
            editClaimReason: claim.claimReason,
            editProofDetails: claim.proofDetails,
            editPhone: claim.phone ?? '',
            proofResponseDraft: '',
            pendingProofPhotos: [],
            pendingProofPreviewUrls: [],
            proofError: '',
            editError: '',
          })));
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

  cancelClaim(claim: ClaimRow): void {
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

  canSubmitProof(claim: Claim): boolean {
    return claim.status === ClaimStatus.NEEDS_PROOF;
  }

  canEdit(claim: Claim): boolean {
    return claim.status === ClaimStatus.PENDING || claim.status === ClaimStatus.NEEDS_PROOF;
  }

  toggleEdit(claim: ClaimRow): void {
    claim.isEditing = !claim.isEditing;
    claim.editError = '';

    if (claim.isEditing) {
      claim.editItemName = claim.itemName;
      claim.editClaimReason = claim.claimReason;
      claim.editProofDetails = claim.proofDetails;
      claim.editPhone = claim.phone ?? '';
    }
  }

  saveEdit(claim: ClaimRow): void {
    if (!this.canEdit(claim) || claim.isSavingEdit) {
      return;
    }

    const itemName = claim.editItemName?.trim() ?? '';
    const claimReason = claim.editClaimReason?.trim() ?? '';
    const proofDetails = claim.editProofDetails?.trim() ?? '';
    const phone = claim.editPhone?.trim() ?? '';

    if (itemName.length < 2 || claimReason.length < 20 || proofDetails.length < 20) {
      claim.editError = 'Please complete all claim details before saving.';
      return;
    }

    claim.isSavingEdit = true;
    claim.editError = '';
    this.claimsApi.updateClaim(claim.id, {
      itemName,
      claimReason,
      proofDetails,
      phone: phone || undefined,
    })
      .pipe(finalize(() => { claim.isSavingEdit = false; }))
      .subscribe({
        next: (response) => {
          claim.itemName = response.itemName;
          claim.claimReason = response.claimReason;
          claim.proofDetails = response.proofDetails;
          claim.phone = response.phone;
          claim.isEditing = false;
          this.successMessage.set(`Claim ${claim.referenceCode} was updated successfully.`);
        },
        error: (error: ErrorResponse) => {
          claim.editError = this.mapEditError(error);
        },
      });
  }

  onProofPhotosSelected(claim: ClaimRow, files: File[]): void {
    const currentPhotos = claim.pendingProofPhotos ?? [];
    const { photos: nextPhotos, error: nextError } = mergeSelectedPhotos(currentPhotos, files);
    claim.pendingProofPhotos = nextPhotos;
    claim.proofError = nextError ?? '';
    void this.rebuildPreviewUrls(claim, nextPhotos);
  }

  removeProofPhoto(claim: ClaimRow, index: number): void {
    const currentPhotos = claim.pendingProofPhotos ?? [];
    const nextPhotos = currentPhotos.filter((_, currentIndex) => currentIndex !== index);
    claim.pendingProofPhotos = nextPhotos;
    void this.rebuildPreviewUrls(claim, nextPhotos);
  }

  submitProof(claim: ClaimRow): void {
    if (!this.canSubmitProof(claim) || claim.isSubmittingProof) {
      return;
    }

    const message = claim.proofResponseDraft?.trim() ?? '';
    if (message.length < 10) {
      claim.proofError = 'Please describe your proof in a bit more detail.';
      return;
    }

    claim.isSubmittingProof = true;
    claim.proofError = '';
    this.errorMessage.set('');
    this.successMessage.set('');

    const formData = new FormData();
    formData.append('message', message);

    for (const photo of claim.pendingProofPhotos ?? []) {
      formData.append('photos', photo);
    }

    this.claimsApi.submitProof(claim.id, formData)
      .pipe(finalize(() => { claim.isSubmittingProof = false; }))
      .subscribe({
        next: (response) => {
          claim.status = ClaimStatus.PENDING;
          claim.proofResponseMessage = response.proofResponseMessage;
          claim.proofResponsePhotoUrls = response.proofResponsePhotoUrls ?? [];
          claim.proofRespondedAt = response.proofRespondedAt;
          claim.proofResponseDraft = '';
          claim.pendingProofPhotos = [];
          claim.pendingProofPreviewUrls = [];
          claim.proofError = '';
          this.summary.update((value) => ({
            ...value,
            pendingClaims: value.pendingClaims + 1,
            needsProofClaims: Math.max(0, value.needsProofClaims - 1),
          }));
          this.successMessage.set(`Additional proof for ${claim.referenceCode} was submitted successfully.`);
        },
        error: (error: ErrorResponse) => {
          claim.proofError = this.mapProofError(error);
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

  private mapProofError(error: ErrorResponse): string {
    switch (error.error?.code) {
      case 'CLAIM_STATUS_CONFLICT':
        return 'This claim is no longer waiting for additional proof.';
      case 'FORBIDDEN':
        return 'You can only respond to your own claim requests.';
      case 'NOT_FOUND':
      case 'CLAIM_ITEM_NOT_FOUND':
        return 'This claim is no longer available.';
      case 'BAD_REQUEST':
        return error.error.message || 'Please review your proof details and photos.';
      default:
        return 'There was an error submitting your additional proof.';
    }
  }

  private mapEditError(error: ErrorResponse): string {
    switch (error.error?.code) {
      case 'CLAIM_STATUS_CONFLICT':
        return 'This claim can no longer be edited.';
      case 'FORBIDDEN':
        return 'You can only edit your own claim requests.';
      case 'NOT_FOUND':
        return 'This claim could not be found anymore.';
      case 'BAD_REQUEST':
        return error.error.message || 'Please review the updated claim details.';
      default:
        return 'There was an error saving your claim changes.';
    }
  }

  private async rebuildPreviewUrls(claim: ClaimRow, files: File[]): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) {
      claim.pendingProofPreviewUrls = [];
      return;
    }

    const urls = await Promise.all(
      files.map((file) => new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve((event.target?.result as string) ?? '');
        reader.onerror = () => resolve('');
        reader.readAsDataURL(file);
      })),
    );

    claim.pendingProofPreviewUrls = urls.filter(Boolean);
    this.cdr.markForCheck();
  }
}
