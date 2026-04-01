import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { Observable } from 'rxjs';
import type { ItemPublicResponse } from '../../models';
import { ObservableCache } from '../utils/observable-cache';

export type ItemsFilters = {
  keyword?: string;
  category?: string;
  location?: string;
  dateFrom?: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
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
  private readonly listCache = new ObservableCache(30_000);

  constructor(private readonly http: HttpClient) {}

  getFoundItems(page = 1, limit = 10, filters: ItemsFilters = {}): Observable<ItemsListResponse> {
    const normalizedFilters = {
      keyword: filters.keyword?.trim() ?? '',
      category: filters.category?.trim() ?? '',
      location: filters.location?.trim() ?? '',
      dateFrom: filters.dateFrom?.trim() ?? '',
      includeArchived: filters.includeArchived,
      archivedOnly: filters.archivedOnly,
    };

    const cacheKey = JSON.stringify({
      page,
      limit,
      ...normalizedFilters,
    });

    return this.listCache.getOrCreate(cacheKey, () => {
    let params = new HttpParams()
      .set('page', String(page))
      .set('limit', String(limit));

    if (normalizedFilters.keyword) {
      params = params.set('keyword', normalizedFilters.keyword);
    }

    if (normalizedFilters.category) {
      params = params.set('category', normalizedFilters.category);
    }

    if (normalizedFilters.location) {
      params = params.set('location', normalizedFilters.location);
    }

    if (normalizedFilters.dateFrom) {
      params = params.set('dateFrom', normalizedFilters.dateFrom);
    }

    if (normalizedFilters.includeArchived !== undefined) {
      params = params.set('includeArchived', String(normalizedFilters.includeArchived));
    }

    if (normalizedFilters.archivedOnly !== undefined) {
      params = params.set('archivedOnly', String(normalizedFilters.archivedOnly));
    }

    return this.http.get<ItemsListResponse>('/items', { params });
    });
  }
}
