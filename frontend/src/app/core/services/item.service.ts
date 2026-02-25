import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import type { ItemDetailsResponse } from '../../models/dtos/item-details.response.dto';
import { ApiClientService } from '../http/api-client.service';

@Injectable({
  providedIn: 'root'
})
export class ItemService {
  constructor(private apiClient: ApiClientService) {}

  getItemDetails(itemId: string): Observable<ItemDetailsResponse> {
    return this.apiClient.get<ItemDetailsResponse>(`/items/${itemId}`);
  }
}
