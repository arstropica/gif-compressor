import tseslint from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import prettierConfig from "eslint-config-prettier";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";

export default [
  /* ------------------------------------------------------
   * Global ignores
   * ------------------------------------------------------ */
  {
    ignores: ["dist/**", "node_modules/**", ".history/**", ".vscode/**"],
  },

  /* ------------------------------------------------------
   * Base config (client + server)
   * ------------------------------------------------------ */
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        JSX: true,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },

    plugins: {
      "@typescript-eslint": tseslint,
      react,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      import: importPlugin,
      prettier,
      "unused-imports": unusedImports,
    },

    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
        typescript: {
          alwaysTryTypes: true,
        },
      },
    },

    rules: {
      /* -------------------------
       * General
       * ------------------------- */
      "no-console": "off",
      eqeqeq: "off",

      /* -------------------------
       * React
       * ------------------------- */
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",

      /* -------------------------
       * Hooks
       * ------------------------- */
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      /* -------------------------
       * Vite Fast Refresh
       * ------------------------- */
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],

      /* -------------------------
       * TypeScript
       * ------------------------- */
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/consistent-type-imports": "warn",

      /* -------------------------
       * Imports
       * ------------------------- */
      "import/order": [
        "warn",
        {
          groups: [
            ["builtin", "external"],
            ["internal"],
            ["parent", "sibling", "index"],
          ],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
          "newlines-between": "always",
          pathGroups: [
            {
              pattern: "@/**",
              group: "internal",
              position: "before",
            },
          ],
          pathGroupsExcludedImportTypes: ["builtin"],
        },
      ],

      /* -------------------------
       * Unused imports
       * ------------------------- */
      "unused-imports/no-unused-imports": "error",

      /* -------------------------
       * Prettier
       * ------------------------- */
      "comma-dangle": "off",
      "@typescript-eslint/comma-dangle": "off",
      "prettier/prettier": "error",
    },
  },

  /* ------------------------------------------------------
   * Disable stylistic rules conflicting with Prettier
   * ------------------------------------------------------ */
  prettierConfig,
];
