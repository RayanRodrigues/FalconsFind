import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ItemsApiService } from '../../../../core/services/items-api.service';
import { FoundItemsPageComponent } from './found-items-page';

describe('FoundItemsPageComponent', () => {
  let component: FoundItemsPageComponent;
  let fixture: ComponentFixture<FoundItemsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FoundItemsPageComponent],
      providers: [
        {
          provide: ItemsApiService,
          useValue: {
            getFoundItems: () => of({
              page: 1,
              limit: 10,
              total: 0,
              totalPages: 1,
              hasNextPage: false,
              hasPrevPage: false,
              items: [],
            }),
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
});
