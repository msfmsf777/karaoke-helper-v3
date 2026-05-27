import { app, ipcMain } from 'electron';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID, webcrypto } from 'node:crypto';
import TelemetryDeck from '@telemetrydeck/sdk';
import { loadSettings, saveSettings } from './userData';
import { AnalyticsService, type AnalyticsSender } from './analyticsService';
import {
  normalizeAnalyticsSettings,
  type AnalyticsCommonProperties,
  type AnalyticsConsent,
  type AnalyticsEvent,
  type AnalyticsSettings,
  type TelemetryClientRecord,
} from '../shared/analytics';
import { normalizeLanguage } from '../shared/i18n';

const TELEMETRY_CLIENT_FILE = 'telemetry-client.json';
const EMBEDDED_APP_ID = import.meta.env.VITE_TELEMETRYDECK_APP_ID ?? '';
const EMBEDDED_TEST_MODE = import.meta.env.VITE_TELEMETRYDECK_TEST_MODE === '1';
let analyticsService: AnalyticsService | null = null;
let ipcRegistered = false;

function getAppId(): string {
  return EMBEDDED_APP_ID || process.env.KH_TELEMETRYDECK_APP_ID || '';
}

function isTestMode(): boolean {
  return EMBEDDED_TEST_MODE || process.env.KH_TELEMETRYDECK_TEST_MODE === '1';
}

function getClientFilePath(): string {
  return path.join(app.getPath('userData'), TELEMETRY_CLIENT_FILE);
}

async function loadClientId(): Promise<string | null> {
  try {
    const content = await fs.readFile(getClientFilePath(), 'utf-8');
    const record = JSON.parse(content) as Partial<TelemetryClientRecord>;
    return record.version === 1 && typeof record.clientId === 'string' && record.clientId.length > 0
      ? record.clientId
      : null;
  } catch {
    return null;
  }
}

async function createClientId(): Promise<string> {
  const clientId = randomUUID();
  const filePath = getClientFilePath();
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  const record: TelemetryClientRecord = { version: 1, clientId };
  await fs.writeFile(tempPath, JSON.stringify(record, null, 2), 'utf-8');
  await fs.rename(tempPath, filePath);
  return clientId;
}

async function deleteClientId(): Promise<void> {
  try {
    await fs.unlink(getClientFilePath());
  } catch (err) {
    if (!(err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT')) throw err;
  }
}

async function loadAnalyticsSettings(): Promise<AnalyticsSettings> {
  return normalizeAnalyticsSettings((await loadSettings()).analytics);
}

async function saveAnalyticsSettings(analytics: AnalyticsSettings): Promise<void> {
  const settings = await loadSettings();
  settings.analytics = analytics;
  await saveSettings(settings);
}

async function getCommonProperties(): Promise<AnalyticsCommonProperties> {
  const settings = await loadSettings();
  const windowsBuild = Number(os.release().split('.')[2] ?? 0);
  const version = app.getVersion();
  return {
    appVersion: version,
    releaseChannel: version.includes('-') ? 'beta' : 'stable',
    uiLanguage: normalizeLanguage(settings.language),
    windowsVersion: windowsBuild >= 22000 ? '11' : process.platform === 'win32' ? '10' : 'other',
  };
}

async function createSender(clientId: string): Promise<AnalyticsSender | null> {
  const appID = getAppId();
  if (!appID) {
    console.info('[Analytics] Analytics enabled, but no TelemetryDeck app ID is configured; no signals will be sent.');
    return null;
  }

  const telemetryDeck = new TelemetryDeck({
    appID,
    clientUser: clientId,
    testMode: isTestMode(),
    subtleCrypto: webcrypto.subtle as unknown as Function,
  });

  return {
    async send(event, commonProperties) {
      const { type, ...eventProperties } = event;
      await telemetryDeck.signal(type, {
        ...commonProperties,
        ...eventProperties,
      });
    },
  };
}

function getService(): AnalyticsService {
  if (!analyticsService) {
    analyticsService = new AnalyticsService({
      loadSettings: loadAnalyticsSettings,
      saveSettings: saveAnalyticsSettings,
      loadClientId,
      createClientId,
      deleteClientId,
      createSender,
      getCommonProperties,
    });
  }
  return analyticsService;
}

export function registerAnalyticsIpc(): void {
  if (ipcRegistered) return;
  ipcRegistered = true;

  ipcMain.handle('analytics:get-settings', () => getService().getSettings());
  ipcMain.handle('analytics:set-consent', (_event, consent: AnalyticsConsent) => {
    if (consent !== 'enabled' && consent !== 'disabled') {
      throw new Error('Unsupported analytics consent value');
    }
    return getService().setConsent(consent);
  });
  ipcMain.handle('analytics:track', (_event, event: AnalyticsEvent) => getService().track(event));
}

export async function initializeAnalytics(): Promise<void> {
  await getService().initialize();
}

export async function trackAnalytics(event: AnalyticsEvent): Promise<boolean> {
  return getService().track(event);
}

export async function shutdownAnalytics(): Promise<void> {
  await analyticsService?.shutdown();
}
