export type OverlayKind = 'lyrics' | 'setlist';

export type LyricsLineMode = 'count' | 'fill';
export type LyricsAnimation = 'none' | 'scroll' | 'fade' | 'slide' | 'scale';
export type LyricsRubyPolicy = 'follow_app' | 'show' | 'hide';
export type SetlistTemplateId = 'classic_list' | 'record_card';
export type SetlistDensity = 'compact' | 'comfortable';
export type SetlistFrameStyle = 'solid' | 'glass' | 'neon';
export type SetlistEmptyState = 'hide' | 'waiting';
export type SetlistChangeAnimation = 'none' | 'fade' | 'slide';
export type OverlayPlaybackMode = 'normal' | 'repeat_one' | 'random' | 'stream';

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
  autoScroll: boolean;
  autoScrollSpeed: number;
  autoScrollPauseMs: number;
  changeAnimation: SetlistChangeAnimation;
  emptyState: SetlistEmptyState;
  waitingText: string;
  showWaitingSongTitle: boolean;
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

export function createDefaultSetlistConfig(templateId: SetlistTemplateId = 'classic_list'): SetlistOverlayTemplateConfig {
  const base: SetlistOverlayTemplateConfig = {
    templateId,
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
    autoScroll: true,
    autoScrollSpeed: 4,
    autoScrollPauseMs: 1200,
    changeAnimation: 'fade',
    emptyState: 'waiting',
    waitingText: '等待下一首',
    showWaitingSongTitle: true,
  };

  if (templateId === 'record_card') {
    return {
      ...base,
      templateId,
      showHistory: false,
      showThumbnails: true,
      density: 'compact',
      frameStyle: 'glass',
      outerRadius: 22,
      innerRadius: 18,
      autoScroll: false,
      autoScrollSpeed: 3,
      autoScrollPauseMs: 1000,
      currentLabel: 'NOW PLAYING',
      upcomingLabel: 'UP NEXT',
    };
  }

  return base;
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
  const templateId = incoming.templateId === 'record_card' ? 'record_card' : 'classic_list';
  const defaults = createDefaultSetlistConfig(templateId);
  const shared = design.shared ?? {};
  const legacyRadii = radiiFromLegacyShape(incoming.shapeStyle, templateId);
  return {
    id: design.id || (index === 0 ? DEFAULT_OVERLAY_DESIGN_ID : `setlist-${index + 1}`),
    name: design.name || (index === 0 ? '預設歌單' : `歌單設計 ${index + 1}`),
    config: {
      ...defaults,
      ...setlistConfig,
      templateId,
      fontFamily: setlistConfig.fontFamily || shared.fontFamily || defaults.fontFamily,
      accentColor: setlistConfig.accentColor || shared.accentColor || defaults.accentColor,
      textColor: setlistConfig.textColor || shared.textColor || defaults.textColor,
      secondaryColor: setlistConfig.secondaryColor || shared.secondaryColor || defaults.secondaryColor,
      frameStyle: normalizeFrameStyle(setlistConfig.frameStyle, defaults.frameStyle),
      outerRadius: clamp((setlistConfig as any).outerRadius, 0, 48, legacyRadii.outerRadius),
      innerRadius: clamp((setlistConfig as any).innerRadius, 0, 32, legacyRadii.innerRadius),
      showDuration: Boolean((setlistConfig as any).showDuration ?? false),
      autoScrollSpeed: normalizeSetlistScrollSpeed((setlistConfig as any).autoScrollSpeed, defaults.autoScrollSpeed),
      changeAnimation: (['none', 'fade', 'slide'].includes(String(setlistConfig.changeAnimation)) ? setlistConfig.changeAnimation : defaults.changeAnimation) as SetlistChangeAnimation,
      autoScrollPauseMs: clamp((setlistConfig as any).autoScrollPauseMs, 0, 5000, defaults.autoScrollPauseMs),
      waitingText: String((setlistConfig as any).waitingText || defaults.waitingText),
      showWaitingSongTitle: Boolean((setlistConfig as any).showWaitingSongTitle ?? defaults.showWaitingSongTitle),
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
  const templateId = design?.config?.templateId === 'record_card' ? 'record_card' : 'classic_list';
  const configDefaults = createDefaultSetlistConfig(templateId);
  const config: Partial<SetlistOverlayTemplateConfig> = design?.config ?? {};
  const legacyRadii = radiiFromLegacyShape((config as any).shapeStyle, templateId);
  return {
    id: design?.id || (index === 0 ? DEFAULT_OVERLAY_DESIGN_ID : `setlist-${index + 1}`),
    name: design?.name || (index === 0 ? '預設歌單' : `歌單設計 ${index + 1}`),
    config: {
      ...configDefaults,
      ...config,
      templateId,
      frameStyle: normalizeFrameStyle(config.frameStyle, configDefaults.frameStyle),
      showDuration: Boolean(config.showDuration ?? false),
      outerRadius: clamp(config.outerRadius, 0, 48, legacyRadii.outerRadius),
      innerRadius: clamp(config.innerRadius, 0, 32, legacyRadii.innerRadius),
      autoScrollSpeed: normalizeSetlistScrollSpeed(config.autoScrollSpeed, configDefaults.autoScrollSpeed),
      autoScrollPauseMs: clamp(config.autoScrollPauseMs, 0, 5000, configDefaults.autoScrollPauseMs),
      changeAnimation: (['none', 'fade', 'slide'].includes(String(config.changeAnimation)) ? config.changeAnimation : configDefaults.changeAnimation) as SetlistChangeAnimation,
      waitingText: String(config.waitingText || configDefaults.waitingText),
      showWaitingSongTitle: Boolean(config.showWaitingSongTitle ?? configDefaults.showWaitingSongTitle),
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
