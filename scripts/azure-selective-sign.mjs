import { spawnSync } from 'node:child_process';
import path from 'node:path';

const requiredEnv = [
  'KH_AZURE_SIGNING_ENDPOINT',
  'KH_AZURE_SIGNING_ACCOUNT',
  'KH_AZURE_CERTIFICATE_PROFILE',
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
];

export async function sign(configuration) {
  const filePath = configuration.path;
  if (!shouldSign(filePath)) {
    console.log(`Skipping bundled executable signing: ${filePath}`);
    return;
  }

  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Azure signing environment values: ${missing.join(', ')}`);
  }

  console.log(`Signing KHelper release executable with Azure Trusted Signing: ${filePath}`);
  const command = [
    "Import-Module TrustedSigning -Force",
    [
      'Invoke-TrustedSigning',
      psArg('Endpoint', process.env.KH_AZURE_SIGNING_ENDPOINT),
      psArg('CertificateProfileName', process.env.KH_AZURE_CERTIFICATE_PROFILE),
      psArg('CodeSigningAccountName', process.env.KH_AZURE_SIGNING_ACCOUNT),
      psArg('TimestampRfc3161', 'http://timestamp.acs.microsoft.com'),
      psArg('TimestampDigest', 'SHA256'),
      psArg('FileDigest', 'SHA256'),
      psArg('Files', filePath),
    ].join(' '),
  ].join('; ');

  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], {
    stdio: 'inherit',
    env: process.env,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Azure Trusted Signing failed for ${filePath}`);
  }
}

function shouldSign(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  const fileName = path.basename(filePath).toLowerCase();

  if (normalized.includes('/win-unpacked/resources/')) {
    return false;
  }

  return fileName === 'khelperv3.exe'
    || /^khelperv3-setup-.+\.exe$/.test(fileName)
    || fileName.endsWith('.__uninstaller.exe');
}

function psArg(name, value) {
  return `-${name} '${String(value).replace(/'/g, "''")}'`;
}
