import pluginJs from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

const common = {
  files: ["src/**/*.ts"],
  ignores: ["**/dist/*", "**/node_modules/*"],
  plugins: {
    "@typescript-eslint": tseslint.plugin,
  },
  rules: {
    "no-case-declarations": "off",
    "@typescript-eslint/explicit-function-return-type": "error",
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        args: "all",
        ignoreRestSiblings: false,
      },
    ],
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
