export type SongType = '伴奏' | '原曲';

export type AudioStatus = 'ready' | 'missing' | 'error';

export type LyricsStatus = 'none' | 'ready' | 'missing';

export interface SongSourceFile {
  kind: 'file';
  originalPath: string;
}

export interface SongMeta {
  id: string;
  title: string;
  artist?: string;
  type: SongType;
  audio_status: AudioStatus;
  lyrics_status: LyricsStatus;
  source: SongSourceFile;
  stored_filename: string;
  created_at: string;
  updated_at: string;
}
