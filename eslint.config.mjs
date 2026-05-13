import nxPlugin from "@nx/eslint-plugin";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import jsdocPlugin from "eslint-plugin-jsdoc";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const moduleBoundaryConstraints = [
  {
    sourceTag: "scope:spc",
    onlyDependOnLibsWithTags: ["scope:spc", "scope:shared"],
  },
  {
    sourceTag: "scope:warehouse360",
    onlyDependOnLibsWithTags: ["scope:warehouse360", "scope:shared"],
  },
  {
    sourceTag: "scope:processorderhistory",
    onlyDependOnLibsWithTags: ["scope:processorderhistory", "scope:shared"],
  },
  {
    sourceTag: "scope:trace2",
    onlyDependOnLibsWithTags: ["scope:trace2", "scope:shared"],
  },
  {
    sourceTag: "scope:envmon",
    onlyDependOnLibsWithTags: ["scope:envmon", "scope:shared"],
  },
  {
    sourceTag: "scope:template",
    onlyDependOnLibsWithTags: ["scope:template", "scope:shared"],
  },
  {
    sourceTag: "scope:connectedquality",
    onlyDependOnLibsWithTags: ["scope:connectedquality", "scope:shared", "scope:spc", "scope:trace2", "scope:envmon"],
  },
  {
    sourceTag: "scope:platform",
    onlyDependOnLibsWithTags: [
      "scope:platform",
      "scope:shared",
      "scope:connectedquality",
      "scope:processorderhistory",
      "scope:warehouse360",
    ],
  },
  {
    sourceTag: "scope:shared",
    onlyDependOnLibsWithTags: ["scope:shared"],
  },
  {
    sourceTag: "type:frontend",
    notDependOnLibsWithTags: ["type:backend"],
  },
  {
    sourceTag: "type:frontend",
    onlyDependOnLibsWithTags: ["type:frontend", "type:lib", "type:ui"],
  },
  {
    sourceTag: "type:ui",
    onlyDependOnLibsWithTags: ["type:ui", "type:lib"],
  },
  {
    sourceTag: "type:lib",
    notDependOnLibsWithTags: ["type:backend"],
  },
];

export default [
  {
    ignores: ["**/coverage/**", "**/dist/**", "**/node_modules/**"],
  },
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
      },
    },
    plugins: {
      "@nx": nxPlugin,
      "@typescript-eslint": tsPlugin,
      jsdoc: jsdocPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "@nx/enforce-module-boundaries": [
        "error",
        {
          enforceBuildableLibDependency: false,
          allow: [],
          depConstraints: moduleBoundaryConstraints,
        },
      ],
    },
  },
];
