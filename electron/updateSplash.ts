import { app } from 'electron';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { getElectronLanguage } from './i18n';
import type { SupportedLanguage } from '../shared/i18n';

export interface LaunchUpdateSplashOptions {
    mode: 'real' | 'simulate';
    durationMs?: number;
    parentPid?: number;
    appExe?: string;
    timeoutSec?: number;
}

interface SplashLocalizedCopy {
    updatingBase: string;
    helperText: string;
}

const SPLASH_COPY: Record<SupportedLanguage, SplashLocalizedCopy> = {
    'zh-TW': {
        updatingBase: '正在更新',
        helperText: '正在套用新版本，這可能需要一點時間...',
    },
    'zh-CN': {
        updatingBase: '正在更新',
        helperText: '正在应用新版本，这可能需要一点时间...',
    },
    en: {
        updatingBase: 'Updating',
        helperText: 'This could take some time...',
    },
    ja: {
        updatingBase: 'アップデート中',
        helperText: '更新を適用しています。しばらくお待ちください...',
    },
    ko: {
        updatingBase: '업데이트 중',
        helperText: '새 버전을 적용하는 중입니다. 잠시만 기다려 주세요...',
    },
    id: {
        updatingBase: 'Memperbarui',
        helperText: 'Proses ini mungkin memerlukan sedikit waktu...',
    },
    th: {
        updatingBase: 'กำลังอัปเดต',
        helperText: 'ขั้นตอนนี้อาจใช้เวลาสักครู่...',
    },
};

function getSplashCopy(): SplashLocalizedCopy {
    const lang = getElectronLanguage();
    return SPLASH_COPY[lang] ?? SPLASH_COPY['zh-TW'];
}

function resolveLogoSourcePath(): string | null {
    const candidates: string[] = [];
    if (process.env.VITE_PUBLIC) {
        candidates.push(path.join(process.env.VITE_PUBLIC, 'logo_outer.png'));
    }
    if (process.env.APP_ROOT) {
        candidates.push(path.join(process.env.APP_ROOT, 'public', 'logo_outer.png'));
        candidates.push(path.join(process.env.APP_ROOT, 'dist', 'logo_outer.png'));
    }
    candidates.push(path.join(app.getAppPath(), 'dist', 'logo_outer.png'));
    candidates.push(path.join(app.getAppPath(), 'public', 'logo_outer.png'));

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        } catch {
            // Ignore inaccessible paths
        }
    }
    return null;
}

const SPLASH_POWERSHELL_SCRIPT = `param(
    [Parameter(Mandatory=$true)]
    [string]$ConfigPath
)

$ErrorActionPreference = 'SilentlyContinue'

try {
    $configJson = Get-Content -Path $ConfigPath -Raw -Encoding UTF8
    $config = $configJson | ConvertFrom-Json
} catch {
    exit 1
}

Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

[xml]$xaml = @"
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
        xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
        Title="KHelper Updater"
        Width="310" Height="330"
        WindowStartupLocation="CenterScreen"
        WindowStyle="None"
        AllowsTransparency="True"
        Background="Transparent"
        ResizeMode="NoResize"
        Topmost="True"
        ShowInTaskbar="True">
    <Window.Resources>
        <Storyboard x:Key="PulseStoryboard" RepeatBehavior="Forever" AutoReverse="True">
            <DoubleAnimation Storyboard.TargetName="LogoScale"
                             Storyboard.TargetProperty="ScaleX"
                             From="0.90" To="1.08"
                             Duration="0:0:0.95">
                <DoubleAnimation.EasingFunction>
                    <SineEase EasingMode="EaseInOut"/>
                </DoubleAnimation.EasingFunction>
            </DoubleAnimation>
            <DoubleAnimation Storyboard.TargetName="LogoScale"
                             Storyboard.TargetProperty="ScaleY"
                             From="0.90" To="1.08"
                             Duration="0:0:0.95">
                <DoubleAnimation.EasingFunction>
                    <SineEase EasingMode="EaseInOut"/>
                </DoubleAnimation.EasingFunction>
            </DoubleAnimation>
            <DoubleAnimation Storyboard.TargetName="GlowRingScale"
                             Storyboard.TargetProperty="ScaleX"
                             From="0.85" To="1.18"
                             Duration="0:0:0.95">
                <DoubleAnimation.EasingFunction>
                    <SineEase EasingMode="EaseInOut"/>
                </DoubleAnimation.EasingFunction>
            </DoubleAnimation>
            <DoubleAnimation Storyboard.TargetName="GlowRingScale"
                             Storyboard.TargetProperty="ScaleY"
                             From="0.85" To="1.18"
                             Duration="0:0:0.95">
                <DoubleAnimation.EasingFunction>
                    <SineEase EasingMode="EaseInOut"/>
                </DoubleAnimation.EasingFunction>
            </DoubleAnimation>
            <DoubleAnimation Storyboard.TargetName="GlowRing"
                             Storyboard.TargetProperty="Opacity"
                             From="0.10" To="0.26"
                             Duration="0:0:0.95">
                <DoubleAnimation.EasingFunction>
                    <SineEase EasingMode="EaseInOut"/>
                </DoubleAnimation.EasingFunction>
            </DoubleAnimation>
        </Storyboard>
    </Window.Resources>

    <Border Margin="16"
            CornerRadius="16"
            Background="#18181B"
            BorderBrush="#2D2D33"
            BorderThickness="1">
        <Border.Effect>
            <DropShadowEffect BlurRadius="24" ShadowDepth="6" Opacity="0.65" Color="#000000"/>
        </Border.Effect>

        <Grid Margin="24">
            <StackPanel VerticalAlignment="Center" HorizontalAlignment="Center">
                <Grid Width="104" Height="104" Margin="0,0,0,22" HorizontalAlignment="Center">
                    <Ellipse x:Name="GlowRing"
                             Width="88" Height="88"
                             Fill="#1DB954"
                             Opacity="0.15"
                             RenderTransformOrigin="0.5,0.5">
                        <Ellipse.RenderTransform>
                            <ScaleTransform x:Name="GlowRingScale" ScaleX="0.9" ScaleY="0.9"/>
                        </Ellipse.RenderTransform>
                    </Ellipse>

                    <Image x:Name="LogoImage"
                           Width="74" Height="74"
                           Stretch="Uniform"
                           RenderOptions.BitmapScalingMode="HighQuality"
                           RenderTransformOrigin="0.5,0.5">
                        <Image.RenderTransform>
                            <ScaleTransform x:Name="LogoScale" ScaleX="0.95" ScaleY="0.95"/>
                        </Image.RenderTransform>
                    </Image>
                </Grid>

                <TextBlock x:Name="TitleText"
                           Text="Updating..."
                           Foreground="#FFFFFF"
                           FontFamily="Segoe UI, Microsoft JhengHei UI, Microsoft YaHei UI, Yu Gothic UI, Malgun Gothic"
                           FontSize="17"
                           FontWeight="SemiBold"
                           HorizontalAlignment="Center"
                           TextAlignment="Center"/>

                <TextBlock x:Name="HelperText"
                           Text="This could take some time..."
                           Foreground="#A1A1AA"
                           FontFamily="Segoe UI, Microsoft JhengHei UI, Microsoft YaHei UI, Yu Gothic UI, Malgun Gothic"
                           FontSize="12.5"
                           Margin="0,10,0,0"
                           TextWrapping="Wrap"
                           MaxWidth="230"
                           HorizontalAlignment="Center"
                           TextAlignment="Center"/>
            </StackPanel>
        </Grid>
    </Border>
</Window>
"@

$reader = New-Object System.Xml.XmlNodeReader $xaml
$window = [Windows.Markup.XamlReader]::Load($reader)

$logoControl = $window.FindName("LogoImage")
$titleControl = $window.FindName("TitleText")
$helperControl = $window.FindName("HelperText")
$pulseStoryboard = $window.Resources["PulseStoryboard"]

if ($config.logoPath -and (Test-Path $config.logoPath)) {
    try {
        $bitmap = New-Object System.Windows.Media.Imaging.BitmapImage
        $bitmap.BeginInit()
        $bitmap.UriSource = New-Object System.Uri($config.logoPath, [System.UriKind]::Absolute)
        $bitmap.CacheOption = [System.Windows.Media.Imaging.BitmapCacheOption]::OnLoad
        $bitmap.EndInit()
        $logoControl.Source = $bitmap
        $window.Icon = $bitmap
    } catch {}
}

$updatingBase = if ($config.updatingBase) { [string]$config.updatingBase } else { "Updating" }
$helperText = if ($config.helperText) { [string]$config.helperText } else { "This could take some time..." }

$titleControl.Text = "$updatingBase."
$helperControl.Text = $helperText

$window.Add_MouseLeftButtonDown({
    try { $window.DragMove() } catch {}
})

$window.Add_Loaded({
    if ($pulseStoryboard) {
        $pulseStoryboard.Begin($window, $true)
    }
})

$startTime = [DateTime]::UtcNow
$dotStep = 1
$newAppSeenTicks = 0
$installerGoneTicks = 0
$relaunchTriggered = $false

$mode = if ($config.mode) { [string]$config.mode } else { "real" }
$durationMs = if ($config.durationMs) { [int]$config.durationMs } else { 4000 }
$parentPid = if ($config.parentPid) { [int]$config.parentPid } else { 0 }
$appExe = if ($config.appExe) { [string]$config.appExe } else { "" }
$timeoutSec = if ($config.timeoutSec) { [int]$config.timeoutSec } else { 180 }

$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromMilliseconds(400)

$timer.Add_Tick({
    $script:dotStep = ($script:dotStep % 3) + 1
    $dots = "." * $script:dotStep
    $titleControl.Text = "$updatingBase$dots"

    $elapsedMs = ([DateTime]::UtcNow - $startTime).TotalMilliseconds
    $elapsedSec = $elapsedMs / 1000.0

    if ($mode -eq "simulate") {
        if ($elapsedMs -ge $durationMs) {
            $timer.Stop()
            $window.Close()
        }
        return
    }

    # Real update watchdog mode
    $khelperProcs = @(Get-Process -Name "KHelperV3" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $parentPid })
    if ($khelperProcs.Count -gt 0) {
        $script:newAppSeenTicks += 1
        $hasWindow = ($khelperProcs | Where-Object { $_.MainWindowHandle -ne 0 }).Count -gt 0
        if ($hasWindow -or $script:newAppSeenTicks -ge 3) {
            $timer.Stop()
            $window.Close()
            return
        }
    } else {
        $script:newAppSeenTicks = 0
    }

    $parentAlive = $false
    if ($parentPid -gt 0) {
        $p = Get-Process -Id $parentPid -ErrorAction SilentlyContinue
        if ($null -ne $p) {
            $parentAlive = $true
        }
    }

    if (-not $parentAlive -and $elapsedSec -ge 4.5) {
        $installerProcs = @(Get-Process -ErrorAction SilentlyContinue | Where-Object {
            $_.ProcessName -like "KHelperV3-Setup*" -or $_.ProcessName -like "*KHelper*Setup*"
        })

        if ($installerProcs.Count -eq 0 -and $khelperProcs.Count -eq 0) {
            $script:installerGoneTicks += 1
            if ($script:installerGoneTicks -ge 4 -and -not $script:relaunchTriggered) {
                $script:relaunchTriggered = $true
                if ($appExe -and (Test-Path $appExe)) {
                    Start-Process -FilePath $appExe -ArgumentList "--updated"
                }
            }
            if ($script:installerGoneTicks -ge 8) {
                $timer.Stop()
                $window.Close()
                return
            }
        } else {
            $script:installerGoneTicks = 0
        }
    }

    if ($elapsedSec -ge $timeoutSec) {
        if (-not $script:relaunchTriggered -and $appExe -and (Test-Path $appExe)) {
            $script:relaunchTriggered = $true
            Start-Process -FilePath $appExe
        }
        $timer.Stop()
        $window.Close()
    }
})

$timer.Start()
[void]$window.ShowDialog()
`;

export function launchUpdateSplash(options: LaunchUpdateSplashOptions): ChildProcess | null {
    if (process.platform !== 'win32') {
        return null;
    }

    try {
        const splashDir = path.join(os.tmpdir(), 'khelper-update-splash');
        fs.mkdirSync(splashDir, { recursive: true });

        let logoDestPath: string | null = null;
        const logoSource = resolveLogoSourcePath();
        if (logoSource) {
            try {
                logoDestPath = path.join(splashDir, 'logo.png');
                const logoBuffer = fs.readFileSync(logoSource);
                fs.writeFileSync(logoDestPath, logoBuffer);
            } catch (err) {
                console.warn('[UpdateSplash] Failed to copy logo to temp:', err);
                logoDestPath = null;
            }
        }

        const copy = getSplashCopy();
        const configPayload = {
            mode: options.mode,
            durationMs: options.durationMs ?? 4000,
            parentPid: options.parentPid ?? process.pid,
            appExe: options.appExe ?? process.execPath,
            timeoutSec: options.timeoutSec ?? 180,
            logoPath: logoDestPath,
            updatingBase: copy.updatingBase,
            helperText: copy.helperText,
        };

        const configPath = path.join(splashDir, 'splash-config.json');
        const scriptPath = path.join(splashDir, 'splash.ps1');

        // Write UTF-8 with BOM for PowerShell 5.1 compatibility
        const utf8Bom = Buffer.from([0xEF, 0xBB, 0xBF]);
        const scriptBuf = Buffer.concat([utf8Bom, Buffer.from(SPLASH_POWERSHELL_SCRIPT, 'utf8')]);
        const configBuf = Buffer.concat([utf8Bom, Buffer.from(JSON.stringify(configPayload, null, 2), 'utf8')]);

        fs.writeFileSync(scriptPath, scriptBuf);
        fs.writeFileSync(configPath, configBuf);

        const isDetached = options.mode === 'real';
        const child = spawn(
            'powershell.exe',
            [
                '-NoProfile',
                '-NonInteractive',
                '-ExecutionPolicy',
                'Bypass',
                '-WindowStyle',
                'Hidden',
                '-Sta',
                '-File',
                scriptPath,
                '-ConfigPath',
                configPath,
            ],
            {
                cwd: splashDir,
                detached: isDetached,
                stdio: 'ignore',
                windowsHide: true,
            }
        );

        if (isDetached) {
            child.unref();
        }

        return child;
    } catch (err) {
        console.error('[UpdateSplash] Failed to launch update splash:', err);
        return null;
    }
}
