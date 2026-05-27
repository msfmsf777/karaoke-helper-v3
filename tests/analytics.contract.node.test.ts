import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ANALYTICS_NOTICE_VERSION,
  categorizeAnalyticsFailure,
  createDefaultAnalyticsSettings,
  durationBucketFromMilliseconds,
  isAnalyticsEvent,
  normalizeAnalyticsSettings,
  shouldPromptForAnalyticsConsent,
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

  it('prompts only until the current notice has an explicit decision', () => {
    assert.equal(shouldPromptForAnalyticsConsent(createDefaultAnalyticsSettings()), true);
    assert.equal(shouldPromptForAnalyticsConsent({
      consent: 'enabled',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
    }), false);
    assert.equal(shouldPromptForAnalyticsConsent({
      consent: 'disabled',
      noticeVersion: ANALYTICS_NOTICE_VERSION,
    }), false);
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

describe('analytics property sanitizers', () => {
  it('reduces durations to fixed buckets', () => {
    assert.equal(durationBucketFromMilliseconds(500), 'under_10s');
    assert.equal(durationBucketFromMilliseconds(10_000), '10s_to_1m');
    assert.equal(durationBucketFromMilliseconds(60_000), '1m_to_5m');
    assert.equal(durationBucketFromMilliseconds(300_000), 'over_5m');
    assert.equal(durationBucketFromMilliseconds(Number.NaN), 'under_10s');
  });

  it('reduces failures to fixed categories without returning raw details', () => {
    assert.equal(categorizeAnalyticsFailure(new Error('fetch timed out')), 'network');
    assert.equal(categorizeAnalyticsFailure(new Error('permission denied writing file')), 'permission');
    assert.equal(categorizeAnalyticsFailure(new Error('private song title')), 'unknown');
  });
});
