import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-select',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative">
      <select
        [id]="id"
        [value]="value"
        (change)="onSelect($event)"
        (blur)="onBlur()"
        [disabled]="disabled"
        [class]="selectClasses"
        [attr.aria-invalid]="invalid"
      >
        <option value="" disabled selected>{{ placeholder }}</option>
        <ng-content></ng-content>
      </select>
      <div class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
        <svg class="w-4 h-4 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true
    }
  ]
})
export class SelectComponent implements ControlValueAccessor {
  @Input() id!: string;
  @Input() placeholder = 'Select an option';
  @Input() invalid = false;
  
  value: string = '';
  disabled = false;
  onChange: any = () => {};
  onTouched: any = () => {};

  get selectClasses() {
    const baseClasses = 'w-full h-10 px-3 border rounded-lg text-sm appearance-none bg-white cursor-pointer transition-all duration-200 focus:outline-none';
    const stateClasses = this.invalid
      ? 'border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-200'
      : 'border-border focus:border-primary focus:ring-2 focus:ring-primary/20';
    
    return `${baseClasses} ${stateClasses}`;
  }

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.value = value;
    this.onChange(value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
