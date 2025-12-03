/* eslint-env node */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat", // New feature
        "fix", // Bug fix
        "docs", // Documentation changes
        "style", // Code style changes (formatting)
        "refactor", // Code refactoring
        "perf", // Performance improvements
        "test", // Tests
        "build", // Build system
        "ci", // CI/CD changes
        "chore", // Maintenance
        "revert", // Revert previous commit
      ],
    ],
    "type-case": [2, "always", "lower-case"],
    "type-empty": [2, "never"],
    "subject-empty": [2, "never"],
    "subject-full-stop": [2, "never", "."],
    "header-max-length": [2, "always", 100],
  },
};
