import { Injectable } from '@angular/core';

export type FoundItem = {
  id: string;
  title: string;
  dateReported?: any;
  location?: string;
  photoUrl?: string;
  referenceCode?: string;
};

export type ItemsResponse = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  items: FoundItem[];
};

@Injectable({ providedIn: 'root' })
export class ItemsApiService {
  private baseUrl = 'http://localhost:3000';

  async getFoundItems(page = 1, limit = 10): Promise<ItemsResponse> {
    const url = `${this.baseUrl}/api/v1/items?page=${page}&limit=${limit}`;
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `Request failed with status ${res.status}`);
    }

    return (await res.json()) as ItemsResponse;
  }
}