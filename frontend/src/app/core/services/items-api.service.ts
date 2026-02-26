import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ItemPublicResponse } from '../../models';

export type ItemsListResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  items: ItemPublicResponse[];
};

@Injectable({ providedIn: 'root' })
export class ItemsApiService {
  constructor(private readonly http: HttpClient) {}

  getFoundItems(page = 1, limit = 10): Observable<ItemsListResponse> {
    return this.http.get<ItemsListResponse>(`/items?page=${page}&limit=${limit}`);
  }
}
