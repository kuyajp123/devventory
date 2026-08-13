export async function runReleaseCycle({ candidateSha, dependencies }) {
  let leaseAcquired = false;
  let recoveredVersion = null;

  try {
    await dependencies.acquireLease(candidateSha);
    leaseAcquired = true;

    let state = await dependencies.inspect();
    if (state.kind === 'recover') {
      const approved = await dependencies.approveRecovery(state);
      if (!approved) {
        return {
          status: 'cancelled',
          recoveredVersion: null,
          publishedVersion: null,
        };
      }

      recoveredVersion = state.transaction.version;
      await dependencies.recover(state);
      state = await dependencies.inspect();
      if (state.kind !== 'clear') {
        throw new Error(
          `Recovery for v${recoveredVersion} did not reach a completed state. ` +
            'Semantic-release planning was not started.',
        );
      }
    }

    const plan = await dependencies.plan(candidateSha);
    if (!plan) {
      return {
        status: recoveredVersion ? 'recovered' : 'no-release',
        recoveredVersion,
        publishedVersion: null,
      };
    }

    const preparedRelease = await dependencies.prepare(plan);
    const approved = await dependencies.approvePublication({
      plan,
      preparedRelease,
    });
    if (!approved) {
      return {
        status: 'cancelled',
        recoveredVersion,
        publishedVersion: null,
      };
    }

    await dependencies.publish({ plan, preparedRelease });
    return {
      status: 'published',
      recoveredVersion,
      publishedVersion: plan.version,
    };
  } finally {
    if (leaseAcquired) await dependencies.releaseLease();
  }
}
