import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_NOTICE_VERSION,
  createDefaultAnalyticsSettings,
  isAnalyticsEvent,
  normalizeAnalyticsSettings,
} from '../shared/analytics.ts';

describe('analytics consent settings', () => {
  it('defaults to unset consent for users without analytics settings', () => {
    assert.deepEqual(createDefaultAnalyticsSettings(), {
      consent: 'unset',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
    });
    assert.deepEqual(normalizeAnalyticsSettings(undefined), {
      consent: 'unset',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
    });
  });

  it('requires a new choice when the privacy notice version changes', () => {
    assert.deepEqual(normalizeAnalyticsSettings({
      consent: 'enabled',
      noticeVersion: ANALYTICS_NOTICE_VERSION - 1,
      decidedAt: '2026-05-01T00:00:00.000Z',
    }), {
      consent: 'unset',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
    });
  });

  it('preserves an explicit decision for the current notice version', () => {
    assert.deepEqual(normalizeAnalyticsSettings({
      consent: 'disabled',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
      decidedAt: '2026-05-26T00:00:00.000Z',
    }), {
      consent: 'disabled',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
      decidedAt: '2026-05-26T00:00:00.000Z',
    });
  });
});

describe('analytics event allowlist', () => {
  it('accepts only defined categorical product events', () => {
    assert.equal(isAnalyticsEvent({
      type: 'Feature.SeparationFinished',
      result: 'failure',
      quality: 'normal',
      durationBucket: '10s_to_1m',
      failureCategory: 'model_download',
    }), true);
    assert.equal(isAnalyticsEvent({
      type: 'Feature.ObsLinkCopied',
      kind: 'setlist',
      designClass: 'built_in',
      builtInTemplateId: 'cassette_deck',
    }), true);
  });

  it('rejects content-bearing or arbitrary event properties', () => {
    assert.equal(isAnalyticsEvent({
      type: 'Feature.OnlineSearchUsed',
      query: 'secret unreleased cover',
    }), false);
    assert.equal(isAnalyticsEvent({
      type: 'Feature.SeparationFinished',
      result: 'failure',
      quality: 'normal',
      durationBucket: '10s_to_1m',
      failureCategory: 'model_download',
      error: 'D:\\private\\song.wav',
    }), false);
    assert.equal(isAnalyticsEvent({
      type: 'Feature.ObsLinkCopied',
      kind: 'setlist',
      designClass: 'custom',
      builtInTemplateId: 'my-private-overlay',
    }), false);
  });
});
