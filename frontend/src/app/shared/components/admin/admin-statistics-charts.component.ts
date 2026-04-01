import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import type { ActivityPoint, PieSlice, StatusBar } from '../../../features/admin/statistics/admin-statistics.types';

@Component({
  selector: 'app-admin-statistics-charts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
      <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Status Distribution</p>
            <h2 class="mb-0 text-lg font-bold text-[var(--color-text-primary)]">Operational status mix</h2>
          </div>
          <p class="mb-0 text-sm text-[var(--color-text-secondary)]">A fast read on how the filtered report set is split across lifecycle stages.</p>
        </div>

        <div class="grid gap-5 lg:grid-cols-[0.95fr,1.05fr] lg:items-center">
          <div class="flex flex-col items-center justify-center rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/35 px-5 py-6">
            @if (statusPieSlices.length > 0) {
              <div class="relative flex h-56 w-56 items-center justify-center">
                <svg viewBox="0 0 120 120" class="h-56 w-56 -rotate-90">
                  <circle
                    cx="60"
                    cy="60"
                    r="42"
                    fill="none"
                    stroke="var(--color-surface)"
                    stroke-width="14"
                  />
                  @for (slice of statusPieSlices; track slice.label) {
                    <circle
                      cx="60"
                      cy="60"
                      r="42"
                      fill="none"
                      [attr.stroke]="slice.color"
                      stroke-width="14"
                      stroke-linecap="round"
                      [attr.stroke-dasharray]="slice.dashArray"
                      [attr.stroke-dashoffset]="slice.dashOffset"
                    />
                  }
                </svg>

                <div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p class="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Reports</p>
                  <p class="mb-1 text-3xl font-bold text-[var(--color-text-primary)]">{{ totalReported }}</p>
                  <p class="mb-0 text-xs text-[var(--color-text-secondary)]">in current view</p>
                </div>
              </div>
            } @else {
              <div class="flex h-56 w-full items-center justify-center rounded-2xl border border-dashed border-[var(--color-border)] text-sm text-[var(--color-text-secondary)]">
                No status data in the current view
              </div>
            }
          </div>

          <div class="space-y-3">
            @for (bar of statusBars; track bar.label) {
              <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/45 px-4 py-4">
                <div class="mb-2 flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="mb-1 flex items-center gap-2">
                      <span class="h-2.5 w-2.5 rounded-full" [style.background]="resolveChartColor(bar.label)"></span>
                      <p class="mb-0 text-sm font-semibold text-[var(--color-text-primary)]">{{ bar.label }}</p>
                    </div>
                    <p class="mb-0 text-xs text-[var(--color-text-secondary)]">{{ bar.description }}</p>
                  </div>
                  <div class="text-right">
                    <p class="mb-0 text-sm font-bold" [class]="bar.toneClass">{{ bar.value }}</p>
                    <p class="mb-0 text-xs text-[var(--color-text-secondary)]">{{ bar.percent }}%</p>
                  </div>
                </div>

                <div class="h-2.5 overflow-hidden rounded-full bg-[var(--color-surface)]">
                  <div
                    class="h-full rounded-full transition-all duration-300"
                    [class]="bar.barClass"
                    [style.width.%]="bar.percent"
                  ></div>
                </div>
              </div>
            }
          </div>
        </div>
      </div>

      <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm">
        <div class="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p class="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Reporting Activity</p>
            <h2 class="mb-0 text-lg font-bold text-[var(--color-text-primary)]">Daily volume over time</h2>
          </div>
          <p class="mb-0 text-sm text-[var(--color-text-secondary)]">Tracks how many found-item reports were submitted across the latest seven days in view.</p>
        </div>

        <div class="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-2)]/35 p-4">
          <div class="mb-4 flex items-center justify-between gap-3">
            <div>
              <p class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">Peak Day</p>
              <p class="mb-0 text-lg font-bold text-[var(--color-text-primary)]">{{ activityMaxValue }} reports</p>
            </div>
            <div class="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
              Last 7 days
            </div>
          </div>

          <div class="relative overflow-x-auto">
            <div class="min-w-[320px]">
              <svg viewBox="0 0 320 160" class="h-56 w-full">
                @for (tick of activityYAxis; track $index; let index = $index) {
                  <line
                    x1="16"
                    [attr.y1]="24 + index * 48"
                    x2="304"
                    [attr.y2]="24 + index * 48"
                    stroke="var(--color-border)"
                    stroke-width="1"
                    stroke-dasharray="4 4"
                  />
                  <text
                    x="4"
                    [attr.y]="28 + index * 48"
                    fill="var(--color-text-secondary)"
                    font-size="10"
                  >
                    {{ tick }}
                  </text>
                }

                @if (activityAreaPath) {
                  <path [attr.d]="activityAreaPath" fill="rgba(193, 63, 99, 0.12)" />
                }

                @if (activityLinePath) {
                  <polyline
                    [attr.points]="activityLinePath"
                    fill="none"
                    stroke="var(--color-primary)"
                    stroke-width="3"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                }

                @for (point of activityPoints; track point.label) {
                  <circle [attr.cx]="point.x" [attr.cy]="point.y" r="4.5" fill="var(--color-primary)" />
                  <circle [attr.cx]="point.x" [attr.cy]="point.y" r="8" fill="rgba(193, 63, 99, 0.12)" />
                  <text
                    [attr.x]="point.x"
                    y="151"
                    text-anchor="middle"
                    fill="var(--color-text-secondary)"
                    font-size="10"
                  >
                    {{ point.shortLabel }}
                  </text>
                }
              </svg>
            </div>
          </div>

          <div class="mt-4 grid gap-3 sm:grid-cols-3">
            @for (point of activityPoints; track point.label) {
              <div class="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3">
                <p class="mb-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">{{ point.label }}</p>
                <p class="mb-0 text-base font-bold text-[var(--color-text-primary)]">{{ point.value }} reports</p>
              </div>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AdminStatisticsChartsComponent {
  @Input() totalReported = 0;
  @Input() statusBars: StatusBar[] = [];
  @Input() statusPieSlices: PieSlice[] = [];
  @Input() activityPoints: ActivityPoint[] = [];
  @Input() activityLinePath = '';
  @Input() activityAreaPath = '';
  @Input() activityMaxValue = 0;
  @Input() activityYAxis: number[] = [];

  resolveChartColor(label: string): string {
    switch (label.toLowerCase()) {
      case 'validated':
        return '#70e07d';
      case 'claimed':
        return '#4ea1ff';
      case 'returned':
        return '#d04d74';
      case 'archived':
        return '#94a3b8';
      default:
        return '#c13f63';
    }
  }
}
