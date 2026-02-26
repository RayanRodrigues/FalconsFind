import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FoundItemsPageComponent } from './found-items-page';

describe('FoundItemsPageComponent', () => {
  let component: FoundItemsPageComponent;
  let fixture: ComponentFixture<FoundItemsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FoundItemsPageComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FoundItemsPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
