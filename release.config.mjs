export default {
  branches: ['main'],
  tagFormat: 'v${version}',
  // semantic-release is the planner only. scripts/release owns tags and
  // cross-repository publication so unfinished transactions can recover first.
  plugins: [
    [
      '@semantic-release/commit-analyzer',
      {
        preset: 'conventionalcommits',
        presetConfig: {},
        releaseRules: [
          { breaking: true, release: 'major' },
          { type: 'fix', release: 'patch' },
          { type: 'feat', release: 'minor' },
          { type: 'build', release: false },
          { type: 'chore', release: false },
          { type: 'ci', release: false },
          { type: 'docs', release: false },
          { type: 'perf', release: false },
          { type: 'refactor', release: false },
          { type: 'revert', release: false },
          { type: 'style', release: false },
          { type: 'test', release: false },
        ],
      },
    ],
    [
      '@semantic-release/release-notes-generator',
      {
        preset: 'conventionalcommits',
        presetConfig: {
          types: [
            { type: 'feat', section: 'Features & Improvements' },
            { type: 'fix', section: 'Bug Fixes' },
            { type: 'perf', section: 'Performance Improvements' },
            { type: 'revert', section: 'Reverts' },
            { type: 'docs', section: 'Documentation', hidden: true },
            { type: 'chore', section: 'Chores', hidden: true },
            { type: 'ci', section: 'Continuous Integration', hidden: true },
            { type: 'test', section: 'Tests', hidden: true },
            { type: 'refactor', section: 'Refactoring', hidden: true },
            { type: 'style', section: 'Styles', hidden: true },
            { type: 'build', section: 'Build System', hidden: true },
          ],
        },
      },
    ],
  ],
};
