import { Component, signal } from '@angular/core';

type FaqItem = { q: string; a: string };

@Component({
  selector: 'app-home-faq',
  standalone: true,
  styleUrl: './home-faq.component.css',
  template: `
    <section class="bg-white border-t border-border/60">
      <div class="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <p class="section-eyebrow text-center">Got questions?</p>
        <h2 class="section-title text-center" style="margin-bottom: 2.5rem;">Frequently Asked Questions</h2>

        <div>
          @for (item of faqs; track item.q; let i = $index) {
            @if (i > 0) { <hr class="faq-hr" /> }
            <div class="faq-item" [class.faq-item--open]="openIndex() === i">
              <button type="button" class="faq-trigger" (click)="toggle(i)" [attr.aria-expanded]="openIndex() === i">
                <span>{{ item.q }}</span>
                <svg class="faq-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              @if (openIndex() === i) {
                <div class="faq-answer"><p>{{ item.a }}</p></div>
              }
            </div>
          }
        </div>

      </div>
    </section>
  `,
})
export class HomeFaqComponent {
  readonly openIndex = signal<number | null>(null);

  readonly faqs: FaqItem[] = [
    { q: 'How do I claim an item?', a: 'Browse the found items list and open the item detail page. Click "Claim this item" and fill in the claim form. Campus Security will review your claim and contact you to arrange pick-up.' },
    { q: 'How long are items kept before being discarded?', a: 'Items are held by Campus Security for a reasonable period after being validated. If unclaimed, they may be donated or discarded. Check with Campus Security directly for the current retention policy.' },
    { q: 'Who reviews and validates found item reports?', a: 'All submitted found item reports are reviewed by Campus Security staff before being published. This ensures the information is accurate and the item is safely stored.' },
    { q: 'Can I edit my report after submitting it?', a: 'Yes — as long as your report has not yet been validated, you can update the details using the reference code provided at submission.' },
    { q: 'What should I do if I find a valuable item like a wallet or ID?', a: 'Hand it directly to Campus Security or the nearest campus service desk and submit a found item report here so the owner can find it online.' },
  ];

  toggle(index: number): void {
    this.openIndex.update(current => current === index ? null : index);
  }
}
