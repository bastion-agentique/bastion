import {
  BastionWeb2Client,
  Web2ProxyConfig,
  ProxyRequest,
  ProxyResponse,
  ProxyDecision,
  ApiPolicyRule,
} from "./index";

describe("BastionWeb2Client", () => {
  const config: Web2ProxyConfig = {
    proxyUrl: "http://localhost:4000",
    apiKey: "test-key",
  };

  let client: BastionWeb2Client;

  beforeEach(() => {
    client = new BastionWeb2Client(config);
  });

  it("creates with valid config", () => {
    expect(client).toBeDefined();
  });

  it("builds a ProxyRequest for HTTP calls", () => {
    const req = client.buildRequest("POST", "https://api.openai.com/v1/chat/completions", {
      "Content-Type": "application/json",
    }, JSON.stringify({ model: "gpt-4o", messages: [] }));

    expect(req.method).toBe("POST");
    expect(req.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(req.provider).toBe("openai");
    expect(typeof req.id).toBe("string");
  });

  it("detects provider from URL", () => {
    expect(client.detectProvider("https://api.openai.com/v1/models")).toBe("openai");
    expect(client.detectProvider("https://api.stripe.com/v1/charges")).toBe("stripe");
    expect(client.detectProvider("https://api.github.com/repos/foo/bar")).toBe("github");
    expect(client.detectProvider("https://slack.com/api/chat.postMessage")).toBe("slack");
    expect(client.detectProvider("https://random-site.com/api")).toBe("unknown");
  });
});

describe("ApiPolicyRule", () => {
  it("creates endpoint allowlist rule", () => {
    const rule: ApiPolicyRule = {
      type: "endpoint_allowlist",
      paths: ["/v1/chat/completions"],
      methods: ["POST"],
    };
    expect(rule.type).toBe("endpoint_allowlist");
    expect(rule.paths).toContain("/v1/chat/completions");
    expect(rule.methods).toContain("POST");
  });

  it("creates provider budget rule", () => {
    const rule: ApiPolicyRule = {
      type: "provider_budget",
      provider: "openai",
      maxUsdCentsPerWindow: 5000,
      windowMinutes: 1440,
    };
    expect(rule.type).toBe("provider_budget");
    expect(rule.provider).toBe("openai");
    expect(rule.maxUsdCentsPerWindow).toBe(5000);
  });

  it("creates content inspection rule", () => {
    const rule: ApiPolicyRule = {
      type: "content_inspection",
      detectPII: true,
      detectSecrets: true,
      detectPromptInjection: false,
    };
    expect(rule.type).toBe("content_inspection");
    expect(rule.detectSecrets).toBe(true);
  });
});

describe("ProxyDecision", () => {
  it("has correct decision types", () => {
    const pass: ProxyDecision = { decision: "pass" };
    expect(pass.decision).toBe("pass");

    const block: ProxyDecision = {
      decision: "block",
      reason: "budget exceeded",
      ruleId: "provider_budget",
    };
    expect(block.decision).toBe("block");
    expect(block.reason).toBe("budget exceeded");

    const hitl: ProxyDecision = {
      decision: "pending_hitl",
      reason: "high cost",
      approvalId: "abc123",
    };
    expect(hitl.decision).toBe("pending_hitl");
    expect(hitl.approvalId).toBe("abc123");
  });
});

describe("ProxyResponse", () => {
  it("types check for pass response", () => {
    const resp: ProxyResponse = {
      decision: "pass",
      proxied: true,
      statusCode: 200,
      body: '{"result": "ok"}',
    };
    expect(resp.proxied).toBe(true);
    expect(resp.statusCode).toBe(200);
  });

  it("types check for blocked response", () => {
    const resp: ProxyResponse = {
      decision: "block",
      proxied: false,
      reason: "endpoint not in allowlist",
      ruleId: "endpoint_allowlist",
    };
    expect(resp.proxied).toBe(false);
    expect(resp.reason).toBe("endpoint not in allowlist");
  });
});
