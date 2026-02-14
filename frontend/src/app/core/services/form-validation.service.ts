import { Injectable } from '@angular/core';
import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

@Injectable({
  providedIn: 'root'
})
export class FormValidationService {
  
  pastDateValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      if (!control.value) {
        return null;
      }
      
      const inputDate = new Date(control.value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (inputDate > today) {
        return { futureDate: 'Date cannot be in the future' };
      }
      
      return null;
    };
  }

  getErrorMessage(fieldName: string, errors: ValidationErrors): string {
    const errorMessages: Record<string, string> = {
      required: `${this.formatFieldName(fieldName)} is required`,
      email: 'Please enter a valid email address',
      minlength: `${this.formatFieldName(fieldName)} is too short`,
      maxlength: `${this.formatFieldName(fieldName)} is too long`,
      pattern: `Please enter a valid ${this.formatFieldName(fieldName).toLowerCase()}`,
      futureDate: 'Date cannot be in the future'
    };

    const firstError = Object.keys(errors)[0];
    return errorMessages[firstError] || `Invalid ${this.formatFieldName(fieldName).toLowerCase()}`;
  }

  private formatFieldName(fieldName: string): string {
    const fieldMap: Record<string, string> = {
      title: 'Title',
      category: 'Category',
      description: 'Description',
      location: 'Location',
      date: 'Date',
      time: 'Time',
      contactName: 'Name',
      contactEmail: 'Email',
      contactPhone: 'Phone number',
      foundLocation: 'Location',
      foundDate: 'Date',
      foundTime: 'Time',
      photo: 'Photo'
    };
    
    return fieldMap[fieldName] || fieldName;
  }
}
