import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";

// Next 16 removed the `next lint` wrapper, so ESLint's own CLI loads this
// directly. eslint-config-next ships native flat configs, so they compose here
// without the eslintrc compatibility shim.
const config = [
  {
    // .claude/ holds Claude Code's own working copies of this repo (worktrees): each is linted where it lives, not from here.
    ignores: [".next/**", "node_modules/**", "out/**", "public/**", "next-env.d.ts", ".claude/**"],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // Tests run on the Node test runner, not in a browser.
    files: ["tests/**/*.ts"],
    rules: { "@typescript-eslint/no-unused-vars": ["warn", { varsIgnorePattern: "^_" }] },
  },
];

export default config;
