import {
  ANALYTICS_NOTICE_VERSION,
  isAnalyticsEvent,
  type AnalyticsCommonProperties,
  type AnalyticsConsent,
  type AnalyticsEvent,
  type AnalyticsSettings,
} from '../shared/analytics.ts';

export interface AnalyticsSender {
  send: (event: AnalyticsEvent, commonProperties: AnalyticsCommonProperties) => Promise<void>;
}

export interface AnalyticsServiceDependencies {
  loadSettings: () => Promise<AnalyticsSettings>;
  saveSettings: (settings: AnalyticsSettings) => Promise<void>;
  loadClientId: () => Promise<string | null>;
  createClientId: () => Promise<string>;
  deleteClientId: () => Promise<void>;
  createSender: (clientId: string) => Promise<AnalyticsSender | null>;
  getCommonProperties: () => Promise<AnalyticsCommonProperties>;
  now?: () => Date;
}

export interface AnalyticsServiceOptions {
  flushAtCount?: number;
  flushIntervalMs?: number;
  maxQueuedEvents?: number;
}

const DEFAULT_FLUSH_AT_COUNT = 10;
const DEFAULT_FLUSH_INTERVAL_MS = 30_000;
const DEFAULT_MAX_QUEUED_EVENTS = 50;

export class AnalyticsService {
  private readonly dependencies: AnalyticsServiceDependencies;
  private settings: AnalyticsSettings | null = null;
  private sender: AnalyticsSender | null = null;
  private queue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushing: Promise<void> | null = null;
  private readonly flushAtCount: number;
  private readonly flushIntervalMs: number;
  private readonly maxQueuedEvents: number;

  constructor(
    dependencies: AnalyticsServiceDependencies,
    options: AnalyticsServiceOptions = {},
  ) {
    this.dependencies = dependencies;
    this.flushAtCount = options.flushAtCount ?? DEFAULT_FLUSH_AT_COUNT;
    this.flushIntervalMs = options.flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS;
    this.maxQueuedEvents = options.maxQueuedEvents ?? DEFAULT_MAX_QUEUED_EVENTS;
  }

  async initialize(): Promise<void> {
    this.settings = await this.dependencies.loadSettings();
    if (this.settings.consent === 'enabled') {
      await this.enableSender();
    }
  }

  async getSettings(): Promise<AnalyticsSettings> {
    if (!this.settings) await this.initialize();
    return this.settings!;
  }

  async setConsent(consent: Exclude<AnalyticsConsent, 'unset'>): Promise<AnalyticsSettings> {
    const next: AnalyticsSettings = {
      consent,
      noticeVersion: ANALYTICS_NOTICE_VERSION,
      decidedAt: (this.dependencies.now?.() ?? new Date()).toISOString(),
    };
    await this.dependencies.saveSettings(next);
    this.settings = next;

    if (consent === 'disabled') {
      this.queue = [];
      this.stopFlushTimer();
      this.sender = null;
      await this.dependencies.deleteClientId();
      return next;
    }

    await this.enableSender();
    await this.track({ type: 'Privacy.AnalyticsEnabled', noticeVersion: ANALYTICS_NOTICE_VERSION });
    return next;
  }

  async track(event: AnalyticsEvent): Promise<boolean> {
    if (!isAnalyticsEvent(event)) return false;
    if (!this.settings) await this.initialize();
    if (this.settings?.consent !== 'enabled') return false;

    await this.enableSender();
    if (!this.sender) return false;

    if (this.queue.length >= this.maxQueuedEvents) {
      this.queue.shift();
    }
    this.queue.push(event);
    if (this.queue.length >= this.flushAtCount) {
      await this.flush();
    } else {
      this.startFlushTimer();
    }
    return true;
  }

  async flush(): Promise<void> {
    if (!this.sender || this.queue.length === 0) return;
    if (this.flushing) {
      await this.flushing;
      return;
    }

    const events = this.queue.splice(0, this.queue.length);
    this.flushing = (async () => {
      const commonProperties = await this.dependencies.getCommonProperties();
      await Promise.allSettled(events.map((event) => this.sender!.send(event, commonProperties)));
    })().finally(() => {
      this.flushing = null;
    });
    await this.flushing;
  }

  async shutdown(): Promise<void> {
    this.stopFlushTimer();
    await this.flush();
  }

  private async enableSender(): Promise<void> {
    if (this.sender) return;
    const clientId = await this.dependencies.loadClientId() ?? await this.dependencies.createClientId();
    this.sender = await this.dependencies.createSender(clientId);
    if (this.sender) this.startFlushTimer();
  }

  private startFlushTimer(): void {
    if (this.flushTimer || !this.sender) return;
    this.flushTimer = setInterval(() => {
      void this.flush();
    }, this.flushIntervalMs);
    this.flushTimer.unref?.();
  }

  private stopFlushTimer(): void {
    if (!this.flushTimer) return;
    clearInterval(this.flushTimer);
    this.flushTimer = null;
  }
}
