import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClaimCancel } from './claim-cancel';

describe('ClaimCancel', () => {
  let component: ClaimCancel;
  let fixture: ComponentFixture<ClaimCancel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimCancel]
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimCancel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});