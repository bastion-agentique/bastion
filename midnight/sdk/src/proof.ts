import { createHash } from "crypto";

/**
 * Derive a ZK commitment from an agent address and secret.
 * commitment = SHA256(agentAddress || secret || nonce)
 *
 * In production this would use Midnight's native persistentHash
 * (Jubjub curve based). Using SHA256 here for portability in off-chain code.
 */
export function deriveAgentCommitment(
  agentAddress: string,
  secret: Uint8Array,
  nonce: number = 0
): string {
  const data = Buffer.concat([
    Buffer.from(agentAddress.replace("0x", ""), "hex"),
    Buffer.from(secret),
    Buffer.from(nonce.toString()),
  ]);
  return "0x" + createHash("sha256").update(data).digest("hex");
}

/**
 * Derive a policy commitment from policy parameters.
 * policyCommitment = SHA256(serializedPolicy || ownerSecret)
 */
export function derivePolicyCommitment(
  policy: {
    allowedTargetIds: string[];
    allowedSelectors: string[];
    maxValuePerTx: bigint;
    dailyTxLimit: number;
    cooldownSeconds: number;
  },
  ownerSecret: Uint8Array
): string {
  const serialized = JSON.stringify({
    t: policy.allowedTargetIds.sort(),
    s: policy.allowedSelectors.sort(),
    v: policy.maxValuePerTx.toString(),
    d: policy.dailyTxLimit,
    c: policy.cooldownSeconds,
  });
  const data = Buffer.concat([
    Buffer.from(serialized, "utf-8"),
    Buffer.from(ownerSecret),
  ]);
  return "0x" + createHash("sha256").update(data).digest("hex");
}

/**
 * Derive an audit entry commitment.
 * commitment = SHA256(agentId || target || value || selector || allowed || nonce)
 */
export function deriveAuditCommitment(
  agentId: string,
  target: string,
  value: bigint,
  selector: string,
  allowed: boolean,
  nonce: string
): string {
  const serialized = [agentId, target, value.toString(), selector, String(allowed), nonce].join("|");
  return "0x" + createHash("sha256").update(serialized, "utf-8").digest("hex");
}

/**
 * Derive the on-chain agentId commitment from the agent address and secret.
 * This is what gets stored in agentEntryCount as the lookup key.
 */
export function deriveAgentIdCommitment(
  agentId: string,
  secret: Uint8Array
): string {
  const data = Buffer.concat([
    Buffer.from(agentId.replace("0x", ""), "hex"),
    Buffer.from(secret),
  ]);
  return "0x" + createHash("sha256").update(data).digest("hex");
}

/**
 * Generate a deterministic entry ID from agent, target, selector and timestamp.
 */
export function deriveEntryId(
  agentId: string,
  target: string,
  selector: string,
  timestamp: number,
  count: number
): string {
  const data = [agentId, target, selector, timestamp.toString(), count.toString()].join("|");
  return "0x" + createHash("sha256").update(data, "utf-8").digest("hex");
}
