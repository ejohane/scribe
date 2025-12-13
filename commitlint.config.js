module.exports = {
  extends: ['@commitlint/config-conventional'],

  rules: {
    // Type enum
    'type-enum': [
      2,
      'always',
      [
        'feat', // New feature
        'fix', // Bug fix
        'docs', // Documentation
        'style', // Formatting
        'refactor', // Code restructuring
        'perf', // Performance
        'test', // Tests
        'chore', // Maintenance
        'ci', // CI/CD
        'revert', // Revert commit
      ],
    ],

    // Scope enum
    'scope-enum': [
      2,
      'always',
      [
        'beads',
        'editor',
        'engine',
        'storage',
        'graph',
        'search',
        'palette',
        'ui',
        'vault',
        'build',
        'deps',
        'ci',
        'release',
        'design-system',
      ],
    ],

    // Subject rules
    'subject-case': [2, 'never', ['upper-case']],
    'subject-empty': [2, 'never'],
    'subject-full-stop': [2, 'never', '.'],

    // Body rules
    'body-leading-blank': [2, 'always'],
    'body-max-line-length': [2, 'always', 100],

    // Footer rules
    'footer-leading-blank': [2, 'always'],
  },
};
