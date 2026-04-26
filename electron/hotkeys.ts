import { globalShortcut } from 'electron';
import {
  HOTKEY_ACTIONS,
  HotkeyAction,
  HotkeyConfig,
  HotkeyRegistrationStatus,
  isPlainGlobalAccelerator,
  mergeHotkeyConfig,
  normalizeAccelerator,
} from '../shared/hotkeys';

const registeredAccelerators = new Set<string>();

let currentStatus: HotkeyRegistrationStatus = {
  globalHotkeysEnabled: false,
  registered: {},
  failed: {},
};

function unregisterCurrentGlobalHotkeys() {
  for (const accelerator of registeredAccelerators) {
    globalShortcut.unregister(accelerator);
  }
  registeredAccelerators.clear();
}

export function applyGlobalHotkeys(
  config: Partial<HotkeyConfig> | null | undefined,
  dispatch: (action: HotkeyAction) => void,
): HotkeyRegistrationStatus {
  unregisterCurrentGlobalHotkeys();

  const normalized = mergeHotkeyConfig(config);
  const status: HotkeyRegistrationStatus = {
    globalHotkeysEnabled: normalized.globalHotkeysEnabled,
    registered: {},
    failed: {},
  };

  if (!normalized.globalHotkeysEnabled) {
    currentStatus = status;
    return status;
  }

  const seen = new Map<string, HotkeyAction>();

  for (const { action } of HOTKEY_ACTIONS) {
    const accelerator = normalizeAccelerator(normalized.bindings[action].global);
    if (!accelerator) continue;

    if (isPlainGlobalAccelerator(accelerator)) {
      status.failed[action] = '全域快捷鍵需包含修飾鍵';
      continue;
    }

    const existingAction = seen.get(accelerator);
    if (existingAction) {
      status.failed[action] = '重複快捷鍵';
      status.failed[existingAction] = status.failed[existingAction] || '重複快捷鍵';
      continue;
    }
    seen.set(accelerator, action);

    const registered = globalShortcut.register(accelerator, () => dispatch(action));
    status.registered[action] = registered;

    if (registered) {
      registeredAccelerators.add(accelerator);
    } else {
      status.failed[action] = '被其他應用程式佔用';
    }
  }

  currentStatus = status;
  return status;
}

export function getHotkeyRegistrationStatus(): HotkeyRegistrationStatus {
  return currentStatus;
}

export function unregisterGlobalHotkeys() {
  unregisterCurrentGlobalHotkeys();
  currentStatus = {
    globalHotkeysEnabled: false,
    registered: {},
    failed: {},
  };
}
