# Sleepmask

**Privacy-first crypto payments on Base.**

Pay and receive USDC without exposing your wallet history, balance, or identity on-chain. Sleepmask routes every payment through a zero-knowledge private rail — sender and recipient are never linked on-chain.

---

## The problem

Every EVM payment is fully public. When you pay someone, you reveal your entire wallet history, your balance, and every other transaction you've ever made. There is no privacy layer for everyday crypto payments.

## The solution

Sleepmask wraps every payment in a ZK private transfer via [Unlink](https://unlink.xyz). On-chain, only the relayer is visible — Alice and Bob never appear together in any transaction.

---

## How it works

### Cas 1 — Sleepmask → Sleepmask (maximum privacy)
1. Alice scans Bob's QR code (contains a `requestId` and Bob's Unlink address)
2. Alice deposits USDC into the private rail (Permit2 signature via MetaMask)
3. Funds flow: Alice → ephemeral BurnerA → Bob — all via ZK transfers
4. Payment is marked paid on-chain. Neither Alice nor Bob's address appears.

### Cas 2 — Sleepmask → classic wallet
Same flow, but the final step is a `withdraw` to Bob's EVM address. Alice is still invisible.

### Cas 3 — Classic wallet → Sleepmask
Bob generates a one-shot address. The sender (any wallet) sends USDC to it directly.  
The backend detects the transfer, sweeps to the relayer, deposits into the private rail, transfers to Bob's Unlink account, then auto-withdraws to Bob's EVM wallet.  
Bob receives USDC in his wallet. The sender never learns Bob's real address.

---

## Architecture

```
mobile/          React Native 0.84 (Hermes) — iOS/Android
backend/         Node.js / Express — relayer, watchers, Unlink orchestration
contracts/       Solidity / Hardhat — SleepayPaymentRequest on Base Sepolia
```

### Key integrations

| Layer | Tech |
|---|---|
| Wallet connect | [Dynamic](https://dynamic.xyz) — `@dynamic-labs/client` + React Native extension |
| Private transfers | [Unlink](https://unlink.xyz) — ZK rail on Base Sepolia |
| Chain | Base Sepolia (testnet) |
| Token | USDC `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |
| Signatures | Permit2 via MetaMask / WalletConnect |

---

## Smart contract

`SleepayPaymentRequest` — manages payment requests lifecycle on-chain.

- `createPaymentRequest(requestId, unlinkAddressHash, token, amount, ttl)` — creates a request. The recipient's Unlink address is **hashed**, never stored in plaintext.
- `registerOneShot(requestId, oneshotAddress)` — registers the one-shot address for Cas 3.
- `notifyReceived(requestId, amount)` — confirms funds arrived at the one-shot.
- `markPaid(requestId, amount)` — finalizes the payment.

On-chain visible: relayer interactions only. Alice and Bob are invisible.

---

## Local setup

### Backend

```bash
cd backend
cp .env.example .env   # fill EVM_PRIVATE_KEY, UNLINK_API_KEY, CONTRACT_ADDRESS
npm install
npm run dev
```

### Mobile

```bash
cd mobile
npm install
# Android release build (no Metro dependency)
npx react-native bundle --platform android --dev false \
  --entry-file index.js \
  --bundle-output android/app/src/main/assets/index.android.bundle \
  --assets-dest android/app/src/main/res
cd android && ./gradlew assembleRelease
adb install -r app/build/outputs/apk/release/app-release.apk
```

### Contracts

```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.ts --network baseSepolia
```

---

## Built at ETHGlobal

- **Dynamic** — wallet connection on React Native, Permit2 signing via WalletConnect
- **Unlink** — ZK private transfer rail, deposit / transfer / withdraw pipeline
- **Base** — fast, cheap, EVM-compatible L2

---

## Team

Built with love and sleep deprivation.
