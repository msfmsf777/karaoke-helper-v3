export type SongType = '伴奏' | '原曲';

export type AudioStatus =
  | 'streaming'
  | 'original_only'
  | 'separation_pending'
  | 'separating'
  | 'separation_failed'
  | 'separated'
  // Legacy values from earlier phases; kept so older meta.json files still parse.
  | 'ready'
  | 'missing'
  | 'error';

export type LyricsStatus = 'none' | 'text_only' | 'synced';

export interface SongSourceFile {
  kind: 'file';
  originalPath: string;
}

export interface SongSourceYouTube {
  kind: 'youtube';
  youtubeId: string;
  originalPath: string;
}

export interface SongVocalRange {
  lowestMidi: number;
  highestMidi: number;
  lowestNote: string;
  highestNote: string;
  analyzedAt: string;
}

export interface SongMeta {
  id: string;
  title: string;
  artist?: string;
  type: SongType;
  audio_status: AudioStatus;
  lyrics_status?: LyricsStatus;
  lyrics_raw_path?: string;
  lyrics_lrc_path?: string;
  source: SongSourceFile | SongSourceYouTube;
  stored_filename: string;
  instrumental_path?: string;
  vocal_path?: string;
  last_separation_error: string | null;
  separation_quality?: 'high' | 'normal' | 'fast';
  created_at: string;
  updated_at: string;
  playback?: {
    speed: number;      // 0.5 - 2.0
    transpose: number;  // -12 - +12
  };
  duration?: number;
  thumbnailUrl?: string;
  thumbnail_path?: string;
  vocal_range?: SongVocalRange;
}

export interface DownloadJob {
  id: string;
  youtubeId: string;
  title: string;
  artist?: string;
  quality: 'best' | 'high' | 'normal';
  type?: SongType;
  lyricsText?: string;
  lyricsLrc?: string;
  thumbnailUrl?: string;
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  songId?: string;
  analyticsTarget?: 'original' | 'instrumental' | 'custom';
}

export interface RubySegment {
  surface: string;
  furigana: string | null;
}

export interface EnrichedLyricLine {
  original: string;
  romaji: string;
  ruby: RubySegment[];
}

export interface MigrationProgress {
  status: 'idle' | 'checking' | 'running' | 'verifying' | 'completed' | 'failed' | 'cancelled';
  sourcePath: string;
  targetPath: string;
  totalSongs: number;
  copiedSongs: number;
  currentSongTitle: string;
  totalBytes: number;
  copiedBytes: number;
  percent: number;
  error?: string;
  startedAt?: string;
}

export interface StoragePreflightResult {
  valid: boolean;
  canDirectSwitch: boolean;
  existingSongCountInTarget?: number;
  totalSongs: number;
  totalBytes: number;
  targetFreeBytes: number;
  error?: string;
}

export interface StorageInfo {
  currentPath: string;
  isDefault: boolean;
  totalSongs: number;
  totalBytes: number;
  freeBytes: number;
}
