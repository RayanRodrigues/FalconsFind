import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, Inject, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';

type AdminReport = {
  id: string;
  kind: 'LOST' | 'FOUND';
  title: string;
  description?: string;
  category?: string;
  location?: string;
  dateReported: string;
  status: string;
  referenceCode: string;
  contactEmail?: string;
  photoUrl?: string;
  photoUrls?: string[];
};

type AdminReportsResponse = {
  reports: AdminReport[];
  total: number;
  summary: {
    totalReports: number;
    lostReports: number;
    foundReports: number;
    byStatus: Record<string, number>;
  };
};

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-reports.component.html',
})
export class AdminReportsComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly actionMessage = signal('');
  readonly activeRowId = signal<string | null>(null);
  readonly selectedItem = signal<AdminReport | null>(null);
  readonly selectedPhotoIndex = signal(0);
  allItems: AdminReport[] = [];
  filteredItems: AdminReport[] = [];
  searchTerm = '';
  statusFilter = 'all';

  get stats() {
    const countByStatus = (statuses: string[]) =>
      this.allItems.filter(i => statuses.includes((i.status || '').toLowerCase())).length;

    return {
      total: this.allItems.length,
      pending: countByStatus(['pending_validation', 'pending']),
      validated: countByStatus(['validated', 'approved']),
      rejected: countByStatus(['rejected']),
    };
  }

  constructor(private http: HttpClient, @Inject(PLATFORM_ID) private platformId: Object) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) this.load();
    else this.loading.set(false);
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.actionMessage.set('');
    this.http.get<AdminReportsResponse>('/admin/reports?page=1&limit=100&kind=FOUND').subscribe({
      next: (res) => {
        this.allItems = (res.reports ?? []).map(i => ({ ...i, status: (i.status || 'pending_validation').toLowerCase() }));
        this.applyFilters();
        this.loading.set(false);
      },
      error: () => { this.error.set('Failed to load reports.'); this.loading.set(false); }
    });
  }

  applyFilters(): void {
    const kw = this.searchTerm.trim().toLowerCase();
    this.filteredItems = this.allItems.filter(i => {
      const name = (i.title || '').toLowerCase();
      const loc = (i.location || '').toLowerCase();
      const status = (i.status || '').toLowerCase();
      const ref = (i.referenceCode || '').toLowerCase();
      const kwMatch = !kw || name.includes(kw) || loc.includes(kw) || status.includes(kw) || ref.includes(kw);
      const statusMatch = this.statusFilter === 'all' || status === this.statusFilter;
      return kwMatch && statusMatch;
    });
  }

  approve(id: string): void {
    if (this.activeRowId()) return;

    this.activeRowId.set(id);
    this.actionMessage.set('');
    this.http.patch(`/reports/found/${id}/validate`, {}).subscribe({
      next: () => {
        this.closeDetails();
        this.actionMessage.set('Found item validated successfully.');
        this.load();
      },
      error: () => {
        this.error.set('Failed to validate the found item.');
        this.activeRowId.set(null);
      }
    });
  }

  copyReferenceCode(referenceCode: string): void {
    if (!isPlatformBrowser(this.platformId) || typeof navigator === 'undefined' || !navigator.clipboard) {
      this.actionMessage.set(`Reference code: ${referenceCode}`);
      return;
    }

    navigator.clipboard.writeText(referenceCode)
      .then(() => this.actionMessage.set(`Copied ${referenceCode}.`))
      .catch(() => this.actionMessage.set(`Reference code: ${referenceCode}`));
  }

  copyContactEmail(email?: string): void {
    if (!email) return;

    if (!isPlatformBrowser(this.platformId) || typeof navigator === 'undefined' || !navigator.clipboard) {
      this.actionMessage.set(`Contact email: ${email}`);
      return;
    }

    navigator.clipboard.writeText(email)
      .then(() => this.actionMessage.set(`Copied ${email}.`))
      .catch(() => this.actionMessage.set(`Contact email: ${email}`));
  }

  openDetails(item: AdminReport): void {
    this.selectedItem.set(item);
    this.selectedPhotoIndex.set(0);
  }

  closeDetails(): void {
    this.selectedItem.set(null);
    this.selectedPhotoIndex.set(0);
  }

  openPhoto(photoUrl?: string): void {
    if (!photoUrl || !isPlatformBrowser(this.platformId) || typeof window === 'undefined') return;
    window.open(photoUrl, '_blank', 'noopener,noreferrer');
  }

  statusClass(status?: string): string {
    const map: Record<string, string> = {
      pending: 'bg-warning/15 text-warning border-warning/30',
      pending_validation: 'bg-warning/15 text-warning border-warning/30',
      approved: 'bg-success/10 text-success border-success/30',
      validated: 'bg-success/10 text-success border-success/30',
      rejected: 'bg-error/10 text-error border-error/30',
      claimed: 'bg-info/10 text-info border-info/30',
    };
    return map[status ?? ''] ?? 'bg-border/20 text-text-secondary border-border';
  }

  statusLabel(status?: string): string {
    if (status === 'pending_validation') return 'pending';
    return status || 'unknown';
  }

  canValidate(item: AdminReport): boolean {
    return item.kind === 'FOUND' && item.status === 'pending_validation';
  }

  canOpenPhoto(item: AdminReport): boolean {
    return this.getPhotoUrls(item).length > 0;
  }

  getPhotoUrls(item: AdminReport): string[] {
    const urls = [
      ...(Array.isArray(item.photoUrls) ? item.photoUrls : []),
      ...(item.photoUrl ? [item.photoUrl] : []),
    ].filter((value, index, all) => typeof value === 'string' && value.trim().length > 0 && all.indexOf(value) === index);

    return urls;
  }

  getSelectedPhoto(item: AdminReport): string | null {
    const urls = this.getPhotoUrls(item);
    if (urls.length === 0) {
      return null;
    }

    return urls[this.selectedPhotoIndex()] ?? urls[0] ?? null;
  }

  selectPhoto(index: number): void {
    this.selectedPhotoIndex.set(index);
  }

  trackById(_: number, item: AdminReport): string { return item.id; }
}
