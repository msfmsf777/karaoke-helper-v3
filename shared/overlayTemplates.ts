export type OverlayKind = 'lyrics' | 'setlist';

export type LyricsLineMode = 'count' | 'fill';
export type LyricsAnimation = 'none' | 'scroll' | 'fade' | 'slide' | 'scale';
export type LyricsRubyPolicy = 'follow_app' | 'show' | 'hide';
export type SetlistTemplateId =
  | 'classic_list'
  | 'record_card'
  | 'compact_strip'
  | 'neon_signboard'
  | 'countdown_counter'
  | 'index_grid'
  | 'pager_console'
  | 'cassette_deck'
  | 'stage_marquee'
  | 'photo_stack'
  | 'vertical_column'
  | 'spinning_disk_list';
export type SetlistDensity = 'compact' | 'comfortable';
export type SetlistFrameStyle = 'solid' | 'glass' | 'neon';
export type SetlistEmptyState = 'hide' | 'waiting';
export type SetlistChangeAnimation = 'none' | 'fade' | 'slide';
export type OverlayPlaybackMode = 'normal' | 'repeat_one' | 'random' | 'stream';
export type SetlistColumnAlign = 'left' | 'center' | 'right';
export type SetlistDiskStyle = 'vinyl' | 'ring' | 'dot' | 'thumbnail';
export type SetlistDiskSpinMode = 'off' | 'current' | 'all';
export type SetlistMotionDetail = 'off' | 'subtle' | 'full';
export type SetlistTextEffect = 'normal' | 'lcd' | 'pixel';
export type SetlistLightAnimation = 'off' | 'breathe' | 'flash' | 'chase' | 'rainbow';
export type SetlistLightPalette = 'accent' | 'warm' | 'cool' | 'rainbow';
export type SetlistCardTransition = 'none' | 'slide';
export type SetlistTickerSource = 'upcoming' | 'history';

export interface SetlistTemplateOptions {
  columnAlign: SetlistColumnAlign;
  columnWidth: number;
  topOffset: number;
  rowGap: number;
  titleBarOpacity: number;
  dividerOpacity: number;
  patternOpacity: number;
  currentFontSize: number;
  reserveFontSize: number;
  diskSize: number;
  diskStyle: SetlistDiskStyle;
  diskSpinMode: SetlistDiskSpinMode;
  diskSpinSpeed: number;
  diskBorderWidth: number;
  rowWidth: number;
  rowOpacity: number;
  currentEmphasis: number;
  decorationIntensity: number;
  textureOpacity: number;
  motionDetail: SetlistMotionDetail;
  graphicVariant: string;
  tickerSpeed: number;
  textEffect: SetlistTextEffect;
  lightAnimation: SetlistLightAnimation;
  lightPalette: SetlistLightPalette;
  contentInset: number;
  cardTransition: SetlistCardTransition;
  currentGlow: number;
  cassetteDepth: number;
  tickerSource: SetlistTickerSource;
  footerLabel: string;
  noteColor: string;
}

export interface LyricsOverlayTemplateConfig {
  fontFamily: string;
  lineMode: LyricsLineMode;
  lineCount: number;
  activeFontSize: number;
  inactiveFontSize: number;
  lineGap: number;
  letterSpacing: number;
  activeColor: string;
  inactiveColor: string;
  passedColor: string;
  strokeColor: string;
  strokeWidth: number;
  glowColor: string;
  glowStrength: number;
  animation: LyricsAnimation;
  animationDurationMs: number;
  animationIntensity: number;
  furiganaPolicy: LyricsRubyPolicy;
  romajiPolicy: LyricsRubyPolicy;
  romajiLetterSpacing: number;
  romajiMarginTop: number;
}

export interface SetlistOverlayTemplateConfig {
  templateId: SetlistTemplateId;
  presetId: string;
  fontFamily: string;
  accentColor: string;
  textColor: string;
  secondaryColor: string;
  showCurrent: boolean;
  showUpcoming: boolean;
  showHistory: boolean;
  showCounts: boolean;
  currentLabel: string;
  upcomingLabel: string;
  historyLabel: string;
  showArtist: boolean;
  showNumbering: boolean;
  showThumbnails: boolean;
  showDuration: boolean;
  density: SetlistDensity;
  frameStyle: SetlistFrameStyle;
  outerRadius: number;
  innerRadius: number;
  overallOpacity: number;
  autoScroll: boolean;
  autoScrollSpeed: number;
  autoScrollPauseMs: number;
  changeAnimation: SetlistChangeAnimation;
  emptyState: SetlistEmptyState;
  waitingText: string;
  showWaitingSongTitle: boolean;
  gridColumns: number;
  templateOptions: SetlistTemplateOptions;
}

export interface LyricsOverlayDesign {
  id: string;
  name: string;
  config: LyricsOverlayTemplateConfig;
}

export interface SetlistOverlayDesign {
  id: string;
  name: string;
  config: SetlistOverlayTemplateConfig;
}

export interface OverlayTemplatesConfig {
  version: 2;
  activeLyricsDesignId: string;
  activeSetlistDesignId: string;
  lyricsDesigns: LyricsOverlayDesign[];
  setlistDesigns: SetlistOverlayDesign[];
}

export interface LegacyLyricStyleLike {
  fontSize?: number;
  inactiveColor?: string;
  activeColor?: string;
  activeGlowColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
}

interface LegacyCombinedDesign {
  id?: string;
  name?: string;
  shared?: {
    previewSize?: string;
    accentColor?: string;
    textColor?: string;
    secondaryColor?: string;
    fontFamily?: string;
  };
  lyrics?: Partial<LyricsOverlayTemplateConfig> & {
    lineMode?: string;
    templateId?: string;
    verticalAnchor?: string;
    horizontalAlign?: string;
    safePadding?: number;
    offsetX?: number;
    offsetY?: number;
  };
  setlist?: Partial<SetlistOverlayTemplateConfig> & {
    maxUpcoming?: number;
    maxHistory?: number;
    sectionOrder?: string[];
    horizontalAlign?: string;
    showTypeBadge?: boolean;
    shapeStyle?: string;
  };
}

export const DEFAULT_OVERLAY_DESIGN_ID = 'default';
export const DEFAULT_OVERLAY_FONT = '"Segoe UI", "Noto Sans TC", "Microsoft JhengHei", sans-serif';

export const SETLIST_TEMPLATE_LABELS: Record<SetlistTemplateId, string> = {
  classic_list: '經典清單',
  record_card: '唱片卡片',
  compact_strip: '精簡橫條',
  neon_signboard: '霓虹看板',
  countdown_counter: '倒數看板',
  index_grid: '完整清單',
  pager_console: '復古呼叫器',
  cassette_deck: '卡帶播放器',
  stage_marquee: '舞台燈牌',
  photo_stack: '拍立得歌單',
  vertical_column: '直式留白清單',
  spinning_disk_list: '圓盤歌列',
};

type SetlistPresetDefaults =
  Partial<Omit<SetlistOverlayTemplateConfig, 'templateId' | 'presetId' | 'templateOptions'>>
  & { templateOptions?: Partial<SetlistTemplateOptions> };

export interface SetlistTemplatePreset {
  id: string;
  label: string;
  defaults: SetlistPresetDefaults;
}

export const SETLIST_TEMPLATE_PRESETS: Record<SetlistTemplateId, SetlistTemplatePreset[]> = {
  classic_list: [
    {
      id: 'neon_cyan',
      label: 'Cyan Neon',
      defaults: {
        accentColor: '#00e5ff',
        textColor: '#ffffff',
        secondaryColor: '#b8c7d9',
        frameStyle: 'neon',
        outerRadius: 20,
        innerRadius: 10,
        density: 'comfortable',
        showHistory: false,
        showThumbnails: false,
        showDuration: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 1200,
      },
    },
    {
      id: 'dark_glass',
      label: 'Dark Glass',
      defaults: {
        accentColor: '#8fbaff',
        textColor: '#ffffff',
        secondaryColor: '#c8d3e4',
        frameStyle: 'glass',
        outerRadius: 18,
        innerRadius: 10,
        density: 'comfortable',
        showHistory: false,
        showThumbnails: true,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1100,
      },
    },
    {
      id: 'clean_white',
      label: 'Clean White',
      defaults: {
        accentColor: '#111827',
        textColor: '#111827',
        secondaryColor: '#4b5563',
        frameStyle: 'solid',
        outerRadius: 12,
        innerRadius: 8,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 1000,
      },
    },
  ],
  record_card: [
    {
      id: 'vinyl_glass',
      label: 'Vinyl Glass',
      defaults: {
        accentColor: '#9ee7ff',
        textColor: '#ffffff',
        secondaryColor: '#d6e5f5',
        frameStyle: 'glass',
        outerRadius: 22,
        innerRadius: 18,
        density: 'compact',
        showHistory: false,
        showThumbnails: true,
        showDuration: false,
        autoScroll: false,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
      },
    },
    {
      id: 'pastel_tunes',
      label: 'Pastel Tunes',
      defaults: {
        accentColor: '#e9c8ff',
        textColor: '#ffffff',
        secondaryColor: '#ffeefc',
        frameStyle: 'glass',
        outerRadius: 28,
        innerRadius: 20,
        density: 'compact',
        showHistory: false,
        showThumbnails: true,
        showDuration: true,
        autoScroll: false,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
      },
    },
    {
      id: 'noir_album',
      label: 'Noir Album',
      defaults: {
        accentColor: '#f3f4f6',
        textColor: '#ffffff',
        secondaryColor: '#9ca3af',
        frameStyle: 'solid',
        outerRadius: 18,
        innerRadius: 14,
        density: 'compact',
        showHistory: false,
        showThumbnails: true,
        showDuration: true,
        autoScroll: false,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
      },
    },
  ],
  compact_strip: [
    {
      id: 'minimal_text',
      label: 'Minimal Text',
      defaults: {
        accentColor: '#f5f5f5',
        textColor: '#ffffff',
        secondaryColor: '#b9c0cc',
        frameStyle: 'glass',
        outerRadius: 14,
        innerRadius: 10,
        density: 'compact',
        showHistory: true,
        showThumbnails: false,
        showDuration: false,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 900,
      },
    },
    {
      id: 'tag_queue',
      label: 'Tag Queue',
      defaults: {
        accentColor: '#ff74b8',
        textColor: '#ffffff',
        secondaryColor: '#ffd6e9',
        frameStyle: 'solid',
        outerRadius: 30,
        innerRadius: 18,
        density: 'compact',
        showHistory: true,
        showThumbnails: false,
        showDuration: false,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 5,
        autoScrollPauseMs: 800,
      },
    },
    {
      id: 'mini_panel',
      label: 'Mini Panel',
      defaults: {
        accentColor: '#7dd3fc',
        textColor: '#ffffff',
        secondaryColor: '#c7d2fe',
        frameStyle: 'glass',
        outerRadius: 18,
        innerRadius: 12,
        density: 'compact',
        showHistory: true,
        showThumbnails: true,
        showDuration: true,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
      },
    },
  ],
  neon_signboard: [
    {
      id: 'pink_neon',
      label: 'Pink Neon',
      defaults: {
        accentColor: '#ff4fad',
        textColor: '#ffe8f5',
        secondaryColor: '#ffb6de',
        frameStyle: 'neon',
        outerRadius: 24,
        innerRadius: 12,
        density: 'comfortable',
        showHistory: true,
        showThumbnails: false,
        showDuration: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 1200,
      },
    },
    {
      id: 'blue_stage',
      label: 'Blue Stage',
      defaults: {
        accentColor: '#38bdf8',
        textColor: '#ffffff',
        secondaryColor: '#bae6fd',
        frameStyle: 'neon',
        outerRadius: 18,
        innerRadius: 8,
        density: 'comfortable',
        showHistory: true,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 1000,
      },
    },
    {
      id: 'green_bar',
      label: 'Green Bar',
      defaults: {
        accentColor: '#34d399',
        textColor: '#ecfdf5',
        secondaryColor: '#a7f3d0',
        frameStyle: 'glass',
        outerRadius: 12,
        innerRadius: 6,
        density: 'compact',
        showHistory: true,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1200,
      },
    },
  ],
  countdown_counter: [
    {
      id: 'gold_countdown',
      label: 'Gold Countdown',
      defaults: {
        accentColor: '#facc15',
        textColor: '#fff7ed',
        secondaryColor: '#fde68a',
        frameStyle: 'solid',
        outerRadius: 20,
        innerRadius: 10,
        density: 'comfortable',
        showHistory: false,
        showThumbnails: false,
        showDuration: false,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1400,
      },
    },
    {
      id: 'mono_counter',
      label: 'Mono Counter',
      defaults: {
        accentColor: '#f8fafc',
        textColor: '#ffffff',
        secondaryColor: '#cbd5e1',
        frameStyle: 'glass',
        outerRadius: 12,
        innerRadius: 6,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1200,
      },
    },
    {
      id: 'ranking_board',
      label: 'Ranking Board',
      defaults: {
        accentColor: '#fb7185',
        textColor: '#fff1f2',
        secondaryColor: '#fecdd3',
        frameStyle: 'neon',
        outerRadius: 16,
        innerRadius: 10,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        showNumbering: true,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 1000,
      },
    },
  ],
  index_grid: [
    {
      id: 'rose_grid',
      label: 'Rose Grid',
      defaults: {
        accentColor: '#fda4af',
        textColor: '#fff1f2',
        secondaryColor: '#fecdd3',
        frameStyle: 'glass',
        outerRadius: 14,
        innerRadius: 8,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1200,
        gridColumns: 4,
      },
    },
    {
      id: 'clear_grid',
      label: 'Clear Grid',
      defaults: {
        accentColor: '#ffffff',
        textColor: '#ffffff',
        secondaryColor: '#d1d5db',
        frameStyle: 'glass',
        outerRadius: 10,
        innerRadius: 4,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1200,
        gridColumns: 4,
      },
    },
    {
      id: 'mono_grid',
      label: 'Mono Grid',
      defaults: {
        accentColor: '#e5e7eb',
        textColor: '#f9fafb',
        secondaryColor: '#9ca3af',
        frameStyle: 'solid',
        outerRadius: 0,
        innerRadius: 0,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1200,
        gridColumns: 5,
      },
    },
  ],
  pager_console: [
    {
      id: 'lime_lcd',
      label: 'Lime LCD',
      defaults: {
        accentColor: '#58715d',
        textColor: '#203427',
        secondaryColor: '#40573f',
        frameStyle: 'solid',
        outerRadius: 30,
        innerRadius: 14,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 900,
        templateOptions: {
          decorationIntensity: 0.8,
          textureOpacity: 0.32,
          motionDetail: 'subtle',
          graphicVariant: 'lime',
          tickerSpeed: 4,
          textEffect: 'lcd',
        },
      },
    },
    {
      id: 'amber_lcd',
      label: 'Amber LCD',
      defaults: {
        accentColor: '#f59e0b',
        textColor: '#fff7ed',
        secondaryColor: '#fed7aa',
        frameStyle: 'solid',
        outerRadius: 28,
        innerRadius: 12,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 900,
        templateOptions: {
          decorationIntensity: 0.65,
          textureOpacity: 0.26,
          motionDetail: 'subtle',
          graphicVariant: 'amber',
          tickerSpeed: 4,
          textEffect: 'pixel',
        },
      },
    },
    {
      id: 'night_pager',
      label: 'Night Pager',
      defaults: {
        accentColor: '#93c5fd',
        textColor: '#eff6ff',
        secondaryColor: '#bfdbfe',
        frameStyle: 'glass',
        outerRadius: 28,
        innerRadius: 14,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          decorationIntensity: 0.7,
          textureOpacity: 0.18,
          motionDetail: 'subtle',
          graphicVariant: 'night',
          tickerSpeed: 3,
          textEffect: 'lcd',
        },
      },
    },
  ],
  cassette_deck: [
    {
      id: 'city_pop',
      label: 'City Pop',
      defaults: {
        accentColor: '#fb7185',
        textColor: '#fff7ed',
        secondaryColor: '#fed7aa',
        frameStyle: 'glass',
        outerRadius: 26,
        innerRadius: 16,
        density: 'compact',
        showHistory: false,
        showThumbnails: true,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          decorationIntensity: 0.78,
          textureOpacity: 0.2,
          motionDetail: 'subtle',
          graphicVariant: 'city',
          cassetteDepth: 0.78,
          diskSpinMode: 'current',
          diskSpinSpeed: 4,
        },
      },
    },
    {
      id: 'noir_tape',
      label: 'Noir Tape',
      defaults: {
        accentColor: '#e5e7eb',
        textColor: '#f9fafb',
        secondaryColor: '#9ca3af',
        frameStyle: 'solid',
        outerRadius: 18,
        innerRadius: 10,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          decorationIntensity: 0.55,
          textureOpacity: 0.12,
          motionDetail: 'subtle',
          graphicVariant: 'noir',
          cassetteDepth: 0.62,
          diskSpinMode: 'current',
          diskSpinSpeed: 4,
        },
      },
    },
    {
      id: 'cream_retro',
      label: 'Cream Retro',
      defaults: {
        accentColor: '#d97706',
        textColor: '#451a03',
        secondaryColor: '#92400e',
        frameStyle: 'solid',
        outerRadius: 22,
        innerRadius: 12,
        density: 'compact',
        showHistory: false,
        showThumbnails: true,
        showDuration: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1100,
        templateOptions: {
          decorationIntensity: 0.7,
          textureOpacity: 0.16,
          motionDetail: 'subtle',
          graphicVariant: 'cream',
          cassetteDepth: 0.7,
          diskSpinMode: 'current',
          diskSpinSpeed: 3,
        },
      },
    },
  ],
  stage_marquee: [
    {
      id: 'gold_theater',
      label: 'Gold Theater',
      defaults: {
        accentColor: '#facc15',
        textColor: '#fff7ed',
        secondaryColor: '#fde68a',
        frameStyle: 'neon',
        outerRadius: 20,
        innerRadius: 10,
        density: 'comfortable',
        showHistory: true,
        showThumbnails: false,
        showDuration: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 1200,
        templateOptions: {
          decorationIntensity: 0.9,
          textureOpacity: 0.18,
          motionDetail: 'full',
          graphicVariant: 'gold',
          lightAnimation: 'chase',
          lightPalette: 'warm',
          tickerSpeed: 5,
        },
      },
    },
    {
      id: 'blue_livehouse',
      label: 'Blue Livehouse',
      defaults: {
        accentColor: '#38bdf8',
        textColor: '#ffffff',
        secondaryColor: '#bae6fd',
        frameStyle: 'neon',
        outerRadius: 18,
        innerRadius: 10,
        density: 'comfortable',
        showHistory: true,
        showThumbnails: false,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 1000,
        templateOptions: {
          decorationIntensity: 0.72,
          textureOpacity: 0.16,
          motionDetail: 'subtle',
          graphicVariant: 'blue',
          lightAnimation: 'breathe',
          lightPalette: 'cool',
          tickerSpeed: 4,
        },
      },
    },
    {
      id: 'pink_idol',
      label: 'Pink Idol',
      defaults: {
        accentColor: '#fb7185',
        textColor: '#fff1f2',
        secondaryColor: '#fecdd3',
        frameStyle: 'neon',
        outerRadius: 24,
        innerRadius: 14,
        density: 'comfortable',
        showHistory: true,
        showThumbnails: false,
        showDuration: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 1100,
        templateOptions: {
          decorationIntensity: 0.84,
          textureOpacity: 0.16,
          motionDetail: 'full',
          graphicVariant: 'pink',
          lightAnimation: 'rainbow',
          lightPalette: 'rainbow',
          tickerSpeed: 5,
        },
      },
    },
  ],
  photo_stack: [
    {
      id: 'polaroid_white',
      label: 'Polaroid White',
      defaults: {
        accentColor: '#f8fafc',
        textColor: '#111827',
        secondaryColor: '#4b5563',
        frameStyle: 'solid',
        outerRadius: 18,
        innerRadius: 8,
        density: 'compact',
        showHistory: false,
        showThumbnails: true,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          decorationIntensity: 0.52,
          textureOpacity: 0.18,
          motionDetail: 'subtle',
          graphicVariant: 'white',
          cardTransition: 'slide',
          currentGlow: 0.36,
          noteColor: '#334155',
        },
      },
    },
    {
      id: 'dark_wall',
      label: 'Dark Wall',
      defaults: {
        accentColor: '#a78bfa',
        textColor: '#ffffff',
        secondaryColor: '#c4b5fd',
        frameStyle: 'glass',
        outerRadius: 18,
        innerRadius: 8,
        density: 'compact',
        showHistory: false,
        showThumbnails: true,
        showDuration: true,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          decorationIntensity: 0.7,
          textureOpacity: 0.16,
          motionDetail: 'subtle',
          graphicVariant: 'dark',
          cardTransition: 'slide',
          currentGlow: 0.72,
          noteColor: '#e9d5ff',
        },
      },
    },
    {
      id: 'sakura_cards',
      label: 'Sakura Cards',
      defaults: {
        accentColor: '#f9a8d4',
        textColor: '#fff1f2',
        secondaryColor: '#fbcfe8',
        frameStyle: 'glass',
        outerRadius: 22,
        innerRadius: 12,
        density: 'compact',
        showHistory: false,
        showThumbnails: true,
        showDuration: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          decorationIntensity: 0.76,
          textureOpacity: 0.18,
          motionDetail: 'subtle',
          graphicVariant: 'sakura',
          cardTransition: 'slide',
          currentGlow: 0.62,
          noteColor: '#be185d',
        },
      },
    },
  ],
  vertical_column: [
    {
      id: 'mint_left',
      label: 'Mint Left',
      defaults: {
        accentColor: '#f8fffb',
        textColor: '#ffffff',
        secondaryColor: '#d8f5e8',
        frameStyle: 'glass',
        outerRadius: 0,
        innerRadius: 4,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: false,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          columnAlign: 'left',
          columnWidth: 34,
          contentInset: 5,
          topOffset: 14,
          rowGap: 7,
          titleBarOpacity: 0.36,
          dividerOpacity: 0.55,
          patternOpacity: 0,
          currentFontSize: 26,
          reserveFontSize: 13,
        },
      },
    },
    {
      id: 'mint_right',
      label: 'Mint Right',
      defaults: {
        accentColor: '#effff7',
        textColor: '#ffffff',
        secondaryColor: '#d6f7e4',
        frameStyle: 'glass',
        outerRadius: 0,
        innerRadius: 4,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          columnAlign: 'right',
          columnWidth: 34,
          contentInset: 5,
          topOffset: 13,
          rowGap: 7,
          titleBarOpacity: 0.34,
          dividerOpacity: 0.58,
          patternOpacity: 0,
          currentFontSize: 25,
          reserveFontSize: 13,
        },
      },
    },
    {
      id: 'mono_vertical',
      label: 'Mono Vertical',
      defaults: {
        accentColor: '#ffffff',
        textColor: '#ffffff',
        secondaryColor: '#d1d5db',
        frameStyle: 'solid',
        outerRadius: 0,
        innerRadius: 0,
        density: 'compact',
        showHistory: false,
        showThumbnails: false,
        showDuration: true,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 900,
        templateOptions: {
          columnAlign: 'center',
          columnWidth: 38,
          contentInset: 8,
          topOffset: 12,
          rowGap: 8,
          titleBarOpacity: 0.52,
          dividerOpacity: 0.42,
          patternOpacity: 0,
          currentFontSize: 25,
          reserveFontSize: 13,
        },
      },
    },
  ],
  spinning_disk_list: [
    {
      id: 'lavender_disks',
      label: 'Lavender Disks',
      defaults: {
        accentColor: '#c4b5fd',
        textColor: '#ffffff',
        secondaryColor: '#ede9fe',
        frameStyle: 'glass',
        outerRadius: 18,
        innerRadius: 12,
        density: 'compact',
        showHistory: true,
        showThumbnails: false,
        showDuration: false,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 900,
        templateOptions: {
          diskSize: 30,
          diskStyle: 'vinyl',
          diskSpinMode: 'current',
          diskSpinSpeed: 4,
          diskBorderWidth: 2,
          rowWidth: 100,
          rowGap: 12,
          rowOpacity: 0.58,
          currentEmphasis: 0.8,
          patternOpacity: 0,
          contentInset: 6,
          currentGlow: 0.72,
        },
      },
    },
    {
      id: 'dark_pills',
      label: 'Dark Pills',
      defaults: {
        accentColor: '#a78bfa',
        textColor: '#ffffff',
        secondaryColor: '#c4b5fd',
        frameStyle: 'solid',
        outerRadius: 14,
        innerRadius: 14,
        density: 'compact',
        showHistory: true,
        showThumbnails: false,
        showDuration: true,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 4,
        autoScrollPauseMs: 900,
        templateOptions: {
          diskSize: 28,
          diskStyle: 'ring',
          diskSpinMode: 'current',
          diskSpinSpeed: 5,
          diskBorderWidth: 2,
          rowWidth: 100,
          rowGap: 10,
          rowOpacity: 0.7,
          currentEmphasis: 0.95,
          patternOpacity: 0,
          contentInset: 6,
          currentGlow: 0.84,
        },
      },
    },
    {
      id: 'clean_dots',
      label: 'Clean Dots',
      defaults: {
        accentColor: '#f8fafc',
        textColor: '#ffffff',
        secondaryColor: '#d1d5db',
        frameStyle: 'glass',
        outerRadius: 48,
        innerRadius: 32,
        density: 'compact',
        showHistory: true,
        showThumbnails: false,
        showDuration: false,
        showNumbering: false,
        autoScroll: true,
        autoScrollSpeed: 3,
        autoScrollPauseMs: 1000,
        templateOptions: {
          diskSize: 24,
          diskStyle: 'dot',
          diskSpinMode: 'off',
          diskSpinSpeed: 3,
          diskBorderWidth: 2,
          rowWidth: 100,
          rowGap: 11,
          rowOpacity: 0.42,
          currentEmphasis: 0.65,
          patternOpacity: 0,
          contentInset: 7,
          currentGlow: 0.5,
        },
      },
    },
  ],
};

const SETLIST_TEMPLATE_IDS = Object.keys(SETLIST_TEMPLATE_LABELS) as SetlistTemplateId[];

const normalizeSetlistTemplateId = (value: unknown): SetlistTemplateId => {
  return SETLIST_TEMPLATE_IDS.includes(value as SetlistTemplateId)
    ? value as SetlistTemplateId
    : 'classic_list';
};

export const getDefaultSetlistPresetId = (templateId: SetlistTemplateId) => {
  return SETLIST_TEMPLATE_PRESETS[templateId][0]?.id ?? 'default';
};

export const getSetlistTemplatePreset = (templateId: SetlistTemplateId, presetId?: string | null) => {
  const presets = SETLIST_TEMPLATE_PRESETS[templateId];
  return presets.find((preset) => preset.id === presetId)
    ?? presets[0];
};

export const getSetlistPresetLabel = (templateId: SetlistTemplateId, presetId?: string | null) => {
  return getSetlistTemplatePreset(templateId, presetId)?.label ?? '';
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
};

const normalizeLyricsLineMode = (value: unknown): LyricsLineMode => {
  return value === 'fill' ? 'fill' : 'count';
};

const legacyLineCount = (value: unknown) => {
  if (value === 'single') return 1;
  if (value === 'context3') return 3;
  if (value === 'fill') return 5;
  return 5;
};

const normalizeLyricsAnimation = (value: unknown, fallback: LyricsAnimation = 'scroll'): LyricsAnimation => {
  return ['none', 'scroll', 'fade', 'slide', 'scale'].includes(String(value))
    ? value as LyricsAnimation
    : fallback;
};

const normalizeFrameStyle = (value: unknown, fallback: SetlistFrameStyle): SetlistFrameStyle => {
  return ['solid', 'glass', 'neon'].includes(String(value))
    ? value as SetlistFrameStyle
    : fallback;
};

const normalizeSetlistScrollSpeed = (value: unknown, fallback: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric <= 10) return clamp(numeric, 1, 10, fallback);
  // Legacy configs stored raw pixels-per-second in a 4-80 range.
  return Math.round(Math.max(1, Math.min(10, 1 + ((numeric - 4) / 76) * 9)));
};

const DEFAULT_SETLIST_TEMPLATE_OPTIONS: SetlistTemplateOptions = {
  columnAlign: 'left',
  columnWidth: 34,
  topOffset: 14,
  rowGap: 8,
  titleBarOpacity: 0.36,
  dividerOpacity: 0.5,
  patternOpacity: 0.14,
  currentFontSize: 26,
  reserveFontSize: 13,
  diskSize: 28,
  diskStyle: 'vinyl',
  diskSpinMode: 'current',
  diskSpinSpeed: 4,
  diskBorderWidth: 2,
  rowWidth: 34,
  rowOpacity: 0.6,
  currentEmphasis: 0.8,
  decorationIntensity: 0.5,
  textureOpacity: 0.2,
  motionDetail: 'subtle',
  graphicVariant: 'default',
  tickerSpeed: 4,
  textEffect: 'normal',
  lightAnimation: 'breathe',
  lightPalette: 'accent',
  contentInset: 8,
  cardTransition: 'slide',
  currentGlow: 0.72,
  cassetteDepth: 0.68,
  tickerSource: 'upcoming',
  footerLabel: 'Set List',
  noteColor: '#f8fafc',
};

const normalizeSetlistTemplateOptions = (
  incoming: Partial<SetlistTemplateOptions> | null | undefined,
  fallback: SetlistTemplateOptions = DEFAULT_SETLIST_TEMPLATE_OPTIONS
): SetlistTemplateOptions => ({
  columnAlign: ['left', 'center', 'right'].includes(String(incoming?.columnAlign))
    ? incoming?.columnAlign as SetlistColumnAlign
    : fallback.columnAlign,
  columnWidth: clamp(incoming?.columnWidth, 18, 80, fallback.columnWidth),
  topOffset: clamp(incoming?.topOffset, 0, 70, fallback.topOffset),
  rowGap: clamp(incoming?.rowGap, 0, 28, fallback.rowGap),
  titleBarOpacity: clamp(incoming?.titleBarOpacity, 0, 1, fallback.titleBarOpacity),
  dividerOpacity: clamp(incoming?.dividerOpacity, 0, 1, fallback.dividerOpacity),
  patternOpacity: clamp(incoming?.patternOpacity, 0, 0.45, fallback.patternOpacity),
  currentFontSize: clamp(incoming?.currentFontSize, 14, 54, fallback.currentFontSize),
  reserveFontSize: clamp(incoming?.reserveFontSize, 9, 28, fallback.reserveFontSize),
  diskSize: clamp(incoming?.diskSize, 16, 64, fallback.diskSize),
  diskStyle: ['vinyl', 'ring', 'dot', 'thumbnail'].includes(String(incoming?.diskStyle))
    ? incoming?.diskStyle as SetlistDiskStyle
    : fallback.diskStyle,
  diskSpinMode: ['off', 'current', 'all'].includes(String(incoming?.diskSpinMode))
    ? incoming?.diskSpinMode as SetlistDiskSpinMode
    : fallback.diskSpinMode,
  diskSpinSpeed: clamp(incoming?.diskSpinSpeed, 1, 10, fallback.diskSpinSpeed),
  diskBorderWidth: clamp(incoming?.diskBorderWidth, 0, 8, fallback.diskBorderWidth),
  rowWidth: clamp(incoming?.rowWidth, 18, 100, fallback.rowWidth),
  rowOpacity: clamp(incoming?.rowOpacity, 0.1, 1, fallback.rowOpacity),
  currentEmphasis: clamp(incoming?.currentEmphasis, 0, 1, fallback.currentEmphasis),
  decorationIntensity: clamp(incoming?.decorationIntensity, 0, 1, fallback.decorationIntensity),
  textureOpacity: clamp(incoming?.textureOpacity, 0, 1, fallback.textureOpacity),
  motionDetail: ['off', 'subtle', 'full'].includes(String(incoming?.motionDetail))
    ? incoming?.motionDetail as SetlistMotionDetail
    : fallback.motionDetail,
  graphicVariant: String(incoming?.graphicVariant || fallback.graphicVariant || 'default'),
  tickerSpeed: clamp(incoming?.tickerSpeed, 1, 10, fallback.tickerSpeed),
  textEffect: ['normal', 'lcd', 'pixel'].includes(String(incoming?.textEffect))
    ? incoming?.textEffect as SetlistTextEffect
    : fallback.textEffect,
  lightAnimation: ['off', 'breathe', 'flash', 'chase', 'rainbow'].includes(String(incoming?.lightAnimation))
    ? incoming?.lightAnimation as SetlistLightAnimation
    : fallback.lightAnimation,
  lightPalette: ['accent', 'warm', 'cool', 'rainbow'].includes(String(incoming?.lightPalette))
    ? incoming?.lightPalette as SetlistLightPalette
    : fallback.lightPalette,
  contentInset: clamp(incoming?.contentInset, 0, 28, fallback.contentInset),
  cardTransition: ['none', 'slide'].includes(String(incoming?.cardTransition))
    ? incoming?.cardTransition as SetlistCardTransition
    : fallback.cardTransition,
  currentGlow: clamp(incoming?.currentGlow, 0, 1, fallback.currentGlow),
  cassetteDepth: clamp(incoming?.cassetteDepth, 0, 1, fallback.cassetteDepth),
  tickerSource: ['upcoming', 'history'].includes(String(incoming?.tickerSource))
    ? incoming?.tickerSource as SetlistTickerSource
    : fallback.tickerSource,
  footerLabel: String(incoming?.footerLabel || fallback.footerLabel || 'Set List'),
  noteColor: String(incoming?.noteColor || fallback.noteColor || '#f8fafc'),
});

const radiiFromLegacyShape = (shape: unknown, templateId: SetlistTemplateId) => {
  if (shape === 'square') return { outerRadius: 0, innerRadius: 0 };
  if (shape === 'plate') return { outerRadius: 10, innerRadius: 8 };
  if (shape === 'disk') return { outerRadius: 24, innerRadius: 18 };
  if (shape === 'rounded') return { outerRadius: 20, innerRadius: 10 };
  return templateId === 'record_card'
    ? { outerRadius: 22, innerRadius: 18 }
    : { outerRadius: 20, innerRadius: 10 };
};

export function createDefaultLyricsConfig(legacy?: LegacyLyricStyleLike | null): LyricsOverlayTemplateConfig {
  const baseSize = Number(legacy?.fontSize ?? 36);
  return {
    fontFamily: DEFAULT_OVERLAY_FONT,
    lineMode: 'count',
    lineCount: 5,
    activeFontSize: baseSize,
    inactiveFontSize: Math.max(20, Math.round(baseSize * 0.78)),
    lineGap: 18,
    letterSpacing: 0,
    activeColor: legacy?.activeColor ?? '#ff4444',
    inactiveColor: legacy?.inactiveColor ?? '#f2f2f2',
    passedColor: '#666666',
    strokeColor: legacy?.strokeColor ?? '#000000',
    strokeWidth: Number(legacy?.strokeWidth ?? 0),
    glowColor: legacy?.activeGlowColor ?? 'rgba(255, 68, 68, 0.45)',
    glowStrength: 0.45,
    animation: 'scroll',
    animationDurationMs: 260,
    animationIntensity: 0.5,
    furiganaPolicy: 'follow_app',
    romajiPolicy: 'follow_app',
    romajiLetterSpacing: 0,
    romajiMarginTop: 5,
  };
}

export function createDefaultSetlistConfig(
  requestedTemplateId: SetlistTemplateId = 'classic_list',
  requestedPresetId?: string | null
): SetlistOverlayTemplateConfig {
  const templateId = normalizeSetlistTemplateId(requestedTemplateId);
  const base: SetlistOverlayTemplateConfig = {
    templateId,
    presetId: getDefaultSetlistPresetId(templateId),
    fontFamily: DEFAULT_OVERLAY_FONT,
    accentColor: '#00e5ff',
    textColor: '#ffffff',
    secondaryColor: '#b8c7d9',
    showCurrent: true,
    showUpcoming: true,
    showHistory: true,
    showCounts: true,
    currentLabel: 'NOW SINGING',
    upcomingLabel: 'RESERVE',
    historyLabel: 'SET LIST',
    showArtist: true,
    showNumbering: true,
    showThumbnails: false,
    showDuration: false,
    density: 'comfortable',
    frameStyle: 'neon',
    outerRadius: 20,
    innerRadius: 10,
    overallOpacity: 0.38,
    autoScroll: true,
    autoScrollSpeed: 4,
    autoScrollPauseMs: 1200,
    changeAnimation: 'fade',
    emptyState: 'waiting',
    waitingText: '等待下一首',
    showWaitingSongTitle: true,
    gridColumns: 4,
    templateOptions: DEFAULT_SETLIST_TEMPLATE_OPTIONS,
  };

  const templateDefaults: SetlistPresetDefaults = {};
  if (templateId === 'record_card') {
    Object.assign(templateDefaults, {
      showHistory: true,
      showThumbnails: true,
      density: 'compact',
      frameStyle: 'glass',
      overallOpacity: 0.52,
      outerRadius: 22,
      innerRadius: 18,
      autoScroll: false,
      autoScrollSpeed: 3,
      autoScrollPauseMs: 1000,
      currentLabel: 'NOW PLAYING',
      upcomingLabel: 'UP NEXT',
    });
  } else if (templateId === 'compact_strip') {
    Object.assign(templateDefaults, {
      showHistory: true,
      showNumbering: false,
      showThumbnails: false,
      showDuration: false,
      density: 'compact',
      frameStyle: 'glass',
      overallOpacity: 0.52,
      outerRadius: 14,
      innerRadius: 10,
      currentLabel: 'NOW',
      upcomingLabel: 'UP NEXT',
      historyLabel: 'HISTORY',
      autoScrollSpeed: 4,
      autoScrollPauseMs: 900,
    });
  } else if (templateId === 'neon_signboard') {
    Object.assign(templateDefaults, {
      frameStyle: 'neon',
      overallOpacity: 0.38,
      outerRadius: 24,
      innerRadius: 12,
      currentLabel: '歌唱中',
      upcomingLabel: '下一首',
      historyLabel: '已唱',
      autoScrollSpeed: 4,
      autoScrollPauseMs: 1200,
    });
  } else if (templateId === 'countdown_counter') {
    Object.assign(templateDefaults, {
      showHistory: false,
      showNumbering: false,
      showThumbnails: false,
      showDuration: false,
      currentLabel: 'NOW SINGING',
      upcomingLabel: 'REMAINING',
      historyLabel: 'FINISHED',
      frameStyle: 'solid',
      overallOpacity: 0.86,
      autoScrollSpeed: 3,
      autoScrollPauseMs: 1400,
    });
  } else if (templateId === 'index_grid') {
    Object.assign(templateDefaults, {
      showCurrent: true,
      showUpcoming: true,
      showHistory: false,
      showNumbering: true,
      showThumbnails: false,
      showDuration: false,
      density: 'compact',
      frameStyle: 'glass',
      overallOpacity: 0.52,
      outerRadius: 14,
      innerRadius: 8,
      currentLabel: 'NOW SINGING',
      upcomingLabel: 'SET LIST',
      historyLabel: 'HISTORY',
      autoScroll: true,
      gridColumns: 4,
    });
  } else if (templateId === 'pager_console') {
    Object.assign(templateDefaults, {
      showHistory: false,
      showThumbnails: false,
      showDuration: false,
      density: 'compact',
      frameStyle: 'solid',
      overallOpacity: 1,
      outerRadius: 30,
      innerRadius: 14,
      currentLabel: 'ON AIR',
      upcomingLabel: 'QUEUE',
      autoScroll: true,
      autoScrollSpeed: 4,
      autoScrollPauseMs: 900,
      templateOptions: {
        decorationIntensity: 0.8,
        textureOpacity: 0.28,
        motionDetail: 'subtle',
        graphicVariant: 'lime',
        tickerSpeed: 4,
        textEffect: 'lcd',
        tickerSource: 'upcoming',
        footerLabel: 'Set List',
      },
    });
  } else if (templateId === 'cassette_deck') {
    Object.assign(templateDefaults, {
      showHistory: false,
      showThumbnails: true,
      showDuration: true,
      density: 'compact',
      frameStyle: 'glass',
      overallOpacity: 0.9,
      outerRadius: 26,
      innerRadius: 16,
      currentLabel: 'NOW PLAYING',
      upcomingLabel: 'TRACKS',
      autoScroll: true,
      autoScrollSpeed: 3,
      autoScrollPauseMs: 1000,
      templateOptions: {
        decorationIntensity: 0.74,
        textureOpacity: 0.18,
        motionDetail: 'subtle',
        graphicVariant: 'city',
        cassetteDepth: 0.72,
        diskSpinMode: 'current',
        diskSpinSpeed: 4,
      },
    });
  } else if (templateId === 'stage_marquee') {
    Object.assign(templateDefaults, {
      showHistory: true,
      showThumbnails: false,
      showDuration: false,
      density: 'comfortable',
      frameStyle: 'neon',
      overallOpacity: 0.38,
      outerRadius: 20,
      innerRadius: 10,
      currentLabel: 'NOW SINGING',
      upcomingLabel: 'UP NEXT',
      historyLabel: 'SET LIST',
      autoScroll: true,
      autoScrollSpeed: 4,
      autoScrollPauseMs: 1200,
      templateOptions: {
        decorationIntensity: 0.85,
        textureOpacity: 0.18,
        motionDetail: 'full',
        graphicVariant: 'gold',
        lightAnimation: 'chase',
        lightPalette: 'warm',
        tickerSpeed: 5,
      },
    });
  } else if (templateId === 'photo_stack') {
    Object.assign(templateDefaults, {
      showHistory: false,
      showThumbnails: true,
      showDuration: true,
      density: 'compact',
      frameStyle: 'glass',
      overallOpacity: 0.9,
      outerRadius: 18,
      innerRadius: 8,
      currentLabel: 'NOW',
      upcomingLabel: 'REQUESTS',
      autoScroll: true,
      autoScrollSpeed: 3,
      autoScrollPauseMs: 1000,
      templateOptions: {
        decorationIntensity: 0.6,
        textureOpacity: 0.16,
        motionDetail: 'subtle',
        graphicVariant: 'white',
        cardTransition: 'slide',
        currentGlow: 0.5,
        noteColor: '#334155',
      },
    });
  } else if (templateId === 'vertical_column') {
    Object.assign(templateDefaults, {
      showHistory: false,
      showNumbering: false,
      showThumbnails: false,
      showDuration: false,
      density: 'compact',
      frameStyle: 'glass',
      overallOpacity: 0,
      outerRadius: 0,
      innerRadius: 4,
      currentLabel: 'NOW',
      upcomingLabel: 'SET LIST',
      historyLabel: 'HISTORY',
      autoScroll: true,
      autoScrollSpeed: 3,
      autoScrollPauseMs: 1000,
      templateOptions: {
        columnAlign: 'left',
        columnWidth: 34,
        contentInset: 5,
        topOffset: 14,
        rowGap: 7,
        titleBarOpacity: 0.36,
        dividerOpacity: 0.55,
        patternOpacity: 0,
        currentFontSize: 26,
        reserveFontSize: 13,
      },
    });
  } else if (templateId === 'spinning_disk_list') {
    Object.assign(templateDefaults, {
      showHistory: true,
      showNumbering: false,
      showThumbnails: false,
      showDuration: false,
      density: 'compact',
      frameStyle: 'glass',
      overallOpacity: 0.6,
      outerRadius: 18,
      innerRadius: 12,
      currentLabel: 'NOW',
      upcomingLabel: 'RESERVE',
      historyLabel: 'HISTORY',
      autoScroll: true,
      autoScrollSpeed: 4,
      autoScrollPauseMs: 900,
      templateOptions: {
        diskSize: 28,
        diskStyle: 'vinyl',
        diskSpinMode: 'current',
        diskSpinSpeed: 4,
        diskBorderWidth: 2,
        rowWidth: 100,
        rowGap: 12,
        rowOpacity: 0.6,
        currentEmphasis: 0.8,
        patternOpacity: 0,
        contentInset: 6,
        currentGlow: 0.72,
      },
    });
  }

  const preset = getSetlistTemplatePreset(templateId, requestedPresetId);
  const { templateOptions: templateDefaultOptions, ...plainTemplateDefaults } = templateDefaults;
  const { templateOptions: presetOptions, ...plainPresetDefaults } = preset.defaults;
  return {
    ...base,
    ...plainTemplateDefaults,
    ...plainPresetDefaults,
    templateId,
    presetId: preset.id,
    templateOptions: normalizeSetlistTemplateOptions(
      {
        ...base.templateOptions,
        ...templateDefaultOptions,
        ...presetOptions,
      },
      base.templateOptions
    ),
  };
}

export function createDefaultLyricsDesign(legacy?: LegacyLyricStyleLike | null): LyricsOverlayDesign {
  return {
    id: DEFAULT_OVERLAY_DESIGN_ID,
    name: '預設歌詞',
    config: createDefaultLyricsConfig(legacy),
  };
}

export function createDefaultSetlistDesign(): SetlistOverlayDesign {
  return {
    id: DEFAULT_OVERLAY_DESIGN_ID,
    name: '預設歌單',
    config: createDefaultSetlistConfig('classic_list'),
  };
}

export function createLyricsDesign(id: string, name: string, base?: LyricsOverlayDesign): LyricsOverlayDesign {
  const source = base ?? createDefaultLyricsDesign();
  return {
    id,
    name,
    config: { ...source.config },
  };
}

export function createSetlistDesign(id: string, name: string, base?: SetlistOverlayDesign): SetlistOverlayDesign {
  const source = base ?? createDefaultSetlistDesign();
  return {
    id,
    name,
    config: { ...source.config },
  };
}

function migrateCombinedToLyricsDesign(design: LegacyCombinedDesign, index: number, legacy?: LegacyLyricStyleLike | null): LyricsOverlayDesign {
  const defaults = createDefaultLyricsConfig(legacy);
  const lyrics = design.lyrics ?? {};
  const {
    templateId: _templateId,
    verticalAnchor: _verticalAnchor,
    horizontalAlign: _horizontalAlign,
    safePadding: _safePadding,
    offsetX: _offsetX,
    offsetY: _offsetY,
    ...lyricsConfig
  } = lyrics;
  const shared = design.shared ?? {};
  return {
    id: design.id || (index === 0 ? DEFAULT_OVERLAY_DESIGN_ID : `lyrics-${index + 1}`),
    name: design.name || (index === 0 ? '預設歌詞' : `歌詞設計 ${index + 1}`),
    config: {
      ...defaults,
      ...lyricsConfig,
      fontFamily: lyricsConfig.fontFamily || shared.fontFamily || defaults.fontFamily,
      lineMode: normalizeLyricsLineMode(lyrics.lineMode),
      lineCount: clamp((lyricsConfig as any).lineCount, 1, 15, legacyLineCount(lyrics.lineMode)),
      activeFontSize: clamp(lyricsConfig.activeFontSize, 20, 96, defaults.activeFontSize),
      inactiveFontSize: clamp(lyricsConfig.inactiveFontSize, 16, 72, defaults.inactiveFontSize),
      lineGap: clamp(lyricsConfig.lineGap, 0, 80, defaults.lineGap),
      letterSpacing: clamp((lyricsConfig as any).letterSpacing, 0, 16, 0),
      animation: normalizeLyricsAnimation(lyricsConfig.animation, defaults.animation),
      furiganaPolicy: (['follow_app', 'show', 'hide'].includes(String(lyricsConfig.furiganaPolicy)) ? lyricsConfig.furiganaPolicy : defaults.furiganaPolicy) as LyricsRubyPolicy,
      romajiPolicy: (['follow_app', 'show', 'hide'].includes(String(lyricsConfig.romajiPolicy)) ? lyricsConfig.romajiPolicy : defaults.romajiPolicy) as LyricsRubyPolicy,
      romajiLetterSpacing: clamp((lyricsConfig as any).romajiLetterSpacing, 0, 16, defaults.romajiLetterSpacing),
      romajiMarginTop: clamp((lyricsConfig as any).romajiMarginTop, -20, 40, defaults.romajiMarginTop),
    },
  };
}

function migrateCombinedToSetlistDesign(design: LegacyCombinedDesign, index: number): SetlistOverlayDesign {
  const incoming = design.setlist ?? {};
  const {
    maxUpcoming: _maxUpcoming,
    maxHistory: _maxHistory,
    sectionOrder: _sectionOrder,
    horizontalAlign: _horizontalAlign,
    ...setlistConfig
  } = incoming;
  const templateId = normalizeSetlistTemplateId(incoming.templateId);
  const preset = getSetlistTemplatePreset(templateId, (incoming as any).presetId);
  const defaults = createDefaultSetlistConfig(templateId, preset.id);
  const shared = design.shared ?? {};
  const legacyRadii = radiiFromLegacyShape(incoming.shapeStyle, templateId);
  return {
    id: design.id || (index === 0 ? DEFAULT_OVERLAY_DESIGN_ID : `setlist-${index + 1}`),
    name: design.name || (index === 0 ? '預設歌單' : `歌單設計 ${index + 1}`),
    config: {
      ...defaults,
      ...setlistConfig,
      templateId,
      presetId: preset.id,
      fontFamily: setlistConfig.fontFamily || shared.fontFamily || defaults.fontFamily,
      accentColor: setlistConfig.accentColor || shared.accentColor || defaults.accentColor,
      textColor: setlistConfig.textColor || shared.textColor || defaults.textColor,
      secondaryColor: setlistConfig.secondaryColor || shared.secondaryColor || defaults.secondaryColor,
      frameStyle: normalizeFrameStyle(setlistConfig.frameStyle, defaults.frameStyle),
      outerRadius: clamp((setlistConfig as any).outerRadius, 0, 48, legacyRadii.outerRadius),
      innerRadius: clamp((setlistConfig as any).innerRadius, 0, 32, legacyRadii.innerRadius),
      overallOpacity: clamp((setlistConfig as any).overallOpacity, 0, 1, defaults.overallOpacity),
      showDuration: Boolean((setlistConfig as any).showDuration ?? defaults.showDuration),
      autoScrollSpeed: normalizeSetlistScrollSpeed((setlistConfig as any).autoScrollSpeed, defaults.autoScrollSpeed),
      changeAnimation: (['none', 'fade', 'slide'].includes(String(setlistConfig.changeAnimation)) ? setlistConfig.changeAnimation : defaults.changeAnimation) as SetlistChangeAnimation,
      autoScrollPauseMs: clamp((setlistConfig as any).autoScrollPauseMs, 0, 5000, defaults.autoScrollPauseMs),
      waitingText: String((setlistConfig as any).waitingText || defaults.waitingText),
      showWaitingSongTitle: Boolean((setlistConfig as any).showWaitingSongTitle ?? defaults.showWaitingSongTitle),
      gridColumns: clamp((setlistConfig as any).gridColumns, 2, 6, defaults.gridColumns),
      templateOptions: normalizeSetlistTemplateOptions((setlistConfig as any).templateOptions, defaults.templateOptions),
    },
  };
}

function mergeLyricsDesign(design: Partial<LyricsOverlayDesign> | null | undefined, index: number, legacy?: LegacyLyricStyleLike | null): LyricsOverlayDesign {
  const defaults = createDefaultLyricsDesign(legacy);
  const config: Partial<LyricsOverlayTemplateConfig> = design?.config ?? {};
  return {
    id: design?.id || (index === 0 ? DEFAULT_OVERLAY_DESIGN_ID : `lyrics-${index + 1}`),
    name: design?.name || (index === 0 ? '預設歌詞' : `歌詞設計 ${index + 1}`),
    config: {
      ...defaults.config,
      ...config,
      lineMode: normalizeLyricsLineMode(config.lineMode),
      lineCount: clamp(config.lineCount, 1, 15, defaults.config.lineCount),
      activeFontSize: clamp(config.activeFontSize, 20, 96, defaults.config.activeFontSize),
      inactiveFontSize: clamp(config.inactiveFontSize, 16, 72, defaults.config.inactiveFontSize),
      lineGap: clamp(config.lineGap, 0, 80, defaults.config.lineGap),
      letterSpacing: clamp(config.letterSpacing, 0, 16, defaults.config.letterSpacing),
      strokeWidth: clamp(config.strokeWidth, 0, 8, defaults.config.strokeWidth),
      glowStrength: clamp(config.glowStrength, 0, 1, defaults.config.glowStrength),
      animation: normalizeLyricsAnimation(config.animation, defaults.config.animation),
      animationDurationMs: clamp(config.animationDurationMs, 80, 1200, defaults.config.animationDurationMs),
      animationIntensity: clamp(config.animationIntensity, 0, 1, defaults.config.animationIntensity),
      romajiLetterSpacing: clamp(config.romajiLetterSpacing, 0, 16, defaults.config.romajiLetterSpacing),
      romajiMarginTop: clamp(config.romajiMarginTop, -20, 40, defaults.config.romajiMarginTop),
    },
  };
}

function mergeSetlistDesign(design: Partial<SetlistOverlayDesign> | null | undefined, index: number): SetlistOverlayDesign {
  const templateId = normalizeSetlistTemplateId(design?.config?.templateId);
  const preset = getSetlistTemplatePreset(templateId, (design?.config as any)?.presetId);
  const configDefaults = createDefaultSetlistConfig(templateId, preset.id);
  const config: Partial<SetlistOverlayTemplateConfig> = design?.config ?? {};
  const legacyRadii = radiiFromLegacyShape((config as any).shapeStyle, templateId);
  return {
    id: design?.id || (index === 0 ? DEFAULT_OVERLAY_DESIGN_ID : `setlist-${index + 1}`),
    name: design?.name || (index === 0 ? '預設歌單' : `歌單設計 ${index + 1}`),
    config: {
      ...configDefaults,
      ...config,
      templateId,
      presetId: preset.id,
      frameStyle: normalizeFrameStyle(config.frameStyle, configDefaults.frameStyle),
      showDuration: Boolean(config.showDuration ?? configDefaults.showDuration),
      outerRadius: clamp(config.outerRadius, 0, 48, legacyRadii.outerRadius),
      innerRadius: clamp(config.innerRadius, 0, 32, legacyRadii.innerRadius),
      overallOpacity: clamp(config.overallOpacity, 0, 1, configDefaults.overallOpacity),
      autoScrollSpeed: normalizeSetlistScrollSpeed(config.autoScrollSpeed, configDefaults.autoScrollSpeed),
      autoScrollPauseMs: clamp(config.autoScrollPauseMs, 0, 5000, configDefaults.autoScrollPauseMs),
      changeAnimation: (['none', 'fade', 'slide'].includes(String(config.changeAnimation)) ? config.changeAnimation : configDefaults.changeAnimation) as SetlistChangeAnimation,
      waitingText: String(config.waitingText || configDefaults.waitingText),
      showWaitingSongTitle: Boolean(config.showWaitingSongTitle ?? configDefaults.showWaitingSongTitle),
      gridColumns: clamp(config.gridColumns, 2, 6, configDefaults.gridColumns),
      templateOptions: normalizeSetlistTemplateOptions((config as any).templateOptions, configDefaults.templateOptions),
    },
  };
}

export function createDefaultOverlayTemplatesConfig(legacy?: LegacyLyricStyleLike | null): OverlayTemplatesConfig {
  return {
    version: 2,
    activeLyricsDesignId: DEFAULT_OVERLAY_DESIGN_ID,
    activeSetlistDesignId: DEFAULT_OVERLAY_DESIGN_ID,
    lyricsDesigns: [createDefaultLyricsDesign(legacy)],
    setlistDesigns: [createDefaultSetlistDesign()],
  };
}

export function mergeOverlayTemplatesConfig(
  config?: any,
  legacy?: LegacyLyricStyleLike | null
): OverlayTemplatesConfig {
  const defaults = createDefaultOverlayTemplatesConfig(legacy);
  const legacyCombined = Array.isArray(config?.designs) ? config.designs as LegacyCombinedDesign[] : null;

  const lyricsDesigns: LyricsOverlayDesign[] = Array.isArray(config?.lyricsDesigns) && config.lyricsDesigns.length
    ? config.lyricsDesigns.map((design: Partial<LyricsOverlayDesign>, index: number) => mergeLyricsDesign(design, index, legacy))
    : legacyCombined?.length
      ? legacyCombined.map((design, index) => migrateCombinedToLyricsDesign(design, index, legacy))
      : defaults.lyricsDesigns;

  const setlistDesigns: SetlistOverlayDesign[] = Array.isArray(config?.setlistDesigns) && config.setlistDesigns.length
    ? config.setlistDesigns.map((design: Partial<SetlistOverlayDesign>, index: number) => mergeSetlistDesign(design, index))
    : legacyCombined?.length
      ? legacyCombined.map((design, index) => migrateCombinedToSetlistDesign(design, index))
      : defaults.setlistDesigns;

  if (!lyricsDesigns.some((design) => design.id === DEFAULT_OVERLAY_DESIGN_ID)) {
    lyricsDesigns.unshift(defaults.lyricsDesigns[0]);
  }

  if (!setlistDesigns.some((design) => design.id === DEFAULT_OVERLAY_DESIGN_ID)) {
    setlistDesigns.unshift(defaults.setlistDesigns[0]);
  }

  const activeLyricsCandidate = config?.activeLyricsDesignId ?? config?.activeDesignId;
  const activeSetlistCandidate = config?.activeSetlistDesignId ?? config?.activeDesignId;

  return {
    version: 2,
    activeLyricsDesignId: lyricsDesigns.some((design) => design.id === activeLyricsCandidate)
      ? String(activeLyricsCandidate)
      : DEFAULT_OVERLAY_DESIGN_ID,
    activeSetlistDesignId: setlistDesigns.some((design) => design.id === activeSetlistCandidate)
      ? String(activeSetlistCandidate)
      : DEFAULT_OVERLAY_DESIGN_ID,
    lyricsDesigns,
    setlistDesigns,
  };
}

export function findLyricsOverlayDesign(config: OverlayTemplatesConfig, designId?: string | null): LyricsOverlayDesign {
  return config.lyricsDesigns.find((design) => design.id === designId)
    ?? config.lyricsDesigns.find((design) => design.id === config.activeLyricsDesignId)
    ?? config.lyricsDesigns[0]
    ?? createDefaultLyricsDesign();
}

export function findSetlistOverlayDesign(config: OverlayTemplatesConfig, designId?: string | null): SetlistOverlayDesign {
  return config.setlistDesigns.find((design) => design.id === designId)
    ?? config.setlistDesigns.find((design) => design.id === config.activeSetlistDesignId)
    ?? config.setlistDesigns[0]
    ?? createDefaultSetlistDesign();
}

export function getLyricsOverlayDesignById(config: OverlayTemplatesConfig, designId?: string | null): LyricsOverlayDesign | undefined {
  if (!designId) return undefined;
  return config.lyricsDesigns.find((design) => design.id === designId);
}

export function getSetlistOverlayDesignById(config: OverlayTemplatesConfig, designId?: string | null): SetlistOverlayDesign | undefined {
  if (!designId) return undefined;
  return config.setlistDesigns.find((design) => design.id === designId);
}

export type OverlayDesignResolution =
  | {
    status: 'ok';
    kind: OverlayKind;
    requestedDesignId?: string;
    designId: string;
    design: LyricsOverlayDesign | SetlistOverlayDesign;
  }
  | {
    status: 'missing';
    kind: OverlayKind;
    requestedDesignId: string;
  };

export function resolveOverlayDesign(
  config: OverlayTemplatesConfig,
  kind: OverlayKind,
  requestedDesignId?: string | null
): OverlayDesignResolution {
  if (requestedDesignId) {
    const design = kind === 'setlist'
      ? getSetlistOverlayDesignById(config, requestedDesignId)
      : getLyricsOverlayDesignById(config, requestedDesignId);

    if (!design) {
      return {
        status: 'missing',
        kind,
        requestedDesignId,
      };
    }

    return {
      status: 'ok',
      kind,
      requestedDesignId,
      designId: design.id,
      design,
    };
  }

  const design = kind === 'setlist'
    ? findSetlistOverlayDesign(config, DEFAULT_OVERLAY_DESIGN_ID)
    : findLyricsOverlayDesign(config, DEFAULT_OVERLAY_DESIGN_ID);

  return {
    status: 'ok',
    kind,
    designId: design.id,
    design,
  };
}
