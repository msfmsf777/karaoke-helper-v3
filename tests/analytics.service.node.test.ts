import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { AnalyticsService, type AnalyticsSender } from '../electron/analyticsService.ts';
import { ANALYTICS_NOTICE_VERSION, createDefaultAnalyticsSettings, type AnalyticsSettings } from '../shared/analytics.ts';

function createHarness() {
  let settings: AnalyticsSettings = createDefaultAnalyticsSettings();
  let storedClientId: string | null = null;
  let deletedClientIds = 0;
  const sent: string[] = [];
  const sender: AnalyticsSender = {
    async send(event) {
      sent.push(event.type);
    },
  };

  const service = new AnalyticsService({
    async loadSettings() {
      return settings;
    },
    async saveSettings(nextSettings) {
      settings = nextSettings;
    },
    async loadClientId() {
      return storedClientId;
    },
    async createClientId() {
      storedClientId = 'anonymous-installation-id';
      return storedClientId;
    },
    async deleteClientId() {
      storedClientId = null;
      deletedClientIds += 1;
    },
    async createSender() {
      return sender;
    },
    async getCommonProperties() {
      return {
        appVersion: '3.3.0-beta',
        releaseChannel: 'beta',
        uiLanguage: 'en',
        windowsVersion: '11',
      };
    },
    now: () => new Date('2026-05-26T01:00:00.000Z'),
  }, {
    flushAtCount: 1,
    flushIntervalMs: 60_000,
  });

  return {
    service,
    getSettings: () => settings,
    getStoredClientId: () => storedClientId,
    getDeletedClientIds: () => deletedClientIds,
    sent,
  };
}

describe('analytics service consent boundary', () => {
  it('does not create an identifier or send events before affirmative consent', async () => {
    const harness = createHarness();
    await harness.service.initialize();

    const tracked = await harness.service.track({ type: 'Feature.StreamModeEntered' });

    assert.equal(tracked, false);
    assert.equal(harness.getStoredClientId(), null);
    assert.deepEqual(harness.sent, []);
  });

  it('creates an identifier after opt-in and sends the enabled signal', async () => {
    const harness = createHarness();
    await harness.service.initialize();

    await harness.service.setConsent('enabled');

    assert.deepEqual(harness.getSettings(), {
      consent: 'enabled',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
      decidedAt: '2026-05-26T01:00:00.000Z',
    });
    assert.equal(harness.getStoredClientId(), 'anonymous-installation-id');
    assert.deepEqual(harness.sent, ['Privacy.AnalyticsEnabled']);
  });

  it('clears queued work and removes the local identifier when consent is disabled', async () => {
    const harness = createHarness();
    await harness.service.initialize();
    await harness.service.setConsent('enabled');

    await harness.service.setConsent('disabled');
    const tracked = await harness.service.track({ type: 'Feature.StreamModeEntered' });

    assert.equal(tracked, false);
    assert.equal(harness.getStoredClientId(), null);
    assert.equal(harness.getDeletedClientIds(), 1);
    assert.deepEqual(harness.getSettings(), {
      consent: 'disabled',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
      decidedAt: '2026-05-26T01:00:00.000Z',
    });
  });

  it('rejects unapproved payloads even after consent', async () => {
    const harness = createHarness();
    await harness.service.initialize();
    await harness.service.setConsent('enabled');

    const tracked = await harness.service.track({
      type: 'Feature.OnlineSearchUsed',
      query: 'private title',
    } as never);

    assert.equal(tracked, false);
    assert.deepEqual(harness.sent, ['Privacy.AnalyticsEnabled']);
  });
});
