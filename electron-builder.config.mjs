const signingEnabled = process.env.KH_SIGN_RELEASE === '1';

const requiredSigningEnv = {
  endpoint: process.env.KH_AZURE_SIGNING_ENDPOINT,
  codeSigningAccountName: process.env.KH_AZURE_SIGNING_ACCOUNT,
  certificateProfileName: process.env.KH_AZURE_CERTIFICATE_PROFILE,
  publisherName: process.env.KH_AZURE_PUBLISHER_NAME,
};

const winConfig = {
  target: [
    {
      target: 'nsis',
      arch: ['x64'],
    },
  ],
};

if (signingEnabled) {
  winConfig.azureSignOptions = requiredSigningEnv;
} else {
  winConfig.signtoolOptions = {
    sign: './scripts/noop-windows-sign.mjs',
  };
}

export default {
  appId: 'com.khelper.v3',
  productName: 'KHelperV3',
  icon: 'src/assets/images/logo_outer.png',
  directories: {
    output: 'release/${version}',
  },
  files: ['dist', 'dist-electron', 'package.json'],
  extraResources: [
    {
      from: 'resources/python-runtime',
      to: 'python-runtime',
      filter: ['**/*'],
    },
    {
      from: 'resources/bin',
      to: 'bin',
      filter: ['**/*'],
    },
    {
      from: 'src/assets/icons',
      to: 'icons',
      filter: ['**/*'],
    },
    {
      from: 'resources/separation',
      to: 'separation',
      filter: ['**/*'],
    },
    {
      from: 'resources/lyrics',
      to: 'lyrics',
      filter: ['**/*'],
    },
  ],
  publish: [
    {
      provider: 'github',
      owner: 'msfmsf777',
      repo: 'karaoke-helper-v3',
    },
  ],
  win: winConfig,
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false,
    multiLanguageInstaller: true,
    displayLanguageSelector: false,
    packElevateHelper: true,
    artifactName: '${productName}-Setup-${version}.${ext}',
    include: 'build/installer.nsh',
    installerLanguages: ['en_US', 'zh_TW', 'zh_CN', 'ja_JP', 'ko_KR', 'id_ID', 'th_TH'],
  },
};
