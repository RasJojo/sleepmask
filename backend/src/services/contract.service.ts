import "dotenv/config";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

// ABI minimal du contrat SleepayPaymentRequest
const ABI = [
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
  {
    name: "isPaid",
    type: "function",
    inputs: [{ name: "requestId", type: "bytes32" }],
    outputs: [{ type: "bool" }],
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
          { name: "paidAmount",        type: "uint256" },
          { name: "paidAt",            type: "uint256" },
        ],
      },
    ],
    stateMutability: "view",
  },
] as const;

function buildClients() {
  const rawKey = process.env.EVM_PRIVATE_KEY!;
  const privateKey = (rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`;
  const account = privateKeyToAccount(privateKey);
  const rpcUrl = process.env.RPC_URL || "https://sepolia.base.org";

  const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpcUrl) });
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(rpcUrl) });

  return { publicClient, walletClient, account };
}

function getContractAddress(): `0x${string}` {
  const addr = process.env.CONTRACT_ADDRESS;
  if (!addr) throw new Error("CONTRACT_ADDRESS not set in .env");
  return addr as `0x${string}`;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createPaymentRequestOnChain(params: {
  requestId: `0x${string}`;
  unlinkAddressHash: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  ttlSeconds: bigint;
}) {
  const { walletClient, account } = buildClients();
  const hash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: ABI,
    functionName: "createRequest",
    args: [params.requestId, params.unlinkAddressHash, params.token, params.amount, params.ttlSeconds],
    account,
  });
  return hash;
}

export async function markPaidOnChain(requestId: `0x${string}`, paidAmount: bigint) {
  const { walletClient, account } = buildClients();
  const hash = await walletClient.writeContract({
    address: getContractAddress(),
    abi: ABI,
    functionName: "markPaid",
    args: [requestId, paidAmount],
    account,
  });
  return hash;
}

export async function isPaid(requestId: `0x${string}`): Promise<boolean> {
  const { publicClient } = buildClients();
  return publicClient.readContract({
    address: getContractAddress(),
    abi: ABI,
    functionName: "isPaid",
    args: [requestId],
  });
}

export async function getRequest(requestId: `0x${string}`) {
  const { publicClient } = buildClients();
  return publicClient.readContract({
    address: getContractAddress(),
    abi: ABI,
    functionName: "getRequest",
    args: [requestId],
  });
}
