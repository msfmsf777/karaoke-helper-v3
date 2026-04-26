export type HotkeyAction =
  | 'playPause'
  | 'nextTrack'
  | 'previousTrack'
  | 'toggleMiniPlayer'
  | 'focusSearch'
  | 'toggleStreamMode'
  | 'instrumentalVolumeUp'
  | 'instrumentalVolumeDown'
  | 'vocalVolumeUp'
  | 'vocalVolumeDown';

export type HotkeyGroup = 'playback' | 'custom';

export interface HotkeyBinding {
  local: string;
  global: string;
}

export type HotkeyBindings = Record<HotkeyAction, HotkeyBinding>;

export interface HotkeyConfig {
  globalHotkeysEnabled: boolean;
  bindings: HotkeyBindings;
}

export interface HotkeyRegistrationStatus {
  globalHotkeysEnabled: boolean;
  registered: Partial<Record<HotkeyAction, boolean>>;
  failed: Partial<Record<HotkeyAction, string>>;
}

export interface HotkeyActionDefinition {
  action: HotkeyAction;
  group: HotkeyGroup;
  label: string;
  description: string;
}

export const HOTKEY_ACTIONS: HotkeyActionDefinition[] = [
  { action: 'playPause', group: 'playback', label: '播放 / 暫停', description: '切換目前歌曲播放狀態' },
  { action: 'nextTrack', group: 'playback', label: '下一首', description: '播放佇列中的下一首' },
  { action: 'previousTrack', group: 'playback', label: '上一首', description: '播放佇列中的上一首' },
  { action: 'toggleMiniPlayer', group: 'custom', label: '迷你播放器', description: '顯示或隱藏迷你播放器' },
  { action: 'focusSearch', group: 'custom', label: '搜尋', description: '聚焦上方搜尋欄' },
  { action: 'toggleStreamMode', group: 'custom', label: '直播模式', description: '進入或離開直播模式' },
  { action: 'instrumentalVolumeUp', group: 'custom', label: '伴奏音量 +', description: '提高伴奏音量 5%' },
  { action: 'instrumentalVolumeDown', group: 'custom', label: '伴奏音量 -', description: '降低伴奏音量 5%' },
  { action: 'vocalVolumeUp', group: 'custom', label: '人聲音量 +', description: '提高人聲音量 5%' },
  { action: 'vocalVolumeDown', group: 'custom', label: '人聲音量 -', description: '降低人聲音量 5%' },
];

export const DEFAULT_HOTKEY_CONFIG: HotkeyConfig = {
  globalHotkeysEnabled: false,
  bindings: {
    playPause: { local: 'Space', global: 'MediaPlayPause' },
    nextTrack: { local: 'Ctrl+Right', global: 'MediaNextTrack' },
    previousTrack: { local: 'Ctrl+Left', global: 'MediaPreviousTrack' },
    toggleMiniPlayer: { local: '', global: '' },
    focusSearch: { local: '', global: '' },
    toggleStreamMode: { local: '', global: '' },
    instrumentalVolumeUp: { local: '', global: '' },
    instrumentalVolumeDown: { local: '', global: '' },
    vocalVolumeUp: { local: '', global: '' },
    vocalVolumeDown: { local: '', global: '' },
  },
};

const ACTION_SET = new Set<HotkeyAction>(HOTKEY_ACTIONS.map((item) => item.action));
const MEDIA_ACCELERATORS = new Set(['MediaPlayPause', 'MediaNextTrack', 'MediaPreviousTrack', 'MediaStop']);

const KEY_ALIASES: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Escape: 'Esc',
  Esc: 'Esc',
  Delete: 'Delete',
  Backspace: 'Backspace',
  Enter: 'Enter',
  Tab: 'Tab',
};

const PART_ALIASES: Record<string, string> = {
  Control: 'Ctrl',
  Cmd: 'Command',
  CommandOrControl: 'Ctrl',
  Option: 'Alt',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  Spacebar: 'Space',
  Esc: 'Esc',
};

function cleanKey(key: string) {
  const aliased = KEY_ALIASES[key] || key;
  if (aliased.length === 1) return aliased.toUpperCase();
  return aliased;
}

export function normalizeAccelerator(accelerator: string): string {
  const rawParts = accelerator
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawParts.length === 0) return '';

  const normalizedParts = rawParts.map((part) => PART_ALIASES[part] || part);
  const key = normalizedParts[normalizedParts.length - 1];
  const modifiers = normalizedParts.slice(0, -1);
  const orderedModifiers = ['Ctrl', 'Shift', 'Alt', 'Meta', 'Command'].filter((mod) => modifiers.includes(mod));
  return [...orderedModifiers, cleanKey(key)].join('+');
}

export function isMediaAccelerator(accelerator: string): boolean {
  return MEDIA_ACCELERATORS.has(normalizeAccelerator(accelerator));
}

export function isPlainGlobalAccelerator(accelerator: string): boolean {
  const normalized = normalizeAccelerator(accelerator);
  if (!normalized || isMediaAccelerator(normalized)) return false;
  return !normalized.includes('+');
}

export function mergeHotkeyConfig(config?: Partial<HotkeyConfig> | null): HotkeyConfig {
  const bindings = { ...DEFAULT_HOTKEY_CONFIG.bindings };
  const incomingBindings = (config?.bindings || {}) as Partial<HotkeyBindings>;

  for (const [action, binding] of Object.entries(incomingBindings)) {
    if (!ACTION_SET.has(action as HotkeyAction)) continue;
    bindings[action as HotkeyAction] = {
      local: normalizeAccelerator(binding?.local || ''),
      global: normalizeAccelerator(binding?.global || ''),
    };
  }

  return {
    globalHotkeysEnabled: config?.globalHotkeysEnabled ?? DEFAULT_HOTKEY_CONFIG.globalHotkeysEnabled,
    bindings,
  };
}

export function acceleratorFromKeyboardEvent(event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>): string {
  const key = cleanKey(event.key);
  if (['Control', 'Shift', 'Alt', 'Meta', 'Ctrl'].includes(key)) return '';

  const parts: string[] = [];
  if (event.ctrlKey) parts.push('Ctrl');
  if (event.shiftKey) parts.push('Shift');
  if (event.altKey) parts.push('Alt');
  if (event.metaKey) parts.push('Meta');
  parts.push(key);
  return normalizeAccelerator(parts.join('+'));
}

export function formatAccelerator(accelerator: string): string {
  const normalized = normalizeAccelerator(accelerator);
  return normalized || '未設定';
}
