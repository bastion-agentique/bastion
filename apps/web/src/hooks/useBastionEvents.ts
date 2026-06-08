import { useState, useEffect, useCallback } from 'react';

export interface BastionEvent {
  type: string;
  decision?: string;
  reason?: string;
  timestamp?: number;
  blockId?: string;
  agentId?: string;
  chain?: string;
}

interface UseBastionEventsOptions {
  eventsUrl?: string;
  enabled?: boolean;
  onAuditRecorded?: (event: BastionEvent) => void;
  onHITLPending?: (event: BastionEvent) => void;
  onHITLResolved?: (event: BastionEvent) => void;
}

export function useBastionEvents({
  eventsUrl = 'https://bastion-agentique.fly.dev/events',
  enabled = true,
  onAuditRecorded,
  onHITLPending,
  onHITLResolved,
}: UseBastionEventsOptions = {}) {
  const [connected, setConnected] = useState(false);
  const [latestEvent, setLatestEvent] = useState<BastionEvent | null>(null);
  const [eventHistory, setEventHistory] = useState<BastionEvent[]>([]);

  useEffect(() => {
    if (!enabled) return;

    let eventSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      eventSource = new EventSource(eventsUrl);

      eventSource.onopen = () => {
        setConnected(true);
      };

      eventSource.onerror = () => {
        setConnected(false);
        eventSource?.close();
        reconnectTimer = setTimeout(connect, 3000);
      };

      const handleEvent = (eventName: string) => (e: MessageEvent) => {
        try {
          const data: BastionEvent = JSON.parse(e.data);
          const event: BastionEvent = { ...data, type: eventName };
          setLatestEvent(event);
          setEventHistory((prev) => [event, ...prev].slice(0, 500));

          switch (eventName) {
            case 'AuditRecorded':
              onAuditRecorded?.(event);
              break;
            case 'HITLPending':
              onHITLPending?.(event);
              break;
            case 'HITLResolved':
              onHITLResolved?.(event);
              break;
          }
        } catch {
          // skip unparseable events
        }
      };

      eventSource.addEventListener('AuditRecorded', handleEvent('AuditRecorded'));
      eventSource.addEventListener('HITLPending', handleEvent('HITLPending'));
      eventSource.addEventListener('HITLResolved', handleEvent('HITLResolved'));
      eventSource.addEventListener('CircuitBreakerChanged', handleEvent('CircuitBreakerChanged'));
    };

    connect();

    return () => {
      clearTimeout(reconnectTimer);
      eventSource?.close();
    };
  }, [eventsUrl, enabled, onAuditRecorded, onHITLPending, onHITLResolved]);

  const clearHistory = useCallback(() => {
    setEventHistory([]);
    setLatestEvent(null);
  }, []);

  return {
    connected,
    latestEvent,
    eventHistory,
    clearHistory,
  };
}
