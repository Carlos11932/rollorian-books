import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "mcp/**/dist/**",
    "next-env.d.ts",
  ]),
  // Strict rules enforcing project conventions
  {
    rules: {
      // TypeScript: enforce `import type` for type-only imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      // TypeScript: no unused vars (allow _-prefixed intentional ones)
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // TypeScript: no explicit `any`
      "@typescript-eslint/no-explicit-any": "error",
      // Imports: no duplicate imports
      "no-duplicate-imports": "error",
      // General: no console.log (allow warn/error)
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // General: always use const when variable is not reassigned
      "prefer-const": "error",
    },
  },
]);

export default eslintConfig;
