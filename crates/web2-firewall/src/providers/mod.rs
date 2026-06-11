use crate::ApiPolicyRule;

pub mod github;
pub mod openai;
pub mod slack;
pub mod stripe;

#[allow(dead_code)]
pub trait ProviderAdapter: Send + Sync {
    fn provider_name(&self) -> &'static str;
    fn default_rules(&self) -> Vec<ApiPolicyRule>;
    fn base_urls(&self) -> Vec<&'static str>;
}
