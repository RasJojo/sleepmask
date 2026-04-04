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
