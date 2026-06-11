use super::ProviderAdapter;
use crate::ApiPolicyRule;

#[allow(dead_code)]
pub struct StripeAdapter;

impl ProviderAdapter for StripeAdapter {
    fn provider_name(&self) -> &'static str {
        "stripe"
    }

    fn base_urls(&self) -> Vec<&'static str> {
        vec!["https://api.stripe.com"]
    }

    fn default_rules(&self) -> Vec<ApiPolicyRule> {
        vec![
            ApiPolicyRule::EndpointAllowlist {
                paths: vec![
                    "/v1/charges".to_string(),
                    "/v1/customers".to_string(),
                    "/v1/payment_intents".to_string(),
                    "/v1/refunds".to_string(),
                ],
                methods: vec!["GET".to_string(), "POST".to_string()],
            },
            ApiPolicyRule::ContentInspection {
                detect_pii: true,
                detect_secrets: true,
                detect_prompt_injection: false,
            },
        ]
    }
}
