import releaseConfig from '../../release.config.mjs';
import { withReleaseSecretsHidden } from './environment.mjs';

const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export async function planRelease({
  repositoryRoot,
  candidateSha,
  semanticReleaseImpl,
  loadSemanticRelease = async () => (await import('semantic-release')).default,
}) {
  const result = await withReleaseSecretsHidden(async (plannerEnvironment) => {
    const planner = semanticReleaseImpl ?? (await loadSemanticRelease());
    return planner(
      {
        ...releaseConfig,
        dryRun: true,
        ci: false,
      },
      {
        cwd: repositoryRoot,
        env: plannerEnvironment,
        stdout: process.stdout,
        stderr: process.stderr,
      },
    );
  });

  if (!result) return null;
  const next = result.nextRelease;
  if (
    !next ||
    !VERSION_PATTERN.test(next.version) ||
    next.gitTag !== `v${next.version}`
  ) {
    throw new Error('semantic-release returned an invalid version plan.');
  }
  if (next.gitHead !== candidateSha) {
    throw new Error(
      `semantic-release planned ${next.gitHead}, which does not match the pinned main SHA ${candidateSha}.`,
    );
  }

  return {
    version: next.version,
    tag: next.gitTag,
    sourceSha: next.gitHead,
    notes: typeof next.notes === 'string' ? next.notes : '',
  };
}
