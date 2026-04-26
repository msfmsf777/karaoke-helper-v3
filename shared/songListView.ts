export type SongListSortKey =
  | 'original'
  | 'title'
  | 'artist'
  | 'favorite'
  | 'type'
  | 'audio'
  | 'lyrics'
  | 'duration'
  | 'created'
  | 'updated';

export type SongListSortDirection = 'asc' | 'desc';

export interface SongListFilters {
  type: 'all' | '原曲' | '伴奏';
  audio: 'all' | 'streaming' | 'original_only' | 'separated' | 'separation_pending' | 'separating' | 'separation_failed';
  lyrics: 'all' | 'none' | 'text_only' | 'synced';
  source: 'all' | 'file' | 'youtube';
  favorite: 'all' | 'favorite' | 'not_favorite';
}

export interface SongListViewConfig {
  search: string;
  filters: SongListFilters;
  sortKey: SongListSortKey;
  sortDirection: SongListSortDirection;
}

export type SongListViewConfigs = Record<string, SongListViewConfig>;

export const DEFAULT_SONG_LIST_VIEW_CONFIG: SongListViewConfig = {
  search: '',
  filters: {
    type: 'all',
    audio: 'all',
    lyrics: 'all',
    source: 'all',
    favorite: 'all',
  },
  sortKey: 'original',
  sortDirection: 'asc',
};

export function mergeSongListViewConfig(config?: Partial<SongListViewConfig> | null): SongListViewConfig {
  return {
    search: config?.search ?? DEFAULT_SONG_LIST_VIEW_CONFIG.search,
    filters: {
      ...DEFAULT_SONG_LIST_VIEW_CONFIG.filters,
      ...(config?.filters ?? {}),
    },
    sortKey: config?.sortKey ?? DEFAULT_SONG_LIST_VIEW_CONFIG.sortKey,
    sortDirection: config?.sortDirection ?? DEFAULT_SONG_LIST_VIEW_CONFIG.sortDirection,
  };
}

export function mergeSongListViewConfigs(configs?: Record<string, Partial<SongListViewConfig>> | null): SongListViewConfigs {
  return Object.fromEntries(
    Object.entries(configs ?? {}).map(([key, config]) => [key, mergeSongListViewConfig(config)])
  );
}
