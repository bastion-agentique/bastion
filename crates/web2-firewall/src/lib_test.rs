use crate::{ApiEvent, ApiPolicyRule, OpenApiSpec, ProxyDecision, ProxyEngine};

// ── ApiEvent Tests ──

#[test]
fn api_event_creation() {
    let event = ApiEvent {
        id: uuid::Uuid::new_v4().to_string(),
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/chat/completions".to_string(),
        headers: vec![("Content-Type".to_string(), "application/json".to_string())],
        body: r#"{"model":"gpt-4o","messages":[]}"#.to_string(),
        provider: "openai".to_string(),
        agent_id: "did:bastion:solana:abc".to_string(),
        timestamp: 1715000000,
    };

    assert_eq!(event.method, "POST");
    assert_eq!(event.provider, "openai");
    assert_eq!(event.agent_id, "did:bastion:solana:abc");
}

#[test]
fn api_event_serialization() {
    let event = ApiEvent {
        id: "evt_001".to_string(),
        method: "GET".to_string(),
        url: "https://api.stripe.com/v1/charges".to_string(),
        headers: vec![],
        body: "".to_string(),
        provider: "stripe".to_string(),
        agent_id: "did:bastion:solana:xyz".to_string(),
        timestamp: 1715000000,
    };

    let json = serde_json::to_string(&event).unwrap();
    let back: ApiEvent = serde_json::from_str(&json).unwrap();
    assert_eq!(back.id, "evt_001");
    assert_eq!(back.method, "GET");
    assert_eq!(back.provider, "stripe");
}

// ── ProxyDecision Tests ──

#[test]
fn proxy_decision_variants() {
    let pass = ProxyDecision::Pass;
    assert!(pass.is_allowed());

    let block = ProxyDecision::Block {
        reason: "budget exceeded".to_string(),
        rule_id: Some("provider-budget".to_string()),
    };
    assert!(block.is_blocked());
    if let ProxyDecision::Block { reason, .. } = &block {
        assert_eq!(reason, "budget exceeded");
    }

    let hitl = ProxyDecision::PendingHITL {
        approval_id: "abc123".to_string(),
        reason: "high-cost request".to_string(),
    };
    assert!(hitl.is_pending());
}

#[test]
fn proxy_decision_converts_from_firewall_decision() {
    let fd = bastion_core::FirewallDecision::Pass;
    let pd = ProxyDecision::from(fd);
    assert!(pd.is_allowed());

    let fd = bastion_core::FirewallDecision::Block {
        reason: "test block".to_string(),
        policy_id: None,
    };
    let pd = ProxyDecision::from(fd);
    assert!(pd.is_blocked());
}

// ── ApiPolicyRule Tests ──

#[test]
fn endpoint_allowlist_rule_matching() {
    let rule = ApiPolicyRule::EndpointAllowlist {
        paths: vec!["/v1/chat/completions".to_string()],
        methods: vec!["POST".to_string()],
    };

    let event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/chat/completions".to_string(),
        headers: vec![],
        body: "".to_string(),
        provider: "openai".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    // matches() returns true = should BLOCK. Event IS in allowlist → no block needed
    assert!(!rule.matches(&event));

    let event_blocked = ApiEvent {
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/fine-tunes".to_string(),
        ..event.clone()
    };
    // Event IS NOT in allowlist → should block → matches() returns true
    assert!(rule.matches(&event_blocked));
}

#[test]
fn provider_budget_rule_tracking() {
    let rule = ApiPolicyRule::ProviderBudget {
        provider: "openai".to_string(),
        max_usd_cents_per_window: 5000, // $50
        window_minutes: 1440,           // 24h
    };

    let event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/chat/completions".to_string(),
        headers: vec![("x-cost-cents".to_string(), "1200".to_string())],
        body: "".to_string(),
        provider: "openai".to_string(),
        agent_id: "a".to_string(),
        timestamp: 100,
    };

    // First call: should match (under budget)
    assert!(rule.matches(&event));
}

#[test]
fn endpoint_blocklist_rule() {
    let rule = ApiPolicyRule::EndpointBlocklist {
        patterns: vec!["/v1/fine-tunes".to_string(), "/v1/admin".to_string()],
    };

    let blocked_event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/admin/keys".to_string(),
        headers: vec![],
        body: "".to_string(),
        provider: "openai".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    assert!(rule.matches(&blocked_event));

    let allowed_event = ApiEvent {
        url: "https://api.openai.com/v1/chat/completions".to_string(),
        ..blocked_event
    };
    assert!(!rule.matches(&allowed_event));
}

#[test]
fn rate_limit_rule() {
    let rule = ApiPolicyRule::RateLimitPerProvider {
        provider: "github".to_string(),
        max_requests_per_minute: 10,
    };

    let event = ApiEvent {
        id: "1".to_string(),
        method: "GET".to_string(),
        url: "https://api.github.com/repos/bastion/bastion".to_string(),
        headers: vec![],
        body: "".to_string(),
        provider: "github".to_string(),
        agent_id: "a".to_string(),
        timestamp: 60,
    };

    assert!(rule.matches(&event));
}

// ── ProxyEngine Tests ──

#[test]
fn proxy_engine_empty_rules_allows_all() {
    let engine = ProxyEngine::new(vec![]);
    let event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/chat/completions".to_string(),
        headers: vec![],
        body: "".to_string(),
        provider: "openai".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    let decision = engine.evaluate(&event);
    assert!(decision.is_allowed());
}

#[test]
fn proxy_engine_blocks_on_endpoint_blocklist() {
    let engine = ProxyEngine::new(vec![ApiPolicyRule::EndpointBlocklist {
        patterns: vec!["/v1/admin".to_string()],
    }]);

    let event = ApiEvent {
        id: "1".to_string(),
        method: "GET".to_string(),
        url: "https://api.openai.com/v1/admin/keys".to_string(),
        headers: vec![],
        body: "".to_string(),
        provider: "openai".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    let decision = engine.evaluate(&event);
    assert!(decision.is_blocked());
}

#[test]
fn proxy_engine_allows_on_allowlist_match() {
    let engine = ProxyEngine::new(vec![ApiPolicyRule::EndpointAllowlist {
        paths: vec![
            "/v1/chat/completions".to_string(),
            "/v1/embeddings".to_string(),
        ],
        methods: vec!["POST".to_string(), "GET".to_string()],
    }]);

    let event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/chat/completions".to_string(),
        headers: vec![],
        body: "".to_string(),
        provider: "openai".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    assert!(engine.evaluate(&event).is_allowed());
}

#[test]
fn proxy_engine_blocks_when_allowlist_mismatches_path() {
    let engine = ProxyEngine::new(vec![ApiPolicyRule::EndpointAllowlist {
        paths: vec!["/v1/chat/completions".to_string()],
        methods: vec!["POST".to_string()],
    }]);

    let event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/fine-tunes".to_string(),
        headers: vec![],
        body: "".to_string(),
        provider: "openai".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    assert!(engine.evaluate(&event).is_blocked());
}

// ── Content Inspection Tests ──

#[test]
fn detects_openai_api_key_in_body() {
    let event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://api.github.com/repos/bastion/bastion".to_string(),
        headers: vec![],
        body: r#"{"key": "sk-proj-abc123xyz"}"#.to_string(),
        provider: "github".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    let rule = ApiPolicyRule::ContentInspection {
        detect_pii: true,
        detect_secrets: true,
        detect_prompt_injection: false,
    };

    assert!(rule.matches(&event));
}

#[test]
fn clean_body_passes_inspection() {
    let event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://api.openai.com/v1/chat/completions".to_string(),
        headers: vec![],
        body: r#"{"model":"gpt-4o","messages":[{"role":"user","content":"hello"}]}"#.to_string(),
        provider: "openai".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    let rule = ApiPolicyRule::ContentInspection {
        detect_pii: true,
        detect_secrets: true,
        detect_prompt_injection: false,
    };

    assert!(!rule.matches(&event));
}

// ── OpenAPI Spec Tests ──

#[test]
fn openapi_parses_minimal_spec() {
    let spec_json = r#"{
        "openapi": "3.0.0",
        "info": { "title": "Test API", "version": "1.0.0" },
        "paths": {
            "/v1/completions": {
                "post": {
                    "summary": "Create completion",
                    "operationId": "createCompletion"
                }
            },
            "/v1/models": {
                "get": {
                    "summary": "List models"
                }
            }
        }
    }"#;

    let spec = OpenApiSpec::from_json(spec_json).unwrap();
    assert_eq!(spec.title(), "Test API");
    assert_eq!(spec.version(), "1.0.0");

    let endpoints = spec.endpoint_allowlist();
    assert!(endpoints.contains(&("/v1/completions".to_string(), "POST".to_string())));
    assert!(endpoints.contains(&("/v1/models".to_string(), "GET".to_string())));
    assert_eq!(endpoints.len(), 2);
}

#[test]
fn openapi_generates_allowlist_rule() {
    let spec_json = r#"{
        "openapi": "3.0.0",
        "info": { "title": "OpenAI", "version": "1.0.0" },
        "paths": {
            "/v1/chat/completions": {
                "post": { "summary": "Chat completion" }
            },
            "/v1/embeddings": {
                "post": { "summary": "Create embeddings" }
            }
        }
    }"#;

    let spec = OpenApiSpec::from_json(spec_json).unwrap();
    let rule = spec.to_allowlist_rule();
    if let ApiPolicyRule::EndpointAllowlist { paths, methods } = &rule {
        assert!(paths.contains(&"/v1/chat/completions".to_string()));
        assert!(paths.contains(&"/v1/embeddings".to_string()));
        assert!(methods.contains(&"POST".to_string()));
    } else {
        panic!("Expected EndpointAllowlist rule");
    }
}

// ── Header Filter Tests ──

#[test]
fn header_filter_strips_authorization() {
    let rule = ApiPolicyRule::HeaderFilter {
        allow_headers: vec!["content-type".to_string(), "x-request-id".to_string()],
        block_headers: vec!["authorization".to_string(), "x-api-key".to_string()],
    };

    let event = ApiEvent {
        id: "1".to_string(),
        method: "POST".to_string(),
        url: "https://example.com".to_string(),
        headers: vec![
            ("content-type".to_string(), "application/json".to_string()),
            ("authorization".to_string(), "Bearer secret".to_string()),
            ("x-request-id".to_string(), "1234".to_string()),
        ],
        body: "".to_string(),
        provider: "generic".to_string(),
        agent_id: "a".to_string(),
        timestamp: 0,
    };

    assert!(rule.matches_any_blocked_header(&event));
}

// ── Provider Detection Test ──

#[test]
fn detects_provider_from_url() {
    assert_eq!(
        ProxyEngine::detect_provider("https://api.openai.com/v1/chat/completions"),
        Some("openai")
    );
    assert_eq!(
        ProxyEngine::detect_provider("https://api.stripe.com/v1/charges"),
        Some("stripe")
    );
    assert_eq!(
        ProxyEngine::detect_provider("https://api.github.com/repos/bastion/bastion"),
        Some("github")
    );
    assert_eq!(
        ProxyEngine::detect_provider("https://slack.com/api/chat.postMessage"),
        Some("slack")
    );
    assert_eq!(
        ProxyEngine::detect_provider("https://random-website.com/data"),
        None
    );
}
