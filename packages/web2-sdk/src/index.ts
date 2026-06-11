/** Configuration for the Web2 proxy firewall client. */
export interface Web2ProxyConfig {
  proxyUrl: string;
  apiKey?: string;
}

/** An outgoing API request being sent through the firewall. */
export interface ProxyRequest {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  provider: string;
  agentId?: string;
  timestamp: number;
}

/** The decision returned by the proxy. */
export interface ProxyDecision {
  decision: "pass" | "block" | "pending_hitl" | "log_only";
  reason?: string;
  ruleId?: string;
  approvalId?: string;
}

/** The full proxy response. */
export interface ProxyResponse extends ProxyDecision {
  proxied: boolean;
  statusCode?: number;
  body?: string;
  headers?: Record<string, string>;
}

/** API-level policy rule. */
export interface ApiPolicyRule {
  type: string;
  paths?: string[];
  methods?: string[];
  patterns?: string[];
  provider?: string;
  maxUsdCentsPerWindow?: number;
  windowMinutes?: number;
  maxRequestsPerMinute?: number;
  detectPII?: boolean;
  detectSecrets?: boolean;
  detectPromptInjection?: boolean;
  allowHeaders?: string[];
  blockHeaders?: string[];
  maxUsdCentsPerMonth?: number;
  minHourUTC?: number;
  maxHourUTC?: number;
}

const PROVIDER_PATTERNS: [string, RegExp][] = [
  ["openai", /api\.openai\.com/],
  ["stripe", /api\.stripe\.com/],
  ["github", /api\.github\.com/],
  ["slack", /slack\.com\/api/],
  ["aws", /amazonaws\.com/],
];

/** Client for Bastion Web2 API gateway firewall. */
export class BastionWeb2Client {
  private proxyUrl: string;
  private headers: Record<string, string>;

  constructor(config: Web2ProxyConfig) {
    this.proxyUrl = config.proxyUrl.replace(/\/$/, "");
    this.headers = { "Content-Type": "application/json" };
    if (config.apiKey) {
      this.headers["X-API-Key"] = config.apiKey;
    }
  }

  /** Build a ProxyRequest object from HTTP call parameters. */
  buildRequest(
    method: string,
    url: string,
    headers: Record<string, string>,
    body?: string,
    agentId?: string,
  ): ProxyRequest {
    return {
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : `req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      method: method.toUpperCase(),
      url,
      headers,
      body,
      provider: this.detectProvider(url),
      agentId,
      timestamp: Math.floor(Date.now() / 1000),
    };
  }

  /** Detect the API provider from a URL. */
  detectProvider(url: string): string {
    for (const [name, pattern] of PROVIDER_PATTERNS) {
      if (pattern.test(url)) return name;
    }
    return "unknown";
  }

  /** Send a request through the proxy for evaluation. */
  async proxyRequest(req: ProxyRequest): Promise<ProxyResponse> {
    const res = await fetch(`${this.proxyUrl}/proxy`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(req),
    });
    return res.json() as Promise<ProxyResponse>;
  }

  /** Check if a request passes policy evaluation (without actually proxying). */
  async evaluate(req: ProxyRequest): Promise<ProxyDecision> {
    const res = await fetch(`${this.proxyUrl}/api/v2/evaluate`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(req),
    });
    return res.json() as Promise<ProxyDecision>;
  }

  /** Get current proxy policy configuration. */
  async getPolicy(): Promise<{ rules: ApiPolicyRule[] }> {
    const res = await fetch(`${this.proxyUrl}/policy`, {
      headers: this.headers,
    });
    return res.json() as Promise<{ rules: ApiPolicyRule[] }>;
  }

  /** Update proxy policy rules. */
  async updatePolicy(rules: ApiPolicyRule[]): Promise<{ rules: ApiPolicyRule[] }> {
    const res = await fetch(`${this.proxyUrl}/policy/full`, {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify({ rules }),
    });
    return res.json() as Promise<{ rules: ApiPolicyRule[] }>;
  }
}

export const Web2 = { PROVIDER_PATTERNS } as const;
