import type { TFunction } from 'i18next';
import type { HotkeyAction, HotkeyGroup } from '../../shared/hotkeys';
import type { AudioStatus, DownloadJob, LyricsStatus, SongSourceFile, SongSourceYouTube, SongType } from '../../shared/songTypes';
import i18n from './index';

const songTypeKeys: Record<SongType, string> = {
  原曲: 'domain.songType.original',
  伴奏: 'domain.songType.instrumental',
};

const audioStatusKeys: Record<AudioStatus, string> = {
  streaming: 'domain.audioStatus.streaming',
  original_only: 'domain.audioStatus.original_only',
  separation_pending: 'domain.audioStatus.separation_pending',
  separating: 'domain.audioStatus.separating',
  separation_failed: 'domain.audioStatus.separation_failed',
  separated: 'domain.audioStatus.separated',
  ready: 'domain.audioStatus.ready',
  missing: 'domain.audioStatus.missing',
  error: 'domain.audioStatus.error',
};

const lyricsStatusKeys: Record<LyricsStatus, string> = {
  none: 'domain.lyricsStatus.none',
  text_only: 'domain.lyricsStatus.text_only',
  synced: 'domain.lyricsStatus.synced',
};

const downloadStatusKeys: Record<DownloadJob['status'], string> = {
  queued: 'domain.downloadStatus.queued',
  downloading: 'domain.downloadStatus.downloading',
  processing: 'domain.downloadStatus.processing',
  completed: 'domain.downloadStatus.completed',
  failed: 'domain.downloadStatus.failed',
};

const hotkeyGroupKeys: Record<HotkeyGroup, string> = {
  playback: 'domain.hotkeys.groups.playback',
  custom: 'domain.hotkeys.groups.custom',
};

type SongSourceKind = SongSourceFile['kind'] | SongSourceYouTube['kind'];

const sourceKindKeys: Record<SongSourceKind, string> = {
  file: 'domain.source.file',
  youtube: 'domain.source.youtube',
};

export function getSongTypeLabel(t: TFunction, type: SongType): string {
  return t(songTypeKeys[type]);
}

export function getAudioStatusLabel(t: TFunction, status: AudioStatus): string {
  return t(audioStatusKeys[status]);
}

export function getLyricsStatusLabel(t: TFunction, status?: LyricsStatus, short = false): string {
  if (!status || status === 'none') {
    return t(short ? 'domain.lyricsStatus.shortNone' : 'domain.lyricsStatus.none');
  }
  return t(lyricsStatusKeys[status]);
}

export function getSourceKindLabel(t: TFunction, kind: SongSourceKind): string {
  return t(sourceKindKeys[kind]);
}

export function getDownloadStatusLabel(t: TFunction, status: DownloadJob['status']): string {
  return t(downloadStatusKeys[status]);
}

export function getHotkeyGroupLabel(t: TFunction, group: HotkeyGroup): string {
  return t(hotkeyGroupKeys[group]);
}

export function getHotkeyActionLabel(t: TFunction, action: HotkeyAction): string {
  return t(`domain.hotkeys.actions.${action}.label`);
}

export function getHotkeyActionDescription(t: TFunction, action: HotkeyAction): string {
  return t(`domain.hotkeys.actions.${action}.description`);
}

export function getHotkeyFailureLabel(t: TFunction, reason: string): string {
  switch (reason) {
    case 'plain-global':
    case '全域快捷鍵需包含修飾鍵':
      return t('domain.hotkeys.failures.plainGlobal');
    case 'duplicate':
    case '重複快捷鍵':
      return t('domain.hotkeys.failures.duplicate');
    case 'occupied':
    case '被其他應用程式佔用':
      return t('domain.hotkeys.failures.occupied');
    default:
      return reason;
  }
}

export function formatViewCount(t: TFunction, views?: number): string {
  if (!views) return '';
  if (i18n.language.startsWith('en')) {
    const compact = new Intl.NumberFormat('en', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(views);
    return t('domain.viewCount', { count: compact });
  }
  if (views >= 10000) {
    return t('domain.viewCountTenThousands', { count: (views / 10000).toFixed(1) });
  }
  return t('domain.viewCount', { count: views.toLocaleString() });
}
