import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    // `npm run dev` alone can't run the serverless function.
    // Use `vercel dev` instead, which serves both on one port.
    port: 5173,
  },
});
