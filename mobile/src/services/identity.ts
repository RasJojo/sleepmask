/**
 * identity.ts — Dérivation de l'identité Unlink depuis le wallet Dynamic.
 *
 * Flow zero-trust :
 * 1. Dynamic wallet signe un message fixe
 * 2. La signature est hashée → seed de 32 bytes
 * 3. La seed est convertie en mnemonic BIP39 (12 mots)
 * 4. La mnemonic est utilisée pour init l'identité Unlink
 * 5. Elle n'est JAMAIS stockée — recalculée à chaque session
 *
 * NOTE : La dérivation BIP39 finale nécessite une lib crypto.
 * À brancher avec : react-native-bip39 ou ethers.js HDNode
 */

import { useDynamicContext } from "@dynamic-labs/sdk-react-native";

const IDENTITY_MESSAGE = "sleepay-identity-v1";

/**
 * Dérive la mnemonic Unlink depuis la signature Dynamic.
 * À appeler une seule fois par session, juste après connexion.
 */
export async function deriveUnlinkMnemonic(
  signMessage: (message: string) => Promise<string>
): Promise<string> {
  // 1. Signe le message fixe avec le wallet embedded
  const signature = await signMessage(IDENTITY_MESSAGE);

  // 2. Hash la signature → 32 bytes déterministes
  const hashHex = await sha256(signature);

  // 3. Convertit en mnemonic BIP39 12 mots
  // TODO: brancher react-native-bip39 ou @scure/bip39 compilé
  const mnemonic = entropyToMnemonic(hashHex.slice(0, 32));

  return mnemonic;
}

// ─── Helpers crypto ──────────────────────────────────────────────────────────

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Placeholder — à remplacer par @scure/bip39 entropyToMnemonic
 * une fois la lib installée dans le projet React Native.
 */
function entropyToMnemonic(entropy: string): string {
  // NOTE: Ceci est un placeholder.
  // Installer: npm install @scure/bip39
  // Usage: import { entropyToMnemonic } from "@scure/bip39";
  //        import { wordlist } from "@scure/bip39/wordlists/english";
  //        return entropyToMnemonic(Buffer.from(entropy, 'hex'), wordlist);
  throw new Error("entropyToMnemonic: brancher @scure/bip39");
}
