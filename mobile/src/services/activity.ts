import AsyncStorage from '@react-native-async-storage/async-storage';

import type { ActivityDirection, ActivityItem, ActivityStatus } from '../types';

const ACTIVITY_KEY = 'sleepmask_activity_v1';

function buildSubtitle(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });

  return formatter.format(date);
}

export function formatUsdcMicros(
  amountMicros: number | string,
  direction: ActivityDirection,
) {
  const amount =
    typeof amountMicros === 'number'
      ? amountMicros
      : Number.parseInt(amountMicros, 10);

  const prefix = direction === 'Reçu' ? '+' : '-';
  const value = Number.isFinite(amount) ? amount / 1_000_000 : 0;

  return `${prefix}${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function createActivityItem(params: {
  title: string;
  amountMicros: number | string;
  direction: ActivityDirection;
  status: ActivityStatus;
  token?: string;
  subtitle?: string;
}) {
  const item: ActivityItem = {
    id: `${params.direction.toLowerCase()}-${Date.now().toString(36)}`,
    title: params.title,
    subtitle: params.subtitle ?? buildSubtitle(),
    amount: formatUsdcMicros(params.amountMicros, params.direction),
    token: params.token ?? 'USDC',
    status: params.status,
    direction: params.direction,
  };

  return item;
}

export async function readActivity() {
  const raw = await AsyncStorage.getItem(ACTIVITY_KEY);
  if (!raw) {
    return [] as ActivityItem[];
  }

  try {
    const parsed = JSON.parse(raw) as ActivityItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as ActivityItem[];
  }
}

export async function writeActivity(items: ActivityItem[]) {
  await AsyncStorage.setItem(ACTIVITY_KEY, JSON.stringify(items));
}

export async function pushActivity(item: ActivityItem) {
  const current = await readActivity();
  const next = [item, ...current].slice(0, 40);
  await writeActivity(next);
  return next;
}

export async function clearActivity() {
  await AsyncStorage.removeItem(ACTIVITY_KEY);
}
