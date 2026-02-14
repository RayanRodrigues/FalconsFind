import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, ReactiveFormsModule } from '@angular/forms';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <input
      [type]="type"
      [id]="id"
      [placeholder]="placeholder"
      [attr.min]="min ?? null"
      [attr.max]="max ?? null"
      [value]="value"
      (input)="onInput($event)"
      (blur)="onBlur()"
      [disabled]="disabled"
      [class]="inputClasses"
      [attr.aria-invalid]="invalid"
    />
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ]
})
export class InputComponent implements ControlValueAccessor {
  @Input() type = 'text';
  @Input() id!: string;
  @Input() placeholder = '';
  @Input() min?: string;
  @Input() max?: string;
  @Input() invalid = false;
  
  value: string = '';
  disabled = false;
  onChange: any = () => {};
  onTouched: any = () => {};

  get inputClasses() {
    const baseClasses = 'w-full h-10 px-3 border rounded-lg text-sm transition-all duration-200 focus:outline-none';
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

  onInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.value = value;
    this.onChange(value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
