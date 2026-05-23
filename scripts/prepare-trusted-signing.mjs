import { loadEnvFile, requireEnv, run } from './release-utils.mjs';

if (process.platform !== 'win32') {
  console.error('Azure Trusted Signing release builds must run on Windows.');
  process.exit(1);
}

loadEnvFile();
requireEnv(['AZURE_TENANT_ID', 'AZURE_CLIENT_ID', 'AZURE_CLIENT_SECRET']);

const command = [
  "$ErrorActionPreference = 'Stop'",
  "Install-PackageProvider -Name NuGet -MinimumVersion 2.8.5.201 -Force -Scope CurrentUser | Out-Null",
  "Install-Module -Name TrustedSigning -MinimumVersion 0.5.0 -Force -Repository PSGallery -Scope CurrentUser",
  "Import-Module TrustedSigning -Force",
  "Get-Command Invoke-TrustedSigning -ErrorAction Stop | Out-Null",
].join('; ');

console.log('Preparing Azure Trusted Signing PowerShell module...');
const sdkCheck = run('dotnet', ['--list-sdks'], { stdio: 'pipe', allowFailure: true });
if (sdkCheck.status !== 0 || !sdkCheck.stdout.trim()) {
  console.error('Azure Trusted Signing requires .NET 8 SDK or later, but no .NET SDK is installed.');
  console.error('Install it, then restart the terminal and rerun npm run release:build.');
  console.error('Recommended command: winget install --id Microsoft.DotNet.SDK.8 -e');
  process.exit(1);
}

run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command]);
await verifyAzureClientCredentials();

async function verifyAzureClientCredentials() {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(process.env.AZURE_TENANT_ID)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    scope: 'https://codesigning.azure.net/.default',
  });

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (response.ok) {
    return;
  }

  let details = '';
  try {
    const payload = await response.json();
    details = payload.error_description || payload.error || '';
  } catch {
    details = await response.text();
  }

  console.error('Azure client-credential authentication failed before signing.');
  if (details.includes('AADSTS9002346')) {
    console.error('The configured app registration is Microsoft-account-only. Trusted Signing needs an Entra app registration that supports client credentials in your Azure tenant.');
    console.error('Create a new app registration under Microsoft Entra ID with "Accounts in this organizational directory only", create a client secret, assign it the Artifact Signing Certificate Profile Signer role, then update AZURE_CLIENT_ID and AZURE_CLIENT_SECRET.');
  } else {
    console.error(sanitizeAuthError(details));
  }
  process.exit(1);
}

function sanitizeAuthError(message) {
  return String(message)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<guid>')
    .replace(/client_secret=[^&\s]+/gi, 'client_secret=<redacted>');
}
