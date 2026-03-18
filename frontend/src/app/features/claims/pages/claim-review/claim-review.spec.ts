import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClaimReview } from './claim-review';

describe('ClaimReview', () => {
  let component: ClaimReview;
  let fixture: ComponentFixture<ClaimReview>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimReview]
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimReview);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});