import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // GitHub Pages: repo 이름에 맞춰 수정 (e.g., '/paper-tracker/')
  // username.github.io 루트에 배포하면 '/' 로 두면 됨
  base: "/paper-tracker/",
});
