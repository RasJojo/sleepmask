export type Holding = {
  id: string;
  symbol: string;
  name: string;
  amount: string;
  note: string;
  primary?: boolean;
};

export type ActivityStatus = 'Terminé' | 'En attente' | 'Échoué';
export type ActivityDirection = 'Envoyé' | 'Reçu';

export type ActivityItem = {
  id: string;
  title: string;
  subtitle: string;
  amount: string;
  token: string;
  status: ActivityStatus;
  direction: ActivityDirection;
};

export const holdings: Holding[] = [
  {
    id: 'usdc',
    symbol: 'USDC',
    name: 'Rail de paiement',
    amount: '2 450,20',
    note: 'Actif principal',
    primary: true,
  },
  {
    id: 'eth',
    symbol: 'ETH',
    name: 'Réserve réseau',
    amount: '1,284',
    note: 'Secondaire',
  },
  {
    id: 'eurc',
    symbol: 'EURC',
    name: 'Poche euro',
    amount: '380,00',
    note: 'Secondaire',
  },
];

export const activity: ActivityItem[] = [
  {
    id: '1',
    title: 'Atelier Saint-Honore',
    subtitle: "Aujourd'hui · 09:24",
    amount: '-48,00',
    token: 'USDC',
    status: 'Terminé',
    direction: 'Envoyé',
  },
  {
    id: '2',
    title: 'Lina Mercier',
    subtitle: 'Hier · 18:10',
    amount: '+120,00',
    token: 'USDC',
    status: 'Terminé',
    direction: 'Reçu',
  },
  {
    id: '3',
    title: 'Studio Riviera',
    subtitle: 'Hier · 12:42',
    amount: '-16,50',
    token: 'USDC',
    status: 'En attente',
    direction: 'Envoyé',
  },
  {
    id: '4',
    title: 'Maison Petale',
    subtitle: 'Lun. · 16:03',
    amount: '-84,00',
    token: 'USDC',
    status: 'Échoué',
    direction: 'Envoyé',
  },
];

export const profileSummary = {
  connectionMethod: 'Google',
  shortAddress: '0x72f2...CFCf4',
  fullAddress: '0x72f262444ef740B4F6456910Ad64a1B3102CFCf4',
  accountLabel: 'Wallet connecté',
};
