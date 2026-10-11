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

describe('Windows installer prerequisite robustness', () => {
  it('checks VC redistributable build version and accepts non-error exit codes', () => {
    assert.match(installerInclude, /ReadRegDWORD \$1 HKLM "SOFTWARE\\Microsoft\\VisualStudio\\14\.0\\VC\\Runtimes\\x64" "Bld"/);
    assert.match(installerInclude, /\$1 < 35211/);
    assert.match(installerInclude, /\$0 != 3010/);
    assert.match(installerInclude, /\$0 != 1638/);
  });

  it('cleans up temporary VC_redist payload after installation to save disk space', () => {
    assert.match(installerInclude, /Delete "\$INSTDIR\\resources\\bin\\VC_redist\.x64\.exe"/);
  });
});

describe('Windows uninstaller lifecycle and selective data cleanup', () => {
  it('checks if KHelper is running before starting uninstall and prompts for clean exit', () => {
    assert.match(installerInclude, /!macro customUnInit[\s\S]*\$\{nsProcess::FindProcess\} "KHelperV3\.exe"/);
    assert.match(installerInclude, /\$\{nsProcess::CloseProcess\} "KHelperV3\.exe"/);
    assert.match(installerInclude, /\$\{nsProcess::KillProcess\} "KHelperV3\.exe"/);
  });

  it('reads user language and custom paths from settings.json', () => {
    assert.match(installerInclude, /settings\.json/);
    assert.match(installerInclude, /"language"/);
    assert.match(installerInclude, /"customSongsPath"/);
    assert.match(installerInclude, /"customRuntimePath"/);
    assert.match(installerInclude, /StrCpy \$LANGUAGE 1028/); // zh-TW
    assert.match(installerInclude, /StrCpy \$LANGUAGE 1033/); // en
  });

  it('registers data selection and review confirmation pages before file removal', () => {
    assert.match(
      installerInclude,
      /!macro customUnWelcomePage[\s\S]*!insertmacro MUI_UNPAGE_WELCOME[\s\S]*UninstPage custom un\.PageDataSelection un\.PageDataSelectionLeave[\s\S]*UninstPage custom un\.PageConfirmReview un\.PageConfirmReviewLeave[\s\S]*!macroend/,
    );
  });

  it('deletes only user-selected directories during uninstallation', () => {
    assert.match(
      installerInclude,
      /!macro customUnInstall[\s\S]*\$\{If\} \$unDeleteSongs == "1"[\s\S]*RMDir \/r "\$unSongsDir"[\s\S]*\$\{If\} \$unDeleteModels == "1"[\s\S]*RMDir \/r "\$unModelsDir"[\s\S]*\$\{If\} \$unDeleteRuntime == "1"[\s\S]*RMDir \/r "\$unRuntimeDir"[\s\S]*\$\{If\} \$unDeleteSettings == "1"[\s\S]*RMDir \/r "\$unSettingsDir"/,
    );
  });
});
