import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ClaimRequest } from './claim-request';

describe('ClaimRequest', () => {
  let component: ClaimRequest;
  let fixture: ComponentFixture<ClaimRequest>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ClaimRequest]
    }).compileComponents();

    fixture = TestBed.createComponent(ClaimRequest);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});