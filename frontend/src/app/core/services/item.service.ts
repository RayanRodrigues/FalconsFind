import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { ItemDetailsResponse } from '../../models/dtos/item-details.response.dto';
import { ApiClientService } from '../http/api-client.service';
import { ObservableCache } from '../utils/observable-cache';

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  private readonly detailsCache = new ObservableCache(30_000);

  constructor(private apiClient: ApiClientService) {}

  getItemDetails(itemId: string): Observable<ItemDetailsResponse> {
    const normalizedItemId = itemId.trim();
    return this.detailsCache.getOrCreate(normalizedItemId, () => (
      this.apiClient.get<ItemDetailsResponse>(`/items/${normalizedItemId}`)
    ));
  }
}
