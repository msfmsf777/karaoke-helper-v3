import { loadEnvFile, requireEnv, runBuildPipeline } from './release-utils.mjs';

loadEnvFile();
requireEnv([
  'KH_AZURE_SIGNING_ENDPOINT',
  'KH_AZURE_SIGNING_ACCOUNT',
  'KH_AZURE_CERTIFICATE_PROFILE',
  'KH_AZURE_PUBLISHER_NAME',
  'AZURE_TENANT_ID',
  'AZURE_CLIENT_ID',
  'AZURE_CLIENT_SECRET',
]);

console.log('Building signed release package...');
runBuildPipeline({ signed: true });
