#[cfg(test)]
mod tests {
    use crate::{
        ArciumClient, ArciumError, ArcumPolicyEvaluator, MxeConfig, MxeResult, NoopArciumClient,
    };
    use bastion_core::{
        FirewallDecision, NormalizedTransaction, PolicyEvaluator, PolicyRule, PolicySet, TxType,
        transaction::Chain,
        risk::{RiskOracle, RiskScore, RiskOracleError},
        Address,
    };

    /// Mock risk oracle for testing.
    struct MockRiskOracle;

    #[async_trait::async_trait]
    impl RiskOracle for MockRiskOracle {
        async fn score(&self, _address: &Address) -> Result<RiskScore, RiskOracleError> {
            Ok(RiskScore(0))
        }
        fn provider_name(&self) -> &str {
            "mock"
        }
    }

    /// Mock Arcium client that returns configurable decisions.
    struct MockArciumClient {
        decision: FirewallDecision,
    }

    impl MockArciumClient {
        fn pass() -> Self {
            Self {
                decision: FirewallDecision::Pass,
            }
        }

        fn block(reason: &str) -> Self {
            Self {
                decision: FirewallDecision::Block {
                    reason: reason.into(),
                    policy_id: None,
                },
            }
        }
    }

    #[async_trait::async_trait]
    impl ArciumClient for MockArciumClient {
        async fn evaluate(
            &self,
            _config: &MxeConfig,
            _tx_data: &[u8],
        ) -> Result<MxeResult, ArciumError> {
            Ok(MxeResult {
                decision: self.decision.clone(),
                signature: vec![1, 2, 3],
                computation_hash: [42u8; 32],
            })
        }
    }

    /// Mock Arcium client that always errors.
    struct FailingArciumClient;

    #[async_trait::async_trait]
    impl ArciumClient for FailingArciumClient {
        async fn evaluate(
            &self,
            _config: &MxeConfig,
            _tx_data: &[u8],
        ) -> Result<MxeResult, ArciumError> {
            Err(ArciumError::Timeout(5000))
        }
    }

    fn test_tx() -> NormalizedTransaction {
        NormalizedTransaction::new(
            "agent-1",
            "from-addr",
            "to-addr",
            500_000_000,
            "SOL",
            TxType::Transfer,
            Chain::Solana,
        )
    }

    fn test_policy() -> PolicySet {
        PolicySet::new().with_rule(PolicyRule::AmountLimit {
            max_per_transaction: 1_000_000_000,
            max_per_24h: None,
            currency: "SOL".into(),
        })
    }

    fn test_config() -> MxeConfig {
        MxeConfig {
            cluster_id: "test".into(),
            mxe_id: "mxe-1".into(),
            computation_timeout: 5000,
            required_nodes: 1,
        }
    }

    fn blocking_tx() -> NormalizedTransaction {
        NormalizedTransaction::new(
            "agent-1",
            "from-addr",
            "to-addr",
            5_000_000_000,
            "SOL",
            TxType::Transfer,
            Chain::Solana,
        )
    }

    #[tokio::test]
    async fn noop_client_returns_pass() {
        let client = NoopArciumClient;
        let config = test_config();
        let result = client.evaluate(&config, b"test-data").await.unwrap();
        assert!(result.decision.is_allowed());
        assert!(result.signature.is_empty());
        assert_eq!(result.computation_hash, [0u8; 32]);
    }

    #[tokio::test]
    async fn noop_client_satisfies_trait() {
        let client: Box<dyn ArciumClient> = Box::new(NoopArciumClient);
        let config = test_config();
        let result = client.evaluate(&config, b"test").await.unwrap();
        assert!(matches!(result.decision, FirewallDecision::Pass));
    }

    #[tokio::test]
    async fn local_evaluator_passes_under_limit() {
        let evaluator: PolicyEvaluator<MockRiskOracle> = PolicyEvaluator::new();
        let tx = test_tx();
        let policy = test_policy();
        let decision = evaluator.evaluate(&tx, &policy).await;
        assert!(decision.is_allowed());
    }

    #[tokio::test]
    async fn local_evaluator_blocks_over_limit() {
        let evaluator: PolicyEvaluator<MockRiskOracle> = PolicyEvaluator::new();
        let tx = blocking_tx();
        let policy = test_policy();
        let decision = evaluator.evaluate(&tx, &policy).await;
        assert!(decision.is_blocked());
    }

    #[tokio::test]
    async fn mxe_config_serializes() {
        let config = MxeConfig {
            cluster_id: "mainnet-alpha".into(),
            mxe_id: "mxe-001".into(),
            computation_timeout: 10000,
            required_nodes: 3,
        };
        let json = serde_json::to_string(&config).unwrap();
        assert!(json.contains("mainnet-alpha"));
        assert!(json.contains("mxe-001"));
        let deserialized: MxeConfig = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.cluster_id, "mainnet-alpha");
        assert_eq!(deserialized.required_nodes, 3);
    }

    #[test]
    fn arcium_error_display() {
        let err = ArciumError::Timeout(5000);
        assert!(err.to_string().contains("5000"));
        let err = ArciumError::InsufficientNodes { required: 3, available: 1 };
        assert!(err.to_string().contains("3"));
        let err = ArciumError::CircuitError("test failure".into());
        assert!(err.to_string().contains("test failure"));
        let err = ArciumError::SignatureVerificationFailed;
        assert!(err.to_string().contains("Signature verification failed"));
    }

    #[test]
    fn chain_enum_has_all_variants() {
        assert_eq!(
            [Chain::Solana, Chain::Base, Chain::Ethereum, Chain::Polygon, Chain::Arbitrum, Chain::Celo].len(),
            6
        );
    }

    #[test]
    fn firewall_decision_helpers() {
        assert!(FirewallDecision::Pass.is_allowed());
        assert!(!FirewallDecision::Pass.is_blocked());
        assert!(!FirewallDecision::Pass.is_pending_hitl());

        let block = FirewallDecision::Block { reason: "test".into(), policy_id: None };
        assert!(!block.is_allowed());
        assert!(block.is_blocked());

        let hitl = FirewallDecision::PendingHITL { approval_id: "123".into(), reason: "review".into() };
        assert!(hitl.is_pending_hitl());
    }

    #[tokio::test]
    async fn arcium_passes_through_to_local() {
        let mock = MockArciumClient::pass();
        let evaluator: ArcumPolicyEvaluator<MockArciumClient, MockRiskOracle> =
            ArcumPolicyEvaluator::new(mock, test_config());
        let tx = test_tx();
        let policy = test_policy();
        let decision = evaluator.evaluate(&tx, &policy).await;
        // Mock returns Pass, so Arcium decision is used
        assert!(decision.is_allowed());
    }

    #[tokio::test]
    async fn arcium_blocks_override_local() {
        let mock = MockArciumClient::block("Arcium says no");
        let evaluator: ArcumPolicyEvaluator<MockArciumClient, MockRiskOracle> =
            ArcumPolicyEvaluator::new(mock, test_config());
        let tx = test_tx(); // Would pass local eval (0.5 SOL < 1 SOL limit)
        let policy = test_policy();
        let decision = evaluator.evaluate(&tx, &policy).await;
        // Arcium says Block, so we return Block
        assert!(decision.is_blocked());
    }

    #[tokio::test]
    async fn arcium_timeout_falls_back_to_local() {
        let failing = FailingArciumClient;
        let evaluator: ArcumPolicyEvaluator<FailingArciumClient, MockRiskOracle> =
            ArcumPolicyEvaluator::new(failing, test_config())
            .with_fallback(true);
        let tx = test_tx(); // 0.5 SOL — passes local eval
        let policy = test_policy();
        let decision = evaluator.evaluate(&tx, &policy).await;
        // Arcium failed, fallback to local → Pass
        assert!(decision.is_allowed());
    }

    #[tokio::test]
    async fn arcium_timeout_blocks_without_fallback() {
        let failing = FailingArciumClient;
        let evaluator: ArcumPolicyEvaluator<FailingArciumClient, MockRiskOracle> =
            ArcumPolicyEvaluator::new(failing, test_config())
            .with_fallback(false);
        let tx = test_tx();
        let policy = test_policy();
        let decision = evaluator.evaluate(&tx, &policy).await;
        // Arcium failed, no fallback → Block
        assert!(decision.is_blocked());
    }

    #[tokio::test]
    async fn evaluator_chain_filter() {
        // Arcium should only run for Solana chain
        let mock = MockArciumClient::pass();
        let evaluator: ArcumPolicyEvaluator<MockArciumClient, MockRiskOracle> =
            ArcumPolicyEvaluator::new(mock, test_config());
        let tx = NormalizedTransaction::new(
            "agent-1",
            "0xfrom",
            "0xto",
            500_000_000,
            "ETH",
            TxType::Transfer,
            Chain::Base, // EVM chain, not Solana
        );
        let policy = test_policy();
        let decision = evaluator.evaluate(&tx, &policy).await;
        // Should fall back to local evaluation (no Arcium for EVM)
        assert!(decision.is_allowed());
    }
}
