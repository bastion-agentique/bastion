/**
 * x402 payment verification for Solana transactions.
 * Verifies on-chain SOL transfers as payment proof for MCP tool calls.
 * Uses RPC polling (2s intervals, 5 confirmations max).
 */

import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';

export interface PaymentVerification {
  verified: boolean;
  reason?: string;
  amount?: number;
  sender?: string;
}

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC, 'confirmed');

// Default treasury address — set via BASTION_TREASURY env var
const TREASURY = process.env.BASTION_TREASURY || 'E9PsSz9XWgNR3TmSC57NHC2ZxJzF5NmbrWsDKEe7A7yM';

/**
 * Verify a Solana transaction paid the required amount to the treasury.
 * 
 * @param txHash - Solana transaction signature
 * @param minAmountSol - Minimum SOL required (e.g. 0.001)
 * @param deadline - Unix timestamp the payment must have been made before
 */
export async function verifySolanaPayment(
  txHash: string,
  minAmountSol: number,
  deadline?: number,
): Promise<PaymentVerification> {
  // Poll for transaction with retries
  let parsed: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      parsed = await connection.getParsedTransaction(txHash, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      if (parsed) break;
    } catch (e) {
      console.error(`[x402] RPC poll attempt ${attempt + 1} failed:`, e);
    }
    await new Promise(r => setTimeout(r, 2000));
  }

  if (!parsed) {
    return { verified: false, reason: `Transaction ${txHash} not found or not yet confirmed` };
  }

  // Check block time vs deadline
  if (deadline && parsed.blockTime && parsed.blockTime > deadline) {
    return { verified: false, reason: `Payment expired. Block time ${parsed.blockTime} > deadline ${deadline}` };
  }

  // Parse Solana transfer instructions
  const instructions = parsed.transaction?.message?.instructions ?? [];
  const treasuryPubkey = new PublicKey(TREASURY);

  for (const ix of instructions) {
    // Look for SystemProgram.transfer or token transfer to treasury
    if (ix.program === 'system' && ix.parsed?.type === 'transfer') {
      const dest = ix.parsed.info.destination;
      const amount = ix.parsed.info.lamports / LAMPORTS_PER_SOL;

      if (dest === TREASURY) {
        if (amount >= minAmountSol) {
          return {
            verified: true,
            amount,
            sender: ix.parsed.info.source,
          };
        }
        return {
          verified: false,
          reason: `Insufficient payment: ${amount} SOL < ${minAmountSol} SOL required`,
        };
      }
    }
  }

  return { verified: false, reason: `No SOL transfer to treasury ${TREASURY} found in transaction ${txHash}` };
}
