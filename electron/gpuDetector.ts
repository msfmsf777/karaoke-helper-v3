import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { app } from 'electron';

const execAsync = promisify(exec);

export interface GpuDetectionResult {
  hasCapableGpu: boolean;
  vendor: 'nvidia' | 'amd' | 'intel' | 'other';
  modelName: string;
  vramMb?: number;
  driverVersion?: string;
  recommendation: 'gpu' | 'cpu';
  recommendationReason: string;
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
      const isCapable = !vramMb || vramMb >= 3500; // 4GB+ standard VRAM for robust separation

      return {
        hasCapableGpu: isCapable,
        vendor: 'nvidia',
        modelName,
        vramMb,
        driverVersion,
        recommendation: isCapable ? 'gpu' : 'cpu',
        recommendationReason: isCapable
          ? `${modelName}${vramGb ? ` (${vramGb} GB)` : ''} detected. CUDA acceleration strongly recommended (15–30s per song).`
          : `${modelName} detected, but VRAM may be limited. CPU mode recommended for stability.`,
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

          return {
            hasCapableGpu: true,
            vendor: 'nvidia',
            modelName,
            vramMb,
            driverVersion: nvidiaCard.DriverVersion || undefined,
            recommendation: 'gpu',
            recommendationReason: `${modelName} detected. GPU acceleration recommended.`,
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
