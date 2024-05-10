import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const common = {
  files: ["src/**/*.ts"],
  ignores: ["**/dist/*", "**/node_modules/*"],
  rules: {
    "no-case-declarations": "off",
  },
};

const tsRecommended = tseslint.configs.recommended.map((config) => ({
  ...config,
  ...common,
}));

export default [
  {
    languageOptions: { globals: globals.node },
    ...common,
  },
  {
    ...pluginJs.configs.recommended,
    ...common,
  },
  ...tsRecommended,
];
