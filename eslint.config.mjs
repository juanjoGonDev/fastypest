import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const common = {
  files: ["src/**/*.ts"],
  ignores: ["**/dist/*", "**/node_modules/*"],
  rules: {
    "no-case-declarations": "off",
    "@typescript-eslint/explicit-function-return-type": "error",
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
