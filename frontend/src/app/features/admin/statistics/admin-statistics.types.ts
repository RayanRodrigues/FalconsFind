import type { ItemPublicResponse } from '../../../models';

export type DashboardItem = ItemPublicResponse & {
  category?: string;
};

export type StatusBar = {
  label: string;
  value: number;
  percent: number;
  description: string;
  toneClass: string;
  barClass: string;
};

export type PieSlice = {
  label: string;
  value: number;
  percent: number;
  color: string;
  toneClass: string;
  dashArray: string;
  dashOffset: number;
};

export type ActivityPoint = {
  label: string;
  shortLabel: string;
  value: number;
  x: number;
  y: number;
};
