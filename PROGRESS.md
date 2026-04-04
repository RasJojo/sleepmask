# SLEEPMASK PRO — PROGRESS

## État actuel : ÉTAPE 1 — Test Unlink SDK

---

## ÉTAPES

### ✅ Setup initial
- Repo git initialisé
- CLAUDE.md rédigé
- PROGRESS.md créé

### 🔄 ÉTAPE 1 — Unlink SDK fonctionne (BLOCKER)
**Statut : EN COURS**

Fichiers créés :
- [x] `.env.example`
- [x] `backend/package.json`
- [x] `backend/tsconfig.json`
- [x] `backend/src/services/test-unlink.ts`

Fait :
- [x] `.env.example` créé
- [x] `backend/package.json` + `tsconfig.json` créés
- [x] `npm install` — 178 packages, 0 vulnerabilities
- [x] `test-unlink.ts` écrit + TypeScript compile sans erreur (`tsc --noEmit` OK)
- [x] `.gitignore` créé

À faire (bloquant — faire maintenant) :
- [ ] Récupérer l'API key sur https://hackaton-apikey.vercel.app
- [ ] Créer `.env` depuis `.env.example` et remplir :
      - `UNLINK_API_KEY`
      - `EVM_PRIVATE_KEY` (wallet avec ETH sur Base Sepolia)
      - `USER_MNEMONIC` (générer : `node -e "const {generateMnemonic}=require('viem/accounts');console.log(generateMnemonic())"`)
      - `RPC_URL=https://sepolia.base.org`
- [ ] Aller sur https://hackaton-apikey.vercel.app/faucet pour envoyer des tokens de test à l'adresse EVM
- [ ] `cd backend && npm run test:unlink`
- [ ] Vérifier les txHash dans la console — noter ici

Note SDK : le package npm est `@unlink-xyz/sdk` (pas `@unlink/sdk`)
Token de test Base Sepolia : `0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7`
Engine URL : `https://staging-api.unlink.xyz`

### ⏳ ÉTAPE 2 — Smart contract déployé
- Init Hardhat dans `/contracts`
- Deploy `SleepmaskPaymentRequest.sol` sur Base Sepolia
- Note l'adresse dans `.env` → `CONTRACT_ADDRESS`

### ⏳ ÉTAPE 3 — Backend : endpoint /pay
### ⏳ ÉTAPE 4 — WalletConnect Pay merchant side
### ⏳ ÉTAPE 5 — Flutter app + Dynamic wallet
### ⏳ ÉTAPE 6 — Scanner + flow complet
### ⏳ ÉTAPE 7 — Démo + README

---

## BLOCAGES

_Aucun pour l'instant._

---

## ADRESSES DÉPLOYÉES

| Contrat | Réseau | Adresse |
|---------|--------|---------|
| SleepmaskPaymentRequest | Base Sepolia | _non déployé_ |

---

## NOTES TECHNIQUES

- SDK Unlink : `@unlink-xyz/sdk` + `viem`
- `createUnlink()` prend un `account` (mnemonic Unlink) + un `evm` (wallet viem pour txs on-chain)
- `EVM_PRIVATE_KEY` = clé privée du relayer pour signer les txs EVM (approve, deposit, withdraw)
- `USER_MNEMONIC` = identité Unlink de l'user (12 mots BIP39), stockée côté backend
- Token test : `0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7` (faucet Unlink)
