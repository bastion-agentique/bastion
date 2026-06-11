use super::ProviderAdapter;
use crate::ApiPolicyRule;

#[allow(dead_code)]
pub struct OpenAIAdapter;

impl ProviderAdapter for OpenAIAdapter {
    fn provider_name(&self) -> &'static str {
        "openai"
    }

    fn base_urls(&self) -> Vec<&'static str> {
        vec!["https://api.openai.com"]
    }

    fn default_rules(&self) -> Vec<ApiPolicyRule> {
        vec![
            ApiPolicyRule::EndpointAllowlist {
                paths: vec![
                    "/v1/chat/completions".to_string(),
                    "/v1/completions".to_string(),
                    "/v1/embeddings".to_string(),
                    "/v1/models".to_string(),
                ],
                methods: vec!["GET".to_string(), "POST".to_string()],
            },
            ApiPolicyRule::ContentInspection {
                detect_pii: true,
                detect_secrets: true,
                detect_prompt_injection: true,
            },
            ApiPolicyRule::CostCap {
                max_usd_cents_per_month: 100_000, // $1000
            },
        ]
    }
}
