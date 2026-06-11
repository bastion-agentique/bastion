use super::ProviderAdapter;
use crate::ApiPolicyRule;

#[allow(dead_code)]
pub struct GitHubAdapter;

impl ProviderAdapter for GitHubAdapter {
    fn provider_name(&self) -> &'static str {
        "github"
    }

    fn base_urls(&self) -> Vec<&'static str> {
        vec!["https://api.github.com"]
    }

    fn default_rules(&self) -> Vec<ApiPolicyRule> {
        vec![
            ApiPolicyRule::EndpointAllowlist {
                paths: vec![
                    "/repos/*/pulls".to_string(),
                    "/repos/*/issues".to_string(),
                    "/repos/*/contents/*".to_string(),
                    "/user".to_string(),
                ],
                methods: vec!["GET".to_string(), "POST".to_string(), "PATCH".to_string()],
            },
            ApiPolicyRule::ContentInspection {
                detect_pii: false,
                detect_secrets: true,
                detect_prompt_injection: false,
            },
            ApiPolicyRule::RateLimitPerProvider {
                provider: "github".to_string(),
                max_requests_per_minute: 100,
            },
        ]
    }
}
