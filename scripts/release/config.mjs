export const releaseSettings = Object.freeze({
  sourceRepository: 'kuyajp123/devventory',
  releaseRepository: 'kuyajp123/devventory-releases',
  platform: 'windows-x86_64',
  leaseRef: 'refs/heads/automation/release-lock',
  leaseRefPath: 'heads/automation/release-lock',
  legacyPublishedVersions: new Set(['0.1.1', '0.1.2']),
  legacyBaseline: Object.freeze({
    version: '0.1.2',
    tag: 'v0.1.2',
    sourceSha: '06d134512f16daea759733c083d8264ebdc0bb5b',
    assetNames: Object.freeze([
      'Devventory_0.1.2_x64-setup.exe',
      'Devventory_0.1.2_x64-setup.exe.sig',
      'latest.json',
    ]),
  }),
});

export function installerName(version) {
  return `Devventory_${version}_x64-setup.exe`;
}

export function installerUrl(version) {
  return (
    `https://github.com/${releaseSettings.releaseRepository}/releases/download/` +
    `v${version}/${installerName(version)}`
  );
}
