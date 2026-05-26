import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const updaterSource = fs.readFileSync(path.join(root, 'electron', 'updater.ts'), 'utf8');
const installerConfig = fs.readFileSync(path.join(root, 'electron-builder.config.mjs'), 'utf8');
const installerInclude = fs.readFileSync(path.join(root, 'build', 'installer.nsh'), 'utf8');

describe('Windows in-app update installer handoff', () => {
  it('opens an update progress window instead of running the installer silently', () => {
    assert.match(updaterSource, /autoUpdater\.quitAndInstall\(false\)/);
    assert.doesNotMatch(updaterSource, /autoUpdater\.quitAndInstall\(true,\s*true\)/);
  });

  it('prompts for installer language only for interactive installs', () => {
    assert.match(installerConfig, /displayLanguageSelector:\s*false/);
    assert.match(
      installerInclude,
      /!macro customInit[\s\S]*\$\{IfNot\} \$\{isUpdated\}[\s\S]*!insertmacro MUI_LANGDLL_DISPLAY[\s\S]*!macroend/,
    );
  });

  it('relaunches automatically when an update-only installer finishes', () => {
    assert.match(
      installerInclude,
      /!macro customFinishPage[\s\S]*\$\{If\} \$\{isUpdated\}[\s\S]*Call KHelperLaunchInstalledApp[\s\S]*Quit[\s\S]*!insertmacro MUI_PAGE_FINISH[\s\S]*!macroend/,
    );
  });
});
