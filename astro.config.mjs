// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import vercel from '@astrojs/vercel';

// https://astro.build/config
export default defineConfig({
  site: 'https://www.taxfortaxidrivers.co.uk',
  trailingSlash: 'never',
  output: 'server',
  adapter: vercel(),
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/portal'),
    }),
    react(),
  ],
  prefetch: {
    defaultStrategy: 'viewport',
  },
});
