import { sha256 } from '@noble/hashes/sha2.js';
import { entropyToMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

/**
 * Dérive le mnémonique Unlink depuis la signature du wallet Dynamic.
 *
 * Flow :
 *   1. Wallet Dynamic signe le message "sleepmask-identity-v1"
 *   2. SHA256(signature) → 32 bytes d'entropie
 *   3. Les 16 premiers bytes → mnémonique BIP39 12 mots (128-bit)
 *
 * Propriétés :
 *   - Déterministe : même wallet → même signature → même mnémonique
 *   - Non réversible : impossible de retrouver le wallet depuis le mnémonique
 *   - Zero-trust : jamais transmis ni stocké côté serveur
 *   - Unique par wallet : un wallet différent → signature différente → mnémonique différent
 *
 * @param signMessage - Fonction de signature du wallet connecté (Dynamic / WalletConnect)
 */
export async function deriveUnlinkMnemonic(
  signMessage: (message: string) => Promise<string>,
): Promise<string> {
  const signature = await signMessage('sleepmask-identity-v1');

  // Retire le préfixe "0x" et convertit en bytes
  const sigHex   = signature.startsWith('0x') ? signature.slice(2) : signature;
  const sigBytes = new Uint8Array(sigHex.match(/.{2}/g)!.map(b => parseInt(b, 16)));

  // SHA256 de la signature → prend les 16 premiers bytes pour 128-bit d'entropie
  const entropy = sha256(sigBytes).slice(0, 16);

  return entropyToMnemonic(entropy, wordlist);
}
