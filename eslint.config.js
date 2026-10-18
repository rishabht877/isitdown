const nodeGlobals = {
  console: "readonly",
  process: "readonly",
  fetch: "readonly",
  URL: "readonly",
};

const browserGlobals = {
  window: "readonly",
  document: "readonly",
  fetch: "readonly",
  URLSearchParams: "readonly",
  setTimeout: "readonly",
  clearTimeout: "readonly",
};

const rules = {
  "no-undef": "error",
  "no-unused-vars": "error",
  "no-var": "error",
  "prefer-const": "error",
  eqeqeq: "error",
  "no-console": "off",
};

export default [
  {
    ignores: ["node_modules/"],
  },
  {
    files: ["**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module" },
  },
  {
    files: [
      "server.js",
      "db/**/*.js",
      "lib/**/*.js",
      "routes/**/*.js",
      "scripts/**/*.js",
    ],
    languageOptions: { globals: nodeGlobals },
    rules,
  },
  {
    files: ["public/**/*.js"],
    languageOptions: { globals: browserGlobals },
    rules,
  },
];
