module.exports = {
  root: true,
  ignorePatterns: [
    "node_modules/",
    ".home/",
    "data/",
    "data_tmp/",
    "public/vendor/",
    "*.log",
  ],
  overrides: [
    {
      files: ["server.js", "storage.js", "scripts/**/*.js"],
      env: {
        node: true,
        es2022: true,
      },
      extends: ["eslint:recommended"],
      globals: {
        fetch: "readonly",
      },
      rules: {
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      },
    },
    {
      files: ["public/**/*.js"],
      env: {
        browser: true,
        es2022: true,
      },
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      },
      extends: ["eslint:recommended"],
      globals: {
        ggwave_factory: "readonly",
      },
      rules: {
        "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      },
    },
  ],
};
