import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["**/*.{js,mjs,cjs,ts}"],
  languageOptions: { globals: globals.node },
  extends: [
    pluginJs.configs.recommended,
    ...tseslint.configs.recommended,
    eslintConfigPrettier,
  ],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars":"warn",
    "@typescript-eslint/no-empty-object-type":"warn"
  },
});
