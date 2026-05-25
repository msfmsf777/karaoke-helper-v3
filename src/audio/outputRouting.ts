export interface OutputGainConfig {
  streamDeviceId: string | null;
  headphoneDeviceId: string | null;
  streamOutputGain: number;
  headphoneOutputGain: number;
}

export interface ResolvedOutputGains {
  stream: number;
  headphone: number;
  streamSuppressedForOverlap: boolean;
}

const normalizeDeviceId = (deviceId: string | null): string =>
  !deviceId || deviceId === 'default' ? 'default' : deviceId;

const clampGain = (gain: number): number => Math.min(Math.max(gain, 0), 1);

export function areOutputDevicesOverlapping(
  streamDeviceId: string | null,
  headphoneDeviceId: string | null,
): boolean {
  return normalizeDeviceId(streamDeviceId) === normalizeDeviceId(headphoneDeviceId);
}

export function resolveOutputGains(config: OutputGainConfig): ResolvedOutputGains {
  const stream = clampGain(config.streamOutputGain);
  const headphone = clampGain(config.headphoneOutputGain);
  const streamSuppressedForOverlap = stream > 0
    && headphone > 0
    && areOutputDevicesOverlapping(config.streamDeviceId, config.headphoneDeviceId);

  return {
    stream: streamSuppressedForOverlap ? 0 : stream,
    headphone,
    streamSuppressedForOverlap,
  };
}

export function resolveNativeStartDelays(
  offsetMs: number,
  dualOutputAudible: boolean,
): { stream: number; headphone: number } {
  if (!dualOutputAudible || !Number.isFinite(offsetMs)) {
    return { stream: 0, headphone: 0 };
  }

  if (offsetMs > 0) {
    return { stream: 0, headphone: offsetMs };
  }

  return { stream: Math.abs(offsetMs), headphone: 0 };
}

export function resolveNativeCompletionRole(
  offsetMs: number,
  dualOutputAudible: boolean,
): 'stream' | 'headphone' {
  return dualOutputAudible && offsetMs < 0 ? 'stream' : 'headphone';
}
