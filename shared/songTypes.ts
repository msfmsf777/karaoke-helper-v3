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
  instrumental_path?: string;
  vocal_path?: string;
  last_separation_error?: string | null;
  created_at: string;
  updated_at: string;
}
