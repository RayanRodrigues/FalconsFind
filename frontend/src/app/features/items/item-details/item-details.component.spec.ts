import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ItemService } from '../../../core/services/item.service';
import type { ItemDetailsResponse } from '../../../models/dtos/item-details.response.dto';
import type { ErrorResponse } from '../../../models/responses/error-response.model';
import { ItemStatus } from '../../../models/enums/item-status.enum';
import { ItemDetailsComponent } from './item-details.component';

const createApiError = (code: string, message: string): ErrorResponse => ({
  error: { code, message },
});

const createItem = (overrides: Partial<ItemDetailsResponse> = {}): ItemDetailsResponse => ({
  id: 'item-1',
  title: 'Black backpack',
  status: ItemStatus.VALIDATED,
  referenceCode: 'FND-20260225-ABC12345',
  dateReported: '2026-02-25T10:00:00.000Z',
  imageUrls: ['https://images.local/a.jpg', '   '],
  ...overrides,
});

describe('ItemDetailsComponent', () => {
  let itemService: Pick<ItemService, 'getItemDetails'>;

  const configure = async (itemId: string | null) => {
    itemService = {
      getItemDetails: vi.fn().mockReturnValue(of(createItem())),
    };

    await TestBed.configureTestingModule({
      imports: [ItemDetailsComponent],
      providers: [
        { provide: ItemService, useValue: itemService },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap(itemId ? { id: itemId } : {}),
            },
          },
        },
        { provide: Router, useValue: { navigate: vi.fn() } },
        { provide: Location, useValue: { back: vi.fn() } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ItemDetailsComponent);
    const component = fixture.componentInstance;
    fixture.detectChanges();
    return { fixture, component };
  };

  it('loads and renders a validated item', async () => {
    const { component } = await configure('item-1');

    const getItemDetailsMock = itemService.getItemDetails as ReturnType<typeof vi.fn>;
    expect(getItemDetailsMock).toHaveBeenCalledWith('item-1');
    expect(component.isLoading).toBe(false);
    expect(component.isNotFound).toBe(false);
    expect(component.isUnderReview).toBe(false);
    expect(component.item?.referenceCode).toBe('FND-20260225-ABC12345');
    expect(component.statusLabel).toBe(ItemStatus.VALIDATED);
    expect(component.imageUrls).toEqual(['https://images.local/a.jpg']);
  });

  it('shows not found state when id param is missing', async () => {
    const { component } = await configure(null);

    const getItemDetailsMock = itemService.getItemDetails as ReturnType<typeof vi.fn>;
    expect(getItemDetailsMock).not.toHaveBeenCalled();
    expect(component.isLoading).toBe(false);
    expect(component.isNotFound).toBe(true);
    expect(component.loadError).toBe('Item not found.');
  });

  it('shows under review state when backend returns FORBIDDEN', async () => {
    const { component } = await configure('item-review');
    (itemService.getItemDetails as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      throwError(() =>
        createApiError(
          'FORBIDDEN',
          'This item is currently under review by Campus Security.',
        ),
      ),
    );

    component.retry();

    expect(component.isLoading).toBe(false);
    expect(component.isUnderReview).toBe(true);
    expect(component.loadError).toBe('This item is currently under review by Campus Security.');
  });

  it('shows backend message for INVALID_ITEM_DATA', async () => {
    const { component } = await configure('item-invalid');
    (itemService.getItemDetails as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      throwError(() =>
        createApiError(
          'INVALID_ITEM_DATA',
          'This item was incorrectly reported. If this was your report, please submit it again or contact Campus Security.',
        ),
      ),
    );

    component.retry();

    expect(component.isLoading).toBe(false);
    expect(component.isUnderReview).toBe(false);
    expect(component.isNotFound).toBe(false);
    expect(component.loadError).toContain('incorrectly reported');
  });

  it('shows invalid link message for BAD_REQUEST', async () => {
    const { component } = await configure('bad-id');
    (itemService.getItemDetails as ReturnType<typeof vi.fn>).mockReturnValueOnce(
      throwError(() => createApiError('BAD_REQUEST', 'id is required')),
    );

    component.retry();

    expect(component.isLoading).toBe(false);
    expect(component.loadError).toBe('Invalid item link. Please check the URL and try again.');
  });
});
