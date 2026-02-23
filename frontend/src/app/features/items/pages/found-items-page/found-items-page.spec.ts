import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FoundItemsPage } from './found-items-page';

describe('FoundItemsPage', () => {
  let component: FoundItemsPage;
  let fixture: ComponentFixture<FoundItemsPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FoundItemsPage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FoundItemsPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
