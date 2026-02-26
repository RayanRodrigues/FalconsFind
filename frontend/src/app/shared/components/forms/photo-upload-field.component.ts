import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormFieldComponent } from './form-field.component';

@Component({
  selector: 'app-photo-upload-field',
  standalone: true,
  imports: [CommonModule, FormFieldComponent],
  template: `
    <app-form-field [id]="id" [label]="label" [required]="required" [error]="error">
      <div class="border-2 border-dashed border-border rounded-lg bg-bg-secondary hover:border-primary hover:bg-primary/5 transition-all duration-200 p-4">
        <input
          #photosInput
          [id]="inputId"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/jpg"
          (change)="onFileInputChange($event)"
          class="hidden"
        />

        @if (hasPhotos) {
          <div class="flex items-center justify-between mb-3">
            <div class="text-sm text-text-secondary">JPEG, PNG up to 5MB each (max 5)</div>
            <button
              type="button"
              (click)="photosInput.click()"
              class="px-3 py-2 rounded-md border border-border text-sm font-medium hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition"
            >
              Add More
            </button>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            @for (url of photoPreviewUrls; track $index) {
              <div class="relative">
                <img
                  [src]="url"
                  alt="Selected photo preview"
                  class="w-full aspect-square rounded-md object-cover border border-border"
                />
                <button
                  type="button"
                  (click)="removePhoto.emit($index)"
                  aria-label="Remove photo"
                  class="absolute top-2 right-2 z-30 rounded-md bg-white/95 border border-black text-black p-2 shadow-md hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 transition"
                >
                  <svg viewBox="0 0 24 24" class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6l-12 12" />
                  </svg>
                </button>
              </div>
            }
          </div>
        } @else {
          <div
            class="text-center py-8 rounded-md cursor-pointer transition"
            [ngClass]="isDropActive ? 'bg-primary/10 border border-primary' : ''"
            (click)="photosInput.click()"
            (dragover)="onDragOver($event)"
            (dragleave)="onDragLeave($event)"
            (drop)="onDrop($event)"
          >
            <div class="text-sm text-text-secondary mb-3">JPEG, PNG up to 5MB each (max 5)</div>
            <svg class="w-8 h-8 text-text-secondary mx-auto mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M3 16.5V8.25a2.25 2.25 0 0 1 2.25-2.25h2.379a1.5 1.5 0 0 0 1.06-.44l.622-.62a1.5 1.5 0 0 1 1.06-.44h3.258a1.5 1.5 0 0 1 1.06.44l.622.62a1.5 1.5 0 0 0 1.06.44h2.379A2.25 2.25 0 0 1 21 8.25v8.25A2.25 2.25 0 0 1 18.75 18.75H5.25A2.25 2.25 0 0 1 3 16.5Z" />
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
            <span class="font-medium text-text-primary block">Click to upload or drag and drop</span>
            <span class="text-xs text-text-secondary block mt-1">No photos selected</span>
          </div>
        }
      </div>
    </app-form-field>
  `
})
export class PhotoUploadFieldComponent {
  @Input() id = 'photos';
  @Input() inputId = 'photosInput';
  @Input() label = 'Photos';
  @Input() required = false;
  @Input() error: string | null = null;
  @Input() photosCount = 0;
  @Input() photoPreviewUrls: string[] = [];

  @Output() filesSelected = new EventEmitter<File[]>();
  @Output() removePhoto = new EventEmitter<number>();

  isDropActive = false;

  get hasPhotos(): boolean {
    return this.photosCount > 0 && this.photoPreviewUrls.length > 0;
  }

  onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    this.filesSelected.emit(files);
    input.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDropActive = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDropActive = false;
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDropActive = false;
    const files = Array.from(event.dataTransfer?.files ?? []);
    this.filesSelected.emit(files);
  }
}
