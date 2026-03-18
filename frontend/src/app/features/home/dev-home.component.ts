import { Component } from '@angular/core';
import { HomeHeroComponent } from './sections/home-hero.component';
import { HomeRecentItemsComponent } from './sections/home-recent-items.component';
import { HomeCtaBannerComponent } from './sections/home-cta-banner.component';
import { HomeHowItWorksComponent } from './sections/home-how-it-works.component';
import { HomeFaqComponent } from './sections/home-faq.component';

@Component({
  selector: 'app-dev-home',
  standalone: true,
  imports: [
    HomeHeroComponent,
    HomeRecentItemsComponent,
    HomeCtaBannerComponent,
    HomeHowItWorksComponent,
    HomeFaqComponent,
  ],
  template: `
    <app-home-hero />
    <app-home-recent-items />
    <app-home-cta-banner />
    <app-home-how-it-works />
    <app-home-faq />
  `,
})
export class DevHomeComponent {}
