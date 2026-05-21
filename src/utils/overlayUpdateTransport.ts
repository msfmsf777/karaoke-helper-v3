export function subscribeOverlayServerUpdates<TPayload extends object>(
  baseUrl: string,
  onPayload: (payload: TPayload) => void,
) {
  let closed = false;
  let fallbackStarted = false;
  let eventSource: EventSource | null = null;
  let webSocket: WebSocket | null = null;

  const handleMessage = (data: string) => {
    try {
      const payload = JSON.parse(data) as TPayload & { type?: string };
      if (payload.type === 'connected') return;
      onPayload(payload);
    } catch (error) {
      console.error('[OverlayTransport] Failed to parse update message', error);
    }
  };

  const startEventSourceFallback = () => {
    if (closed || fallbackStarted) return;
    fallbackStarted = true;
    eventSource = new EventSource(`${baseUrl}/events`);
    eventSource.onmessage = (event) => handleMessage(event.data);
    eventSource.onerror = (error) => {
      console.error('[OverlayTransport] SSE fallback error', error);
    };
  };

  try {
    const eventsUrl = new URL('/events', baseUrl || window.location.href);
    eventsUrl.protocol = eventsUrl.protocol === 'https:' ? 'wss:' : 'ws:';
    webSocket = new WebSocket(eventsUrl.toString());
    webSocket.onmessage = (event) => handleMessage(String(event.data));
    webSocket.onerror = () => startEventSourceFallback();
    webSocket.onclose = () => startEventSourceFallback();
  } catch (error) {
    console.error('[OverlayTransport] Failed to start WebSocket updates', error);
    startEventSourceFallback();
  }

  return () => {
    closed = true;
    webSocket?.close();
    eventSource?.close();
  };
}
