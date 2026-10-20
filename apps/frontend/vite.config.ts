import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  // Rutas relativas: el build funciona servido desde cualquier carpeta o bucket.
  base: "./",
  server: { port: 5173 },
  test: {
    globals: true,
    include: ["src/**/*.spec.ts"],
  },
});
