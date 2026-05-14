// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://aria-rooth.github.io',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});
