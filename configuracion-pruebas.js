import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./pruebas/navegador",
  testMatch: "**/*.prueba.js",
  outputDir: "resultados-pruebas",
  fullyParallel: true,
  use: {
    baseURL: "http://127.0.0.1:5174",
    locale: "es-MX",
    timezoneId: "America/Monterrey",
    trace: "retain-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? {
          executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
          args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
        }
      : {},
  },
  webServer: {
    command: "npm run iniciar -- --port 5174",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
  },
  projects: [
    { name: "escritorio", use: { viewport: { width: 1440, height: 1000 } } },
    {
      name: "movil",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
