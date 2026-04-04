/**
 * api.ts — Client HTTP vers le backend Sleepay.
 * Toutes les requêtes qui touchent Unlink passent ici.
 * Le backend ne stocke jamais la mnemonic — elle est envoyée à chaque appel.
 */

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL ?? "http://localhost:3000";

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TokenBalance = { token: string; amount: string };

export type BalanceResponse = {
  balances: TokenBalance[];
  unlinkAddress: string;
};

export type TxResponse = {
  txId: string;
  status: string;
};

export type CreateReceiveResponse = {
  requestId: string;
  txHash: string;
  qrData: string;
};

export type PaymentStatusResponse = {
  requestId: string;
  paid: boolean;
};

// ─── API ──────────────────────────────────────────────────────────────────────

export const api = {
  /**
   * Récupère le solde Unlink + l'adresse unlink1...
   */
  getBalance: (mnemonic: string) =>
    post<BalanceResponse>("/api/balance", { mnemonic }),

  /**
   * Dépose des tokens depuis le wallet EVM vers la pool Unlink.
   */
  deposit: (mnemonic: string, amount: string, token?: string) =>
    post<TxResponse>("/api/deposit", { mnemonic, amount, token }),

  /**
   * Paiement ZK via Unlink + confirmation on-chain.
   */
  pay: (params: {
    mnemonic: string;
    requestId: string;
    recipientUnlinkAddress: string;
    amount: string;
  }) => post<TxResponse>("/api/pay", params),

  /**
   * Crée une demande de paiement on-chain et retourne le QR data.
   */
  createReceiveRequest: (params: {
    unlinkAddress: string;
    amount?: string;
    ttlSeconds?: string;
    token?: string;
  }) => post<CreateReceiveResponse>("/api/receive/create", params),

  /**
   * Vérifie si une request est payée on-chain.
   */
  getPaymentStatus: (requestId: string) =>
    get<PaymentStatusResponse>(`/api/receive/status/${requestId}`),
};
