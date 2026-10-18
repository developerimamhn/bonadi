import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
// Split heavy libraries into their own cached chunks so the first paint stays small
export default defineConfig({
  plugins: [react()],
  build: { target: "es2020", rollupOptions: { output: { manualChunks: {
    supabase: ["@supabase/supabase-js"], react: ["react", "react-dom"] } } } },
});
