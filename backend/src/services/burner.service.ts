import { createHash } from "crypto";
import { entropyToMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ─── Dérivation mnémonique déterministe ──────────────────────────────────────

function mnemonicFromSeed(seed: string): string {
  // SHA256 du seed → 16 premiers octets → entropie 128 bits → 12 mots BIP39
  const entropy = createHash("sha256").update(seed).digest().subarray(0, 16);
  return entropyToMnemonic(entropy, wordlist);
}

/**
 * Dérive le mnémonique BIP39 du BurnerA depuis son adresse CREATE2.
 * L'adresse est déterministe (requestId + nonce) — le backend la reçoit
 * via l'event PaymentInstructed et reconstruit toujours le même mnémonique.
 * Jamais stocké, recalculé à la volée.
 */
export function deriveBurnerMnemonic(burnerAddress: string): string {
  return mnemonicFromSeed(`sleepay.burner.${burnerAddress.toLowerCase()}.v1`);
}

/**
 * Mnémonique Unlink du relayer — utilisé comme compte de transit pour le Cas 3.
 * Dérivé de la clé privée EVM du relayer → stable entre les redémarrages.
 */
export function deriveRelayerMnemonic(): string {
  const masterKey = process.env.EVM_PRIVATE_KEY!;
  return mnemonicFromSeed(`sleepay.relayer.unlink.v1.${masterKey}`);
}

/**
 * Compte EVM one-shot déterministe pour le Cas 3 (wallet classique → Sleepmask).
 * Seul le backend peut le reconstruire (nécessite EVM_PRIVATE_KEY).
 * Chaque requestId génère un compte EVM unique.
 */
export function deriveOneshotAccount(requestId: string) {
  const masterKey = process.env.EVM_PRIVATE_KEY!;
  const seed = `sleepay.oneshot.${requestId.toLowerCase()}.v1.${masterKey}`;
  const privKey = `0x${createHash("sha256").update(seed).digest("hex")}` as `0x${string}`;
  return privateKeyToAccount(privKey);
}

/**
 * Mnémonique éphémère pour Cas 2 sans request on-chain.
 * Non déterministe (basé sur timestamp) — usage unique.
 */
export function deriveEphemeralBurnerMnemonic(aliceMnemonicPrefix: string): string {
  return mnemonicFromSeed(`ephemeral.${Date.now()}.${aliceMnemonicPrefix}`);
}

/**
 * Wallet client viem pour le compte one-shot — utilisé pour signer le sweep ERC20.
 */
export function buildOneshotClients(requestId: string) {
  const account = deriveOneshotAccount(requestId);
  const rpcUrl  = process.env.RPC_URL || "https://sepolia.base.org";

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });

  return { account, publicClient, walletClient };
}
