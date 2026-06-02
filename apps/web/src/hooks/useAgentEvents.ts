import { useEffect, useState, useCallback } from 'react';

interface AgentEvent {
  agent_id: string;
  timestamp: number;
  decision: string;
  intent: string;
  tx_signature: string;
}

const SIDECAR_URL = import.meta.env.VITE_SIDECAR_URL || 'http://localhost:3000';

export function useAgentEvents() {
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(() => {
    try {
      const es = new EventSource(`${SIDECAR_URL}/events`);

      es.onopen = () => {
        setConnected(true);
        setError(null);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'ping') return;
          setEvents((prev) => {
            const next = [data as AgentEvent, ...prev];
            return next.slice(0, 200);
          });
        } catch {
          // ignore parse errors
        }
      };

      es.onerror = () => {
        setConnected(false);
        setError('Event stream disconnected. Retrying...');
        es.close();
        setTimeout(connect, 5000);
      };

      return es;
    } catch {
      setError('SSE not available. Start the sidecar on port 3000.');
      return null;
    }
  }, []);

  useEffect(() => {
    const es = connect();
    return () => { es?.close(); };
  }, [connect]);

  return { events, connected, error };
}
