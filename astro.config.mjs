// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  // TODO: confirm final domain with the client before launch.
  site: 'https://www.taxfortaxidrivers.co.uk',
  trailingSlash: 'never',
  integrations: [sitemap(), react()],
  prefetch: {
    defaultStrategy: 'viewport',
  },
});