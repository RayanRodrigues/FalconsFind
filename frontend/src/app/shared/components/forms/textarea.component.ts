import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

@Component({
  selector: 'app-textarea',
  standalone: true,
  imports: [CommonModule],
  template: `
    <textarea
      [id]="id"
      [rows]="rows"
      [placeholder]="placeholder"
      [value]="value"
      (input)="onInput($event)"
      (blur)="onBlur()"
      [disabled]="disabled"
      [class]="textareaClasses"
      [attr.aria-invalid]="invalid"
    ></textarea>
  `,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true
    }
  ]
})
export class TextareaComponent implements ControlValueAccessor {
  @Input() id!: string;
  @Input() rows = 4;
  @Input() placeholder = '';
  @Input() invalid = false;
  
  value: string = '';
  disabled = false;
  onChange: any = () => {};
  onTouched: any = () => {};

  get textareaClasses() {
    const baseClasses = 'w-full px-3 py-2 border rounded-lg text-sm transition-all duration-200 focus:outline-none resize-vertical';
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
    const value = (event.target as HTMLTextAreaElement).value;
    this.value = value;
    this.onChange(value);
  }

  onBlur(): void {
    this.onTouched();
  }
}
