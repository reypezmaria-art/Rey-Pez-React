import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
export default [
  {
    ignores: [
      "compilado/**",
      "dist/**",
      "test-results/**",
      "playwright-report/**",
      "node_modules/**",
      "datos-locales/**",
      "resultados-pruebas/**",
      "informe-pruebas/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      "no-unused-vars": [
        "error",
        { varsIgnorePattern: "^[A-Z_]", argsIgnorePattern: "^[A-Z_]" },
      ],
    },
  },
  {
    files: ["*.js", "pruebas/**/*.js", "herramientas/**/*.js"],
    languageOptions: { globals: globals.node },
  },
  {
    files: ["firebase/**/*.js"],
    languageOptions: { globals: globals.node, sourceType: "commonjs" },
  },
  {
    files: ["pruebas/navegador/**/*.js"],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["codigo/**/*.{js,jsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks, "react-refresh": reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
];
