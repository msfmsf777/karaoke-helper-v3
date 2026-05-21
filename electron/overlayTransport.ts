export const WS_OPEN = 1;

export type OverlayTransportPayload = Record<string, unknown>;

export interface SseOverlayClient {
  write: (chunk: string) => void;
}

export interface WebSocketOverlayClient {
  readyState: number;
  send: (data: string) => void;
}

export class OverlayTransport {
  private readonly sseClients = new Set<SseOverlayClient>();
  private readonly webSocketClients = new Set<WebSocketOverlayClient>();

  constructor(private readonly getCachedPayloads: () => OverlayTransportPayload[]) {}

  addSseClient(client: SseOverlayClient) {
    this.sseClients.add(client);
    this.writeSse(client, { type: 'connected' });
    this.sendCachedPayloadsToSse(client);
    return () => {
      this.sseClients.delete(client);
    };
  }

  addWebSocketClient(client: WebSocketOverlayClient) {
    if (client.readyState !== WS_OPEN) return () => undefined;

    this.webSocketClients.add(client);
    this.sendCachedPayloadsToWebSocket(client);
    return () => {
      this.webSocketClients.delete(client);
    };
  }

  removeWebSocketClient(client: WebSocketOverlayClient) {
    this.webSocketClients.delete(client);
  }

  broadcast(payload: OverlayTransportPayload) {
    const sseChunk = `data: ${JSON.stringify(payload)}\n\n`;
    const webSocketMessage = JSON.stringify(payload);

    for (const client of Array.from(this.sseClients)) {
      try {
        client.write(sseChunk);
      } catch {
        this.sseClients.delete(client);
      }
    }

    for (const client of Array.from(this.webSocketClients)) {
      if (client.readyState !== WS_OPEN) {
        this.webSocketClients.delete(client);
        continue;
      }

      try {
        client.send(webSocketMessage);
      } catch {
        this.webSocketClients.delete(client);
      }
    }
  }

  getClientCounts() {
    return {
      sse: this.sseClients.size,
      websocket: this.webSocketClients.size,
    };
  }

  private sendCachedPayloadsToSse(client: SseOverlayClient) {
    this.getCachedPayloads().forEach((payload) => this.writeSse(client, payload));
  }

  private sendCachedPayloadsToWebSocket(client: WebSocketOverlayClient) {
    this.getCachedPayloads().forEach((payload) => client.send(JSON.stringify(payload)));
  }

  private writeSse(client: SseOverlayClient, payload: OverlayTransportPayload) {
    client.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}
