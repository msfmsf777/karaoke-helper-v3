import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';
import type { CudaIndexVariant } from '../shared/separationTypes';

const execAsync = promisify(exec);

export interface GpuDetectionResult {
  hasCapableGpu: boolean;
  vendor: 'nvidia' | 'amd' | 'intel' | 'other';
  modelName: string;
  vramMb?: number;
  driverVersion?: string;
  recommendation: 'gpu' | 'cpu';
  recommendationReason: string;
  driverOutdated?: boolean;
  minRequiredDriver?: string;
  driverUpdateUrl?: string;
  cudaIndex?: CudaIndexVariant;
}

export interface NvidiaArchitectureClassification {
  supported: boolean;
  cudaIndex: CudaIndexVariant;
  isBlackwell: boolean;
}

/**
 * Classifies an NVIDIA GPU model into its required PyTorch CUDA wheel index:
 * - 'cu128' for Turing (sm_75), Ampere (sm_80/86), Ada (sm_89), Hopper (sm_90), and Blackwell (sm_100/120).
 * - 'cu126' for legacy Maxwell (sm_50/52) and Pascal (sm_60/61) GPUs (GTX 750, GTX 900, GTX 10-series).
 * - supported: false for pre-Maxwell GPUs (Kepler/Fermi, e.g. GT 710/730, GTX 600/760/770/780).
 */
export function classifyNvidiaGpuArchitecture(modelName: string): NvidiaArchitectureClassification {
  const normalized = (modelName || '').trim();
  const isBlackwell = /\b(?:rtx\s*)?50\d{2}\b|blackwell|\b[gb][12]00\b|\brtx\s*pro\s*6000\b/i.test(normalized);

  if (isBlackwell) {
    return { supported: true, cudaIndex: 'cu128', isBlackwell: true };
  }

  // Unsupported pre-Maxwell (Fermi / Kepler / early mobile chips < sm_50)
  const isUnsupportedLegacy =
    /\b(?:gt|gtx|gts|geforce)\s*[23456]\d{2}m?\b/i.test(normalized) ||
    /\bgt\s*7[0-4]\dm?\b/i.test(normalized) ||
    /\bgtx\s*7(?:60|65m|70|70m|80|80m)(?:\s*ti)?\b/i.test(normalized) ||
    /\b(?:gt|gtx|geforce)\s*8[0-4]\dm\b/i.test(normalized) ||
    /\bgeforce\s*9[12]0m\b/i.test(normalized) ||
    /\bquadro\s*(?:k\d+|fx|[246]000)\b/i.test(normalized) ||
    /\bnvs\s*\d+\b/i.test(normalized) ||
    /\btesla\s*[ck]\d+\b/i.test(normalized);

  if (isUnsupportedLegacy) {
    return { supported: false, cudaIndex: 'cu126', isBlackwell: false };
  }

  // Legacy Maxwell (sm_50/52) & Pascal (sm_60/61) -> requires cu126 because cu128 starts at sm_75
  const isMaxwellOrPascal =
    /\bgtx\s*7(?:45|50)(?:\s*ti)?\b/i.test(normalized) ||
    /\bgtx\s*8[5678]0m\b/i.test(normalized) ||
    /\b(?:gt|gtx|geforce)\s*9\d{2}(?:m|mx|\s*ti)?\b/i.test(normalized) ||
    /\b(?:gt|gtx)\s*10[135678]0(?:\s*ti)?\b/i.test(normalized) ||
    /\btitan\s*x(?:p)?\b/i.test(normalized) ||
    /\bmx\s*[123]\d0\b/i.test(normalized) ||
    /\bquadro\s*[mp]\d{3,4}\b/i.test(normalized) ||
    /\btesla\s*[mp]\d+\b/i.test(normalized);

  if (isMaxwellOrPascal) {
    return { supported: true, cudaIndex: 'cu126', isBlackwell: false };
  }

  // Modern Turing (GTX 16xx, RTX 20xx), Ampere (RTX 30xx), Ada (RTX 40xx), Blackwell (RTX 50xx) -> cu128
  return { supported: true, cudaIndex: 'cu128', isBlackwell: false };
}

export function parseNvidiaDriverVersion(raw?: string): number | null {
  if (!raw) return null;
  const directMatch = raw.match(/\b(\d{3})\.(\d+)\b/);
  if (directMatch) {
    return parseFloat(`${directMatch[1]}.${directMatch[2]}`);
  }
  const wmiMatch = raw.match(/(\d)\.(\d{2})(\d{2})$/);
  if (wmiMatch) {
    return parseFloat(`${wmiMatch[1]}${wmiMatch[2]}.${wmiMatch[3]}`);
  }
  return null;
}

function checkNvidiaDriverStatus(modelName: string, rawDriver?: string): {
  driverOutdated?: boolean;
  minRequiredDriver?: string;
  driverUpdateUrl?: string;
} {
  const parsed = parseNvidiaDriverVersion(rawDriver);
  if (!parsed) return {};

  const { isBlackwell } = classifyNvidiaGpuArchitecture(modelName);
  const minRequired = isBlackwell ? 572.16 : 528.33;
  const minRequiredStr = isBlackwell ? '572.16+' : '528.33+';

  if (parsed < minRequired) {
    return {
      driverOutdated: true,
      minRequiredDriver: minRequiredStr,
      driverUpdateUrl: 'https://www.nvidia.com/Download/index.aspx',
    };
  }
  return {
    driverOutdated: false,
    minRequiredDriver: minRequiredStr,
    driverUpdateUrl: 'https://www.nvidia.com/Download/index.aspx',
  };
}

/**
 * Probes the system for GPU hardware and returns acceleration capability.
 * Prioritizes nvidia-smi for accurate VRAM and driver metrics,
 * with fallbacks to PowerShell CIM and Electron's GPU subsystem.
 */
export async function detectGpuHardware(): Promise<GpuDetectionResult> {
  // 1. Primary probe: nvidia-smi (fastest and most accurate for NVIDIA CUDA)
  try {
    const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader', {
      timeout: 3000,
      windowsHide: true,
    });

    const line = stdout.trim().split('\n')[0];
    if (line) {
      const parts = line.split(',').map((p) => p.trim());
      const modelName = parts[0] || 'NVIDIA GPU';
      let vramMb: number | undefined;

      if (parts[1]) {
        const memMatch = parts[1].match(/(\d+)/);
        if (memMatch) {
          vramMb = parseInt(memMatch[1], 10);
        }
      }

      const driverVersion = parts[2] || undefined;
      const vramGb = vramMb ? (vramMb / 1024).toFixed(1) : undefined;
      const arch = classifyNvidiaGpuArchitecture(modelName);
      const hasEnoughVram = !vramMb || vramMb >= 3500; // 4GB+ standard VRAM for robust separation
      const isCapable = arch.supported && hasEnoughVram;
      const driverStatus = isCapable ? checkNvidiaDriverStatus(modelName, driverVersion) : {};

      let reason: string;
      if (!arch.supported) {
        reason = `檢測到 ${modelName}，因顯示卡架構較舊不支援目前 CUDA 加速核心，建議使用標準 CPU 模式以確保穩定性。`;
      } else if (!hasEnoughVram) {
        reason = `${modelName}${vramGb ? ` (${vramGb} GB)` : ''} 顯示卡記憶體較小，建議使用標準 CPU 模式以確保穩定性。`;
      } else if (driverStatus.driverOutdated) {
        reason = `檢測到 ${modelName}，但驅動程式版本過舊 (v${driverVersion || '未知'}，需 ${driverStatus.minRequiredDriver})。建議前往 NVIDIA 官網更新驅動以解鎖 GPU 極速分離。`;
      } else {
        reason = `${modelName}${vramGb ? ` (${vramGb} GB)` : ''} detected. CUDA acceleration strongly recommended (15–30s per song).`;
      }

      return {
        hasCapableGpu: isCapable,
        vendor: 'nvidia',
        modelName,
        vramMb,
        driverVersion,
        recommendation: isCapable ? 'gpu' : 'cpu',
        recommendationReason: reason,
        cudaIndex: isCapable ? arch.cudaIndex : undefined,
        ...driverStatus,
      };
    }
  } catch {
    // nvidia-smi failed or not installed, continue to fallbacks
  }

  // 2. Windows Fallback: PowerShell Win32_VideoController query
  if (process.platform === 'win32') {
    try {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "Get-CimInstance Win32_VideoController | Select-Object Name, AdapterRAM, DriverVersion | ConvertTo-Json"',
        { timeout: 4000, windowsHide: true }
      );

      if (stdout.trim()) {
        const parsed = JSON.parse(stdout.trim());
        const controllers = Array.isArray(parsed) ? parsed : [parsed];

        // Check for NVIDIA first
        const nvidiaCard = controllers.find((c: any) =>
          typeof c?.Name === 'string' && /nvidia/i.test(c.Name)
        );

        if (nvidiaCard) {
          const modelName = nvidiaCard.Name.trim();
          const rawRam = Number(nvidiaCard.AdapterRAM);
          const vramMb = !isNaN(rawRam) && rawRam > 0 ? Math.round(rawRam / (1024 * 1024)) : undefined;
          const driverVersion = nvidiaCard.DriverVersion || undefined;
          const arch = classifyNvidiaGpuArchitecture(modelName);
          // WMI AdapterRAM is uint32 and wraps on >4GB GPUs; RTX 20/30/40/50 always have >= 4GB VRAM
          const isModernRtx = /\brtx\s*[2345]\d{2}\b/i.test(modelName) || arch.isBlackwell;
          const hasEnoughVram = isModernRtx || !vramMb || vramMb >= 3500;
          const isCapable = arch.supported && hasEnoughVram;
          const driverStatus = isCapable ? checkNvidiaDriverStatus(modelName, driverVersion) : {};

          let reason: string;
          if (!arch.supported) {
            reason = `檢測到 ${modelName}，因顯示卡架構較舊不支援目前 CUDA 加速核心，建議使用標準 CPU 模式以確保穩定性。`;
          } else if (!hasEnoughVram) {
            reason = `${modelName} 顯示卡記憶體較小，建議使用標準 CPU 模式以確保穩定性。`;
          } else if (driverStatus.driverOutdated) {
            reason = `檢測到 ${modelName}，但驅動程式版本過舊。更新驅動程式即可啟用 GPU 極速加速。`;
          } else {
            reason = `${modelName} detected. GPU acceleration recommended.`;
          }

          return {
            hasCapableGpu: isCapable,
            vendor: 'nvidia',
            modelName,
            vramMb: isModernRtx && vramMb && vramMb <= 4096 ? undefined : vramMb,
            driverVersion,
            recommendation: isCapable ? 'gpu' : 'cpu',
            recommendationReason: reason,
            cudaIndex: isCapable ? arch.cudaIndex : undefined,
            ...driverStatus,
          };
        }

        // Check for other dedicated vendors (AMD / Intel)
        const otherCard = controllers.find((c: any) =>
          typeof c?.Name === 'string' && !/basic render|microsoft/i.test(c.Name)
        );

        if (otherCard) {
          const name = otherCard.Name.trim();
          const isAmd = /radeon|amd/i.test(name);
          const isIntel = /intel|arc/i.test(name);

          return {
            hasCapableGpu: false, // CUDA specific
            vendor: isAmd ? 'amd' : isIntel ? 'intel' : 'other',
            modelName: name,
            recommendation: 'cpu',
            recommendationReason: `${name} detected. CPU separation engine is recommended for stable performance.`,
          };
        }
      }
    } catch {
      // PowerShell query failed
    }
  }

  // 3. Electron app.getGPUInfo fallback
  try {
    const gpuInfo = await app.getGPUInfo('basic');
    const gpuDevices = (gpuInfo as any)?.gpuDevice;
    if (Array.isArray(gpuDevices) && gpuDevices.length > 0) {
      const hasNvidia = gpuDevices.some((d: any) => d?.vendorId === 0x10de || d?.vendorId === 4318);
      if (hasNvidia) {
        return {
          hasCapableGpu: true,
          vendor: 'nvidia',
          modelName: 'NVIDIA GPU',
          recommendation: 'gpu',
          recommendationReason: 'NVIDIA GPU detected. GPU acceleration recommended.',
          cudaIndex: 'cu128',
        };
      }
    }
  } catch {
    // GPU info query failed
  }

  // Fallback: CPU only
  return {
    hasCapableGpu: false,
    vendor: 'other',
    modelName: 'Standard CPU',
    recommendation: 'cpu',
    recommendationReason: 'No supported NVIDIA GPU detected. Standard CPU separation engine will be used.',
  };
}
