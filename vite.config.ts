import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { resolve } from "node:path";

export default defineConfig({
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        //cats: resolve(import.meta.dirname, 'cats.html'),
      },
    },
  },
});
