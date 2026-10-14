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
  build: { outDir: "compilado", assetsDir: "recursos" },
  plugins: [react(), localEmployeeCatalog()],
  server: { port: 5173, strictPort: true },
});
