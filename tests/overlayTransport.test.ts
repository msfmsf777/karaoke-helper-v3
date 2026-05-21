import { describe, expect, it, vi } from 'vitest';
import { OverlayTransport, WS_OPEN } from '../electron/overlayTransport';

const makeSseClient = () => ({
  write: vi.fn(),
});

const makeWebSocketClient = (readyState = WS_OPEN) => ({
  readyState,
  send: vi.fn(),
});

describe('OverlayTransport', () => {
  it('sends connected and cached payloads to new SSE clients', () => {
    const cached = [
      { type: 'preference', prefs: { furiganaEnabled: true } },
      { type: 'setlist', queue: ['song-1'], currentIndex: 0 },
    ];
    const transport = new OverlayTransport(() => cached);
    const client = makeSseClient();

    transport.addSseClient(client);

    expect(client.write).toHaveBeenCalledWith('data: {"type":"connected"}\n\n');
    expect(client.write).toHaveBeenCalledWith(`data: ${JSON.stringify(cached[0])}\n\n`);
    expect(client.write).toHaveBeenCalledWith(`data: ${JSON.stringify(cached[1])}\n\n`);
  });

  it('sends cached payloads to new WebSocket clients', () => {
    const cached = [
      { type: 'playback', songId: 'song-1', currentTime: 12.4 },
      { type: 'style', style: { activeColor: '#fff' } },
    ];
    const transport = new OverlayTransport(() => cached);
    const client = makeWebSocketClient();

    transport.addWebSocketClient(client);

    expect(client.send).toHaveBeenCalledWith(JSON.stringify(cached[0]));
    expect(client.send).toHaveBeenCalledWith(JSON.stringify(cached[1]));
  });

  it('broadcasts payloads to SSE and WebSocket clients and prunes closed sockets', () => {
    const transport = new OverlayTransport(() => []);
    const sseClient = makeSseClient();
    const openSocket = makeWebSocketClient();
    const closedSocket = makeWebSocketClient(3);
    const payload = { type: 'setlist', queue: ['song-2'], currentIndex: 1 };

    transport.addSseClient(sseClient);
    transport.addWebSocketClient(openSocket);
    transport.addWebSocketClient(closedSocket);
    transport.broadcast(payload);

    expect(sseClient.write).toHaveBeenCalledWith(`data: ${JSON.stringify(payload)}\n\n`);
    expect(openSocket.send).toHaveBeenCalledWith(JSON.stringify(payload));
    expect(closedSocket.send).not.toHaveBeenCalled();
    expect(transport.getClientCounts()).toEqual({ sse: 1, websocket: 1 });
  });
});
