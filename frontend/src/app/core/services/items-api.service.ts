import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ItemPublicResponse } from '../../models';

export type ItemsFilters = {
  keyword?: string;
  category?: string;
  location?: string;
  dateFrom?: string;
};

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

  getFoundItems(page = 1, limit = 10, filters: ItemsFilters = {}): Observable<ItemsListResponse> {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    if (filters.keyword?.trim())  params = params.set('keyword',  filters.keyword.trim());
    if (filters.category?.trim()) params = params.set('category', filters.category.trim());
    if (filters.location?.trim()) params = params.set('location', filters.location.trim());
    if (filters.dateFrom?.trim()) params = params.set('dateFrom', filters.dateFrom.trim());

    return this.http.get<ItemsListResponse>('/items', { params });
  }
}
