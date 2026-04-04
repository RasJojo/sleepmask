# SLEEPAY — PROGRESS

## État actuel : ÉTAPE 3 — Backend + Smart Contract ✅

---

## ARCHITECTURE FINALE VALIDÉE

### Stack
- **Frontend** : React Native (ChatGPT génère l'UI, Claude intègre la blockchain)
- **Backend** : Node.js / Express — proxy stateless Unlink
- **Smart contract** : Solidity / Hardhat — Base Sepolia
- **Auth** : Dynamic SDK (embedded wallet)
- **Privacy** : Unlink SDK (ZK pool transfers)

### Modèle de confidentialité
- Identité Unlink dérivée client-side (signature Dynamic → mnemonic → unlink1...)
- Backend ne stocke JAMAIS la mnemonic — reçue à chaque requête, oubliée aussitôt
- Adresse Unlink destinataire hashée on-chain (keccak256)
- Adresses one-shot via index Unlink incrémental (accountIndex N par réception)

### Bounties ciblés
| Bounty | Montant | Fit |
|--------|---------|-----|
| Unlink — Best Private Application | $3k | ✅ Core |
| Dynamic — Mobile | $1.667k | ✅ Core |
| Arc — Best Smart Contracts Stablecoin Logic | $3k | ✅ Contrat Arc-worthy |

---

## ÉTAPES

### ✅ Setup initial
- Repo git initialisé
- CLAUDE.md rédigé
- Structure dossiers créée

### ✅ ÉTAPE 1 — Unlink SDK testé (backend)
- `backend/src/services/test-unlink.ts` écrit et compilé
- SDK `@unlink-xyz/sdk` installé
- Bloquant résolu : token test = `0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7`

### ✅ ÉTAPE 2 — Smart contract déployé
- `contracts/contracts/SleepayPaymentRequest.sol` — 10/10 tests passent
- Setup Hardhat complet
- Script de déploiement Base Sepolia prêt
- **À faire** : `cd contracts && npm run deploy:baseSepolia` (besoin ETH)

### ✅ ÉTAPE 3 — Backend Express complet
- `backend/src/index.ts` — serveur Express
- `backend/src/routes/pay.ts` — POST /api/pay
- `backend/src/routes/balance.ts` — POST /api/balance
- `backend/src/routes/deposit.ts` — POST /api/deposit
- `backend/src/routes/receive.ts` — POST /api/receive/create + GET /api/receive/status/:id
- `backend/src/services/unlink.service.ts` — wrapper Unlink
- `backend/src/services/contract.service.ts` — wrapper viem/contrat
- TypeScript compile sans erreur

### ✅ ÉTAPE 4 — Services React Native
- `mobile/src/services/api.ts` — client HTTP backend
- `mobile/src/services/identity.ts` — dérivation mnemonic (placeholder @scure/bip39)
- `mobile/src/hooks/useBalance.ts`
- `mobile/src/hooks/usePayment.ts`
- `mobile/src/hooks/useReceive.ts`
- `mobile/src/hooks/useDeposit.ts`

### 🔄 ÉTAPE 5 — UI React Native (ChatGPT génère, Claude intègre)
- [ ] Init projet Expo / React Native dans `/mobile`
- [ ] Installer Dynamic SDK RN
- [ ] Installer @scure/bip39 pour dérivation mnemonic
- [ ] Brancher les hooks sur les screens générés par ChatGPT
- [ ] QR scanner (react-native-vision-camera ou expo-barcode-scanner)

### ⏳ ÉTAPE 6 — Deploy + tests end-to-end
- [ ] ETH Base Sepolia sur `0x72f262444ef740B4F6456910Ad64a1B3102CFCf4`
- [ ] `cd contracts && npm run deploy:baseSepolia`
- [ ] `cd backend && npm run dev`
- [ ] Flow complet : deposit → receive request → scan → pay → confirm

### ⏳ ÉTAPE 7 — Démo + README

---

## CLÉS NÉCESSAIRES

| Variable | Statut | Où la trouver |
|----------|--------|---------------|
| `UNLINK_API_KEY` | ✅ Set | hackaton-apikey.vercel.app |
| `EVM_PRIVATE_KEY` | ✅ Set | Wallet test généré |
| `DYNAMIC_ENV_ID` | ✅ Set | app.dynamic.xyz |
| `CONTRACT_ADDRESS` | ⏳ Après deploy | `npm run deploy:baseSepolia` |
| ETH Base Sepolia | ⏳ Manquant | faucet.base.org |

---

## ADRESSES

| Contrat | Réseau | Adresse |
|---------|--------|---------|
| SleepayPaymentRequest | Base Sepolia | _non déployé_ |
| USDC test Unlink | Base Sepolia | `0x7501de8ea37a21e20e6e65947d2ecab0e9f061a7` |

## Wallet test
- EVM : `0x72f262444ef740B4F6456910Ad64a1B3102CFCf4`

---

## NOTES TECHNIQUES

- Backend stateless : mnemonic jamais stockée, passée à chaque requête
- Unlink accountIndex incrémental pour adresses one-shot à la réception
- Smart contract : `unlinkAddressHash = keccak256(unlinkAddress)` — protège la destination
- Arc bounty : contrat avec logique conditionnelle USDC + expiry + multi-step settlement
- QR format : `sleepay://pay?requestId=0x...&amount=...&token=0x...`
