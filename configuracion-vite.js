import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { readFile } from "node:fs/promises";

// El catálogo original se sirve solo en desarrollo; nunca entra al bundle público.
function localEmployeeCatalog() {
  return {
    name: "local-employee-catalog",
    configureServer(server) {
      server.middlewares.use(
        "/__local/empleados",
        async (_request, response) => {
          response.setHeader("Content-Type", "application/json; charset=utf-8");
          response.setHeader("Cache-Control", "no-store");
          try {
            response.end(
              await readFile(
                new URL("./datos-locales/empleados.json", import.meta.url),
                "utf8",
              ),
            );
          } catch {
            response.statusCode = 404;
            response.end("[]");
          }
        },
      );
    },
  };
}
export default defineConfig({
  publicDir: "publico",
  optimizeDeps: { entries: ["index.html"] },
  build: {
    outDir: "compilado",
    assetsDir: "recursos",
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: "pdfjs",
              test: /node_modules[\\/]pdfjs-dist[\\/]/,
              priority: 30,
              includeDependenciesRecursively: false,
            },
            {
              name: "exceljs",
              test: /node_modules[\\/]exceljs[\\/]/,
              priority: 30,
              includeDependenciesRecursively: false,
            },
            {
              name: "jspdf",
              test: /node_modules[\\/]jspdf(?:-autotable)?[\\/]/,
              priority: 30,
              includeDependenciesRecursively: false,
            },
            {
              name: "qrcode",
              test: /node_modules[\\/]qrcode[\\/]/,
              priority: 30,
              includeDependenciesRecursively: false,
            },
            {
              name: "firebase",
              test: /node_modules[\\/](?:@firebase|firebase)[\\/]/,
              priority: 20,
              includeDependenciesRecursively: false,
            },
            {
              name: "react",
              test: /node_modules[\\/](?:react|react-dom|scheduler)[\\/]/,
              priority: 20,
              includeDependenciesRecursively: false,
            },
          ],
        },
      },
    },
  },
  plugins: [react(), localEmployeeCatalog()],
  server: { port: 5173, strictPort: true },
});
