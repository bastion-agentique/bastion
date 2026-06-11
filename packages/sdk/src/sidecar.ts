import { BastionEventStream } from "./types";
import type {
  SidecarConfig,
  SimulateRequest,
  SimulateResponse,
  LogsQuery,
  LogsResponse,
  SidecarPolicy,
  HealthResponse,
  OverrideRequest,
  CircuitBreakerStatus,
  EvmSimulateRequest,
  EvmSimulateResponse,
} from "./types";

export class BastionSidecar {
  private baseUrl: string;
  private headers: Record<string, string>;

  constructor(config: SidecarConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) {
      this.headers["X-API-Key"] = config.apiKey;
    }
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.baseUrl}${path}`;
    if (query) {
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined) params.set(k, String(v));
      }
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    const res = await fetch(url, {
      method,
      headers: this.headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const json = await res.json();

    if (!res.ok) {
      const err = (json as { error?: string }).error ?? res.statusText;
      const e = Object.assign(new Error(err), {
        status: res.status,
        body: json,
      });
      throw e;
    }

    return json as T;
  }

  health(): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health");
  }

  simulate(req: SimulateRequest): Promise<SimulateResponse> {
    return this.request<SimulateResponse>("POST", "/simulate", req);
  }

  logs(query?: LogsQuery): Promise<LogsResponse> {
    return this.request<LogsResponse>("GET", "/logs", undefined, query as Record<string, string | number | undefined>);
  }

  approve(req: OverrideRequest): Promise<SimulateResponse | { error: string }> {
    return this.request("POST", "/override", req);
  }

  getPolicy(): Promise<SidecarPolicy> {
    return this.request<SidecarPolicy>("GET", "/policy");
  }

  updatePolicy(policy: Partial<SidecarPolicy>): Promise<SidecarPolicy> {
    return this.request<SidecarPolicy>("POST", "/policy/full", policy);
  }

  circuitBreakerStatus(): Promise<CircuitBreakerStatus> {
    return this.request<CircuitBreakerStatus>("GET", "/circuit-breaker/status");
  }

  engageCircuitBreaker(): Promise<CircuitBreakerStatus> {
    return this.request<CircuitBreakerStatus>("POST", "/circuit-breaker/engage");
  }

  disengageCircuitBreaker(): Promise<CircuitBreakerStatus> {
    return this.request<CircuitBreakerStatus>("POST", "/circuit-breaker/disengage");
  }

  simulateEvm(req: EvmSimulateRequest): Promise<EvmSimulateResponse> {
    return this.request<EvmSimulateResponse>("POST", "/api/v2/simulate-evm", req);
  }

  events(): BastionEventStream {
    const controller = new AbortController();
    const headers: Record<string, string> = {};
    if (this.headers["X-API-Key"]) {
      headers["X-API-Key"] = this.headers["X-API-Key"];
    }
    return new BastionEventStream(`${this.baseUrl}/events`, controller, headers);
  }
}
