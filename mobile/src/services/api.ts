import { config } from './config';

const BASE_URL = config.backendApiUrl;

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as T;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as T;
}

export interface PayParams {
  mnemonic: string;
  requestId: string;
  recipientUnlinkAddress: string;
  amount: string;
  token?: string;
  localTag?: string;
}

export interface ReceiveRequest {
  requestId: string;
  oneshotAddress: string;
  qrSleepmask: string;
  qrClassic: string;
}

export interface PaymentStatus {
  requestId: string;
  paid: boolean;
}

export const pay = (params: PayParams) =>
  post<{ success: boolean; txId: string; burnerAddress: string }>(
    '/pay',
    params,
  );

export const payDirect = (params: {
  mnemonic: string;
  recipientEvmAddress: string;
  amount: string;
  token?: string;
  localTag?: string;
}) =>
  post<{ success: boolean; txId: string }>('/pay/direct', params);

export const createReceiveRequest = (params: {
  unlinkAddress: string;
  amount?: string;
  ttlSeconds?: string;
  token?: string;
}) => post<ReceiveRequest>('/receive/create', params);

export const getPaymentStatus = (requestId: string) =>
  get<PaymentStatus>(`/receive/status/${requestId}`);
