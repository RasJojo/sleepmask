import "dotenv/config";
import { createPublicClient, createWalletClient, http, parseAbiItem } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ─── ABI complet SleepayPaymentRequest ───────────────────────────────────────

const ABI = [
  // ── createRequest ──────────────────────────────────────────────────────────
  {
    name: "createRequest",
    type: "function",
    inputs: [
      { name: "requestId",         type: "bytes32" },
      { name: "unlinkAddressHash", type: "bytes32" },
      { name: "token",             type: "address" },
      { name: "amount",            type: "uint256" },
      { name: "ttlSeconds",        type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── instructPayment (Cas 1 & 2 : Sleepmask sender) ────────────────────────
  {
    name: "instructPayment",
    type: "function",
    inputs: [
      { name: "requestId", type: "bytes32" },
      { name: "amount",    type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── registerOneShot (Cas 3 : classic wallet sender) ───────────────────────
  {
    name: "registerOneShot",
    type: "function",
    inputs: [
      { name: "requestId",  type: "bytes32" },
      { name: "oneshotEVM", type: "address" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── notifyReceived (Cas 3 : fonds arrivés au one-shot) ────────────────────
  {
    name: "notifyReceived",
    type: "function",
    inputs: [
      { name: "requestId", type: "bytes32" },
      { name: "amount",    type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── markPaid (confirmation finale tous cas) ────────────────────────────────
  {
    name: "markPaid",
    type: "function",
    inputs: [
      { name: "requestId",  type: "bytes32" },
      { name: "paidAmount", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  // ── Views ──────────────────────────────────────────────────────────────────
  {
    name: "isPaid",
    type: "function",
    inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
    stateMutability: "view",
  },
  {
    name: "getStatus",
    type: "function",
    inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [{ type: "uint8" }],
    stateMutability: "view",
  },
  {
    name: "getBurnerAddress",
    type: "function",
    inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    name: "predictBurnerAddress",
    type: "function",
    inputs: [
      { name: "requestId", type: "bytes32" },
      { name: "nonce",     type: "uint256" },
    ],
    outputs: [{ type: "address" }],
    stateMutability: "view",
  },
  {
    name: "getRequest",
    type: "function",
    inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "unlinkAddressHash", type: "bytes32" },
          { name: "token",             type: "address" },
          { name: "amount",            type: "uint256" },
          { name: "expiresAt",         type: "uint256" },
          { name: "creator",           type: "address" },
          { name: "status",            type: "uint8"   },
          { name: "burnerAddress",     type: "address" },
          { name: "burnerNonce",       type: "uint256" },
          { name: "paidAmount",        type: "uint256" },
          { name: "paidAt",            type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
  // ── Events ─────────────────────────────────────────────────────────────────
  {
    name: "PaymentInstructed",
    type: "event",
    inputs: [
      { name: "requestId",     type: "bytes32", indexed: true  },
      { name: "burnerAddress", type: "address", indexed: true  },
      { name: "amount",        type: "uint256", indexed: false },
      { name: "token",         type: "address", indexed: false },
    ],
  },
  {
    name: "OneShotRegistered",
    type: "event",
    inputs: [
      { name: "requestId",      type: "bytes32", indexed: true  },
      { name: "oneshotAddress", type: "address", indexed: true  },
      { name: "amount",         type: "uint256", indexed: false },
      { name: "token",          type: "address", indexed: false },
    ],
  },
  {
    name: "FundsReceived",
    type: "event",
    inputs: [
      { name: "requestId",      type: "bytes32", indexed: true  },
      { name: "oneshotAddress", type: "address", indexed: true  },
      { name: "amount",         type: "uint256", indexed: false },
    ],
  },
  {
    name: "RequestPaid",
    type: "event",
    inputs: [
      { name: "requestId",  type: "bytes32", indexed: true  },
      { name: "paidAmount", type: "uint256", indexed: false },
      { name: "paidAt",     type: "uint256", indexed: false },
    ],
  },
] as const;

// ─── Status enum (mirror du Solidity) ────────────────────────────────────────

export enum RequestStatus {
  Pending     = 0,
  Instructed  = 1,
  BurnerReady = 2,
  Paid        = 3,
  Expired     = 4,
  Cancelled   = 5,
}

// ─── Clients viem ─────────────────────────────────────────────────────────────

function buildClients() {
  const rawKey = process.env.EVM_PRIVATE_KEY!;
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  const rpcUrl  = process.env.RPC_URL || "https://sepolia.base.org";

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(rpcUrl),
  });

  return { publicClient, walletClient, account };
}

function getContractAddress(): `0x${string}` {
  const addr = process.env.CONTRACT_ADDRESS;
  if (!addr) throw new Error("CONTRACT_ADDRESS not set in .env");
  return addr as `0x${string}`;
}

let relayerNonceCursor: number | null = null;
let relayerNonceQueue: Promise<unknown> = Promise.resolve();

function resetRelayerNonceCursor() {
  relayerNonceCursor = null;
}

async function allocateRelayerNonce() {
  const { publicClient, account } = buildClients();

  if (relayerNonceCursor === null) {
    relayerNonceCursor = await publicClient.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    });
  }

  const nonce = relayerNonceCursor;
  relayerNonceCursor += 1;
  return nonce;
}

function isNonceSyncError(error: any) {
  const message = String(error?.message || error?.details || "");
  return (
    message.includes("nonce too low") ||
    message.includes("Nonce provided for the transaction is lower") ||
    message.includes("replacement transaction underpriced")
  );
}

async function writeRelayerContract(
  request: Parameters<ReturnType<typeof buildClients>["walletClient"]["writeContract"]>[0],
  attempt = 0
): Promise<`0x${string}`> {
  const { walletClient, account } = buildClients();
  const nonce = await allocateRelayerNonce();

  try {
    return await walletClient.writeContract({
      ...request,
      account,
      nonce,
    });
  } catch (error) {
    resetRelayerNonceCursor();

    if (attempt === 0 && isNonceSyncError(error)) {
      return writeRelayerContract(request, attempt + 1);
    }

    throw error;
  }
}

async function queueRelayerWrite(
  request: Parameters<ReturnType<typeof buildClients>["walletClient"]["writeContract"]>[0]
) {
  const task = relayerNonceQueue.then(() => writeRelayerContract(request));
  relayerNonceQueue = task.catch(() => undefined);
  return task;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export async function createPaymentRequestOnChain(params: {
  requestId:         `0x${string}`;
  unlinkAddressHash: `0x${string}`;
  token:             `0x${string}`;
  amount:            bigint;
  ttlSeconds:        bigint;
}) {
  return queueRelayerWrite({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "createRequest",
    args: [params.requestId, params.unlinkAddressHash, params.token, params.amount, params.ttlSeconds],
  });
}

/**
 * Cas 1 & 2 : Alice instruis le paiement.
 * Émet PaymentInstructed(requestId, burnerA, amount, token) côté contrat.
 * Le watcher PaymentInstructed déclenche ensuite le ZK transfer côté backend.
 */
export async function instructPaymentOnChain(requestId: `0x${string}`, amount: bigint) {
  return queueRelayerWrite({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "instructPayment",
    args:         [requestId, amount],
  });
}

/**
 * Cas 3 : Enregistre l'adresse one-shot EVM pour réception depuis wallet classique.
 * oneshotEVM est une adresse dérivée côté backend : keccak256(masterKey + requestId)
 */
export async function registerOneShotOnChain(requestId: `0x${string}`, oneshotEVM: `0x${string}`) {
  return queueRelayerWrite({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "registerOneShot",
    args:         [requestId, oneshotEVM],
  });
}

/**
 * Cas 3 : Notifie l'arrivée des fonds sur le one-shot.
 * Le contrat vérifie le solde ERC20 on-chain avant d'émettre FundsReceived.
 */
export async function notifyReceivedOnChain(requestId: `0x${string}`, amount: bigint) {
  return queueRelayerWrite({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "notifyReceived",
    args:         [requestId, amount],
  });
}

/**
 * Confirmation finale : tous cas (Instructed → Paid, BurnerReady → Paid).
 * Appelé après confirmation du transfert Unlink (pollTransactionStatus).
 */
export async function markPaidOnChain(requestId: `0x${string}`, paidAmount: bigint) {
  return queueRelayerWrite({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "markPaid",
    args:         [requestId, paidAmount],
  });
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export async function isPaid(requestId: `0x${string}`): Promise<boolean> {
  const { publicClient } = buildClients();
  return publicClient.readContract({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "isPaid",
    args:         [requestId],
  });
}

export async function getStatus(requestId: `0x${string}`): Promise<RequestStatus> {
  const { publicClient } = buildClients();
  const status = await publicClient.readContract({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "getStatus",
    args:         [requestId],
  });
  return status as RequestStatus;
}

export async function getBurnerAddress(requestId: `0x${string}`): Promise<`0x${string}`> {
  const { publicClient } = buildClients();
  return publicClient.readContract({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "getBurnerAddress",
    args:         [requestId],
  }) as Promise<`0x${string}`>;
}

export async function getRequest(requestId: `0x${string}`) {
  const { publicClient } = buildClients();
  return publicClient.readContract({
    address:      getContractAddress(),
    abi:          ABI,
    functionName: "getRequest",
    args:         [requestId],
  });
}

// ─── Event watchers ──────────────────────────────────────────────────────────

/**
 * Cas 1 & 2 : écoute PaymentInstructed → backend exécute le ZK transfer.
 *
 * À la réception :
 *   1. Créer BurnerA Unlink depuis burnerAddress (seed déterministe)
 *   2. transfer(aliceMnemonic, burnerAUnlinkAddress, amount, token)  [Alice → BurnerA]
 *   3. transfer(burnerAMnemonic, bobUnlinkAddress/evmAddress, amount, token)  [BurnerA → Bob]
 *   4. markPaidOnChain(requestId, amount)
 *
 * @returns Fonction unwatch() à appeler pour arrêter l'écoute
 */
export function watchPaymentInstructed(
  callback: (event: {
    requestId:     `0x${string}`;
    burnerAddress: `0x${string}`;
    amount:        bigint;
    token:         `0x${string}`;
  }) => Promise<void>
): () => void {
  const { publicClient } = buildClients();

  return publicClient.watchContractEvent({
    address:   getContractAddress(),
    abi:       ABI,
    eventName: "PaymentInstructed",
    onLogs: (logs) => {
      for (const log of logs) {
        const { requestId, burnerAddress, amount, token } = log.args as {
          requestId:     `0x${string}`;
          burnerAddress: `0x${string}`;
          amount:        bigint;
          token:         `0x${string}`;
        };
        callback({ requestId, burnerAddress, amount, token }).catch(console.error);
      }
    },
  });
}

/**
 * Cas 3 : écoute FundsReceived → backend sweep one-shot → Unlink → Alice.
 *
 * À la réception :
 *   1. Sweep USDC de oneshotAddress vers Unlink (deposit)
 *   2. pollTransactionStatus jusqu'à confirmation
 *   3. markPaidOnChain(requestId, amount)
 *
 * @returns Fonction unwatch() à appeler pour arrêter l'écoute
 */
export function watchFundsReceived(
  callback: (event: {
    requestId:      `0x${string}`;
    oneshotAddress: `0x${string}`;
    amount:         bigint;
  }) => Promise<void>
): () => void {
  const { publicClient } = buildClients();

  return publicClient.watchContractEvent({
    address:   getContractAddress(),
    abi:       ABI,
    eventName: "FundsReceived",
    onLogs: (logs) => {
      for (const log of logs) {
        const { requestId, oneshotAddress, amount } = log.args as {
          requestId:      `0x${string}`;
          oneshotAddress: `0x${string}`;
          amount:         bigint;
        };
        callback({ requestId, oneshotAddress, amount }).catch(console.error);
      }
    },
  });
}
