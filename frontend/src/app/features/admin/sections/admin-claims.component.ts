import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

interface Claim {
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
  selector: 'app-admin-claims',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-claims.component.html',
})
export class AdminClaimsComponent {
  readonly toast = signal<{ type: 'success' | 'error'; message: string } | null>(null);
  expandedId: string | null = null;

  claims: Claim[] = [
    { id: 'CLM-001', fullName: 'Maria Brown', email: 'maria@email.com', referenceCode: 'FF-1024', itemName: 'Black Backpack', claimReason: 'I lost it in the library on Tuesday.', proofDetails: 'It has a silver water bottle in the side pocket and a Dell laptop inside.', status: 'Pending', proofInput: '' },
    { id: 'CLM-002', fullName: 'John Smith', email: 'john@email.com', referenceCode: 'FF-2048', itemName: 'Blue Jacket', claimReason: 'I left it in the cafeteria.', proofDetails: 'There is a bus pass in the inside pocket.', status: 'Pending', proofInput: '' },
  ];

  get stats() {
    return {
      total: this.claims.length,
      pending: this.claims.filter(c => c.status === 'Pending').length,
      approved: this.claims.filter(c => c.status === 'Approved').length,
      rejected: this.claims.filter(c => c.status === 'Rejected').length,
    };
  }

  toggle(id: string): void {
    this.expandedId = this.expandedId === id ? null : id;
  }

  approve(claim: Claim): void {
    claim.status = 'Approved';
    this.showToast('success', `Claim ${claim.id} approved.`);
  }

  reject(claim: Claim): void {
    claim.status = 'Rejected';
    this.showToast('success', `Claim ${claim.id} rejected.`);
  }

  requestProof(claim: Claim): void {
    const msg = claim.proofInput?.trim();
    if (!msg) { this.showToast('error', 'Enter a proof request message first.'); return; }
    claim.status = 'Needs Proof';
    claim.additionalProofRequest = msg;
    claim.proofInput = '';
    this.showToast('success', `Additional proof requested for ${claim.id}.`);
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      'Pending': 'bg-warning/15 text-warning border-warning/30',
      'Approved': 'bg-success/10 text-success border-success/30',
      'Rejected': 'bg-error/10 text-error border-error/30',
      'Needs Proof': 'bg-info/10 text-info border-info/30',
    };
    return map[status] ?? 'bg-border/20 text-text-secondary border-border';
  }

  private showToast(type: 'success' | 'error', message: string): void {
    this.toast.set({ type, message });
    setTimeout(() => this.toast.set(null), 4000);
  }
}
