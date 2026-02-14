import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl } from '@angular/forms';

@Component({
  selector: 'app-form-field',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="mb-6">
      <label [for]="id" class="block mb-1 font-medium text-sm text-text-primary">
        {{ label }}
        @if (required) {
          <span class="text-red-500 ml-1">*</span>
        }
      </label>
      
      <ng-content></ng-content>
      
      @if (error) {
        <p class="mt-1 text-xs text-red-500 font-medium">{{ error }}</p>
      }
      
      @if (hint && !error) {
        <p class="mt-1 text-xs text-text-secondary">{{ hint }}</p>
      }
    </div>
  `
})
export class FormFieldComponent {
  @Input() id!: string;
  @Input() label!: string;
  @Input() required = false;
  @Input() error: string | null = null;
  @Input() hint?: string;
}
