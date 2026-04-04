const BASE_URL = process.env.API_URL || 'http://localhost:3000/api';

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

// ─── Balance ──────────────────────────────────────────────────────────────────

export interface Balance {
  balances: Array<{ token: string; amount: string }>;
  unlinkAddress: string;
}

export const getBalance = (mnemonic: string) =>
  post<Balance>('/balance', { mnemonic });

// ─── Deposit ──────────────────────────────────────────────────────────────────

export const depositUsdc = (mnemonic: string, amount: string, token?: string) =>
  post<{ txId: string }>('/deposit', { mnemonic, amount, token });

// ─── Pay (Cas 1 — Sleepmask → Sleepmask) ─────────────────────────────────────

export interface PayParams {
  mnemonic:               string;
  requestId:              string;
  recipientUnlinkAddress: string; // adresse Unlink (Cas 1) ou EVM (Cas 2)
  amount:                 string;
  token?:                 string;
}

export const pay = (params: PayParams) =>
  post<{ success: boolean; txId: string; burnerAddress: string }>('/pay', params);

// ─── Pay direct (Cas 2 — Sleepmask → wallet classique, sans request on-chain) ─

export const payDirect = (params: {
  mnemonic:           string;
  recipientEvmAddress: string;
  amount:             string;
  token?:             string;
}) => post<{ success: boolean; txId: string }>('/pay/direct', params);

// ─── Receive ──────────────────────────────────────────────────────────────────

export interface ReceiveRequest {
  requestId:      string;
  oneshotAddress: string;
  qrSleepmask:    string; // pour utilisateurs Sleepmask
  qrClassic:      string; // pour wallets classiques
}

export const createReceiveRequest = (params: {
  unlinkAddress: string;
  amount?:       string;
  ttlSeconds?:   string;
  token?:        string;
}) => post<ReceiveRequest>('/receive/create', params);

export interface PaymentStatus {
  requestId: string;
  paid:      boolean;
}

export const getPaymentStatus = (requestId: string) =>
  get<PaymentStatus>(`/receive/status/${requestId}`);
