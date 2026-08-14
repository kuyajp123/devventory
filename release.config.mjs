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
      { preset: 'conventionalcommits', presetConfig: {} },
    ],
  ],
};
