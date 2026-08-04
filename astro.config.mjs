// @ts-check
import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  // On Netlify, URL is the site's real primary origin (set during builds),
  // so canonical/OG URLs are always correct there. The fallback only
  // affects local builds.
  site: process.env.URL ?? "https://theyolksters.netlify.app",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    // Inside Docker, file-change events don't cross the Windows→container
    // bind mount — the compose file sets USE_POLLING so HMR still works.
    server: process.env.USE_POLLING
      ? { watch: { usePolling: true, interval: 300 } }
      : undefined,
  },
});
