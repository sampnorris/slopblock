import adapter from "@sveltejs/adapter-vercel";
import { mdsvex } from "mdsvex";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  extensions: [".svelte", ".md"],
  preprocess: [
    mdsvex({
      extensions: [".md"],
    }),
  ],
  kit: {
    adapter: adapter(),
    alias: {
      "$lib/*": "src/lib/*",
    },
  },
};

export default config;
