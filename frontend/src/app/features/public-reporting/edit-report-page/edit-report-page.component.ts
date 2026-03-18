import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

type EditableReport = {
  referenceCode: string;
  reportType: 'lost' | 'found';
  title: string;
  location: string;
  date: string;
  description: string;
  contactEmail: string;
};

@Component({
  selector: 'app-edit-report-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './edit-report-page.component.html',
  styleUrl: './edit-report-page.component.css',
})
export class EditReportPageComponent {
  referenceCode = '';
  loading = false;
  lookupAttempted = false;
  reportFound = false;
  saveSuccess = false;
  errorMessage = '';

  report: EditableReport = {
    referenceCode: '',
    reportType: 'lost',
    title: '',
    location: '',
    date: '',
    description: '',
    contactEmail: '',
  };

  findReport() {
    this.loading = true;
    this.lookupAttempted = true;
    this.reportFound = false;
    this.saveSuccess = false;
    this.errorMessage = '';

    const trimmedCode = this.referenceCode.trim().toUpperCase();

    if (trimmedCode === 'FF-1001') {
      this.report = {
        referenceCode: 'FF-1001',
        reportType: 'found',
        title: 'Black Wallet',
        location: 'Library',
        date: '2026-03-10',
        description: 'Black leather wallet found near the front desk.',
        contactEmail: 'student@example.com',
      };

      this.reportFound = true;
    } else if (trimmedCode === 'LF-2001') {
      this.report = {
        referenceCode: 'LF-2001',
        reportType: 'lost',
        title: 'Blue Backpack',
        location: 'Student Centre',
        date: '2026-03-09',
        description: 'Blue backpack with notebooks and a charger inside.',
        contactEmail: 'owner@example.com',
      };

      this.reportFound = true;
    } else {
      this.errorMessage =
        'We could not find a report with that reference code. Please check the code and try again.';
    }

    this.loading = false;
  }

  saveChanges() {
    this.saveSuccess = false;
    this.errorMessage = '';

    if (
      !this.report.title.trim() ||
      !this.report.location.trim() ||
      !this.report.date.trim() ||
      !this.report.description.trim() ||
      !this.report.contactEmail.trim()
    ) {
      this.errorMessage = 'Please complete all fields before saving your changes.';
      return;
    }

    this.saveSuccess = true;
  }

  resetSearch() {
    this.referenceCode = '';
    this.lookupAttempted = false;
    this.reportFound = false;
    this.saveSuccess = false;
    this.errorMessage = '';

    this.report = {
      referenceCode: '',
      reportType: 'lost',
      title: '',
      location: '',
      date: '',
      description: '',
      contactEmail: '',
    };
  }
}