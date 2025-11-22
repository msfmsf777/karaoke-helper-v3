export type SongType = '伴奏' | '原曲';

export type AudioStatus =
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
}

export interface DownloadJob {
  id: string;
  youtubeId: string;
  title: string;
  artist?: string;
  quality: 'best' | 'high' | 'normal';
  status: 'queued' | 'downloading' | 'processing' | 'completed' | 'failed';
  progress: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  songId?: string;
}
