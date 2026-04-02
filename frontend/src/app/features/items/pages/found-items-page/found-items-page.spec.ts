import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ItemsApiService } from '../../../../core/services/items-api.service';
import { FoundItemsPageComponent } from './found-items-page';
import { MANUAL_REPORT_CATEGORY_OPTION } from '../../../../shared/utils/report-category.util';
import { MANUAL_REPORT_LOCATION_OPTION } from '../../../../shared/utils/report-location.util';

describe('FoundItemsPageComponent', () => {
  let component: FoundItemsPageComponent;
  let fixture: ComponentFixture<FoundItemsPageComponent>;
  const getFoundItems = vi.fn(() => of({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
    hasNextPage: false,
    hasPrevPage: false,
    items: [],
  }));

  beforeEach(async () => {
    getFoundItems.mockClear();
    await TestBed.configureTestingModule({
      imports: [FoundItemsPageComponent],
      providers: [
        {
          provide: ItemsApiService,
          useValue: {
            getFoundItems,
          },
        },
      ],
    })
    .compileComponents();

    fixture = TestBed.createComponent(FoundItemsPageComponent);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('does not expose empty states while loading', () => {
    component.loading = true;
    component.error = false;
    component.hasLoadedOnce = false;
    component.items = [];

    expect(component.showLoadingState).toBe(true);
    expect(component.showInitialEmptyState).toBe(false);
    expect(component.showFilteredEmptyState).toBe(false);
  });

  it('resolves manual category and location filters before loading items', () => {
    component.categoryFilter = MANUAL_REPORT_CATEGORY_OPTION;
    component.categoryCustomFilter = 'Lab Equipment';
    component.locationFilter = MANUAL_REPORT_LOCATION_OPTION;
    component.locationCustomFilter = 'Building B, Room 204';

    component.loadItems();

    expect(getFoundItems).toHaveBeenLastCalledWith(1, 10, expect.objectContaining({
      category: 'Lab Equipment',
      location: 'Building B, Room 204',
    }));
  });
});
