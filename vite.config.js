import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// `base` fija en '/': en el calendario de marketing, condicionarla a CI dejó
// la página en blanco en producción (el build publicado pedía recursos en
// otra ruta). Aquí no se repite.
export default defineConfig({
  plugins: [react()],
  base: "/",
  build: { target: "es2020" },
});
