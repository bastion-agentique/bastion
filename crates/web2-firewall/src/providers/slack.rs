use super::ProviderAdapter;
use crate::ApiPolicyRule;

#[allow(dead_code)]
pub struct SlackAdapter;

impl ProviderAdapter for SlackAdapter {
    fn provider_name(&self) -> &'static str {
        "slack"
    }

    fn base_urls(&self) -> Vec<&'static str> {
        vec!["https://slack.com/api"]
    }

    fn default_rules(&self) -> Vec<ApiPolicyRule> {
        vec![
            ApiPolicyRule::EndpointAllowlist {
                paths: vec![
                    "/api/chat.postMessage".to_string(),
                    "/api/chat.update".to_string(),
                    "/api/conversations.list".to_string(),
                    "/api/users.list".to_string(),
                ],
                methods: vec!["GET".to_string(), "POST".to_string()],
            },
            ApiPolicyRule::RateLimitPerProvider {
                provider: "slack".to_string(),
                max_requests_per_minute: 60,
            },
        ]
    }
}
