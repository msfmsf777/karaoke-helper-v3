import type { SupportedLanguage } from './i18n';
import type { SetlistTemplateId } from './overlayTemplates';

export const ANALYTICS_NOTICE_VERSION = 1;

export type AnalyticsConsent = 'unset' | 'enabled' | 'disabled';

export interface AnalyticsSettings {
  consent: AnalyticsConsent;
  noticeVersion: number;
  decidedAt?: string;
}

export interface TelemetryClientRecord {
  version: 1;
  clientId: string;
}

export type AnalyticsReleaseChannel = 'beta' | 'stable';
export type AnalyticsWindowsVersion = '10' | '11' | 'other';
export type DurationBucket = 'under_10s' | '10s_to_1m' | '1m_to_5m' | 'over_5m';
export type FailureCategory =
  | 'network'
  | 'model_download'
  | 'runtime_start'
  | 'process_exit'
  | 'invalid_input'
  | 'interrupted'
  | 'permission'
  | 'unknown';
export type AnalyticsResult = 'success' | 'failure';

export interface AnalyticsCommonProperties {
  appVersion: string;
  releaseChannel: AnalyticsReleaseChannel;
  uiLanguage: SupportedLanguage;
  windowsVersion: AnalyticsWindowsVersion;
}

export type AnalyticsEvent =
  | { type: 'App.Launched' }
  | { type: 'Privacy.AnalyticsEnabled'; noticeVersion: number }
  | { type: 'Feature.StreamModeEntered' }
  | { type: 'Feature.OnlineSearchUsed' }
  | { type: 'Feature.OnlinePlaybackStarted' }
  | {
      type: 'Feature.DownloadFinished';
      result: AnalyticsResult;
      target: 'original' | 'instrumental' | 'custom';
      durationBucket: DurationBucket;
      failureCategory?: FailureCategory;
    }
  | {
      type: 'Feature.SeparationFinished';
      result: AnalyticsResult;
      quality: 'high' | 'normal' | 'fast';
      durationBucket: DurationBucket;
      failureCategory?: FailureCategory;
    }
  | {
      type: 'Feature.LyricsActionUsed';
      action: 'online_search' | 'raw_save' | 'lrc_save' | 'tap_sync' | 'smart_align' | 'japanese_assist';
    }
  | {
      type: 'Feature.ObsLinkCopied';
      kind: 'lyrics' | 'setlist';
      designClass: 'built_in' | 'custom';
      builtInTemplateId?: SetlistTemplateId;
    }
  | { type: 'Audio.OutputSafetyTriggered'; reason: 'overlapping_devices' }
  | { type: 'Reliability.SettingsRecovery'; result: 'restored_backup' | 'defaulted_after_corruption' }
  | { type: 'Reliability.OverlayTransportFallback'; from: 'websocket'; to: 'sse' }
  | {
      type: 'Update.Result';
      stage: 'check' | 'download' | 'install';
      result: AnalyticsResult;
      failureCategory?: FailureCategory;
    };

const CONSENTS = new Set<AnalyticsConsent>(['unset', 'enabled', 'disabled']);
const RESULTS = new Set<AnalyticsResult>(['success', 'failure']);
const DURATIONS = new Set<DurationBucket>(['under_10s', '10s_to_1m', '1m_to_5m', 'over_5m']);
const FAILURES = new Set<FailureCategory>([
  'network',
  'model_download',
  'runtime_start',
  'process_exit',
  'invalid_input',
  'interrupted',
  'permission',
  'unknown',
]);
const SETLIST_TEMPLATE_IDS = new Set<SetlistTemplateId>([
  'classic_list',
  'record_card',
  'compact_strip',
  'neon_signboard',
  'countdown_counter',
  'index_grid',
  'pager_console',
  'cassette_deck',
  'stage_marquee',
  'photo_stack',
  'vertical_column',
  'spinning_disk_list',
]);

export function createDefaultAnalyticsSettings(): AnalyticsSettings {
  return {
    consent: 'unset',
    noticeVersion: ANALYTICS_NOTICE_VERSION,
  };
}

export function normalizeAnalyticsSettings(value: unknown): AnalyticsSettings {
  if (!isRecord(value)
    || value.noticeVersion !== ANALYTICS_NOTICE_VERSION
    || typeof value.consent !== 'string'
    || !CONSENTS.has(value.consent as AnalyticsConsent)) {
    return createDefaultAnalyticsSettings();
  }

  const consent = value.consent as AnalyticsConsent;
  if (consent === 'unset') return createDefaultAnalyticsSettings();

  return {
    consent,
    noticeVersion: ANALYTICS_NOTICE_VERSION,
    ...(typeof value.decidedAt === 'string' ? { decidedAt: value.decidedAt } : {}),
  };
}

export function isAnalyticsEvent(value: unknown): value is AnalyticsEvent {
  if (!isRecord(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'App.Launched':
    case 'Feature.StreamModeEntered':
    case 'Feature.OnlineSearchUsed':
    case 'Feature.OnlinePlaybackStarted':
      return hasExactKeys(value, ['type']);
    case 'Privacy.AnalyticsEnabled':
      return hasExactKeys(value, ['type', 'noticeVersion'])
        && value.noticeVersion === ANALYTICS_NOTICE_VERSION;
    case 'Feature.DownloadFinished':
      return hasOptionalFailureKeys(value, ['type', 'result', 'target', 'durationBucket'])
        && RESULTS.has(value.result as AnalyticsResult)
        && ['original', 'instrumental', 'custom'].includes(String(value.target))
        && DURATIONS.has(value.durationBucket as DurationBucket);
    case 'Feature.SeparationFinished':
      return hasOptionalFailureKeys(value, ['type', 'result', 'quality', 'durationBucket'])
        && RESULTS.has(value.result as AnalyticsResult)
        && ['high', 'normal', 'fast'].includes(String(value.quality))
        && DURATIONS.has(value.durationBucket as DurationBucket);
    case 'Feature.LyricsActionUsed':
      return hasExactKeys(value, ['type', 'action'])
        && ['online_search', 'raw_save', 'lrc_save', 'tap_sync', 'smart_align', 'japanese_assist'].includes(String(value.action));
    case 'Feature.ObsLinkCopied': {
      const exactKeys = value.designClass === 'built_in' && value.kind === 'setlist'
        ? ['type', 'kind', 'designClass', 'builtInTemplateId']
        : ['type', 'kind', 'designClass'];
      return hasExactKeys(value, exactKeys)
        && ['lyrics', 'setlist'].includes(String(value.kind))
        && ['built_in', 'custom'].includes(String(value.designClass))
        && (value.kind !== 'setlist' || value.designClass !== 'built_in'
          || SETLIST_TEMPLATE_IDS.has(value.builtInTemplateId as SetlistTemplateId));
    }
    case 'Audio.OutputSafetyTriggered':
      return hasExactKeys(value, ['type', 'reason']) && value.reason === 'overlapping_devices';
    case 'Reliability.SettingsRecovery':
      return hasExactKeys(value, ['type', 'result'])
        && ['restored_backup', 'defaulted_after_corruption'].includes(String(value.result));
    case 'Reliability.OverlayTransportFallback':
      return hasExactKeys(value, ['type', 'from', 'to']) && value.from === 'websocket' && value.to === 'sse';
    case 'Update.Result':
      return hasOptionalFailureKeys(value, ['type', 'stage', 'result'])
        && ['check', 'download', 'install'].includes(String(value.stage))
        && RESULTS.has(value.result as AnalyticsResult);
    default:
      return false;
  }
}

function hasOptionalFailureKeys(value: Record<string, unknown>, requiredKeys: string[]): boolean {
  const allowedKeys = [...requiredKeys, 'failureCategory'];
  if (!hasOnlyKeys(value, allowedKeys) || !requiredKeys.every((key) => key in value)) return false;
  return value.failureCategory === undefined || FAILURES.has(value.failureCategory as FailureCategory);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => key in value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
