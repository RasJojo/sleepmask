export function humanizeError(
  error: unknown,
  fallback = 'Une erreur est survenue.',
) {
  const raw =
    typeof error === 'string'
      ? error
      : error && typeof error === 'object' && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';

  const message = raw.trim();
  const lower = message.toLowerCase();

  if (!message) {
    return fallback;
  }

  if (
    lower.includes('network request failed') ||
    lower.includes('failed to fetch') ||
    lower.includes('fetch failed') ||
    lower.includes('timeout') ||
    lower.includes('load failed')
  ) {
    return 'Backend inaccessible pour le moment. Réessayez dans quelques secondes.';
  }

  if (
    (lower.includes('buffer') && lower.includes("doesn't exist")) ||
    (lower.includes('property') && lower.includes('buffer')) ||
    lower.includes('import.meta')
  ) {
    return 'Erreur de compatibilité mobile détectée. Réessayez après redémarrage de l’app.';
  }

  if (
    lower.includes('insufficient') ||
    lower.includes('not enough') ||
    lower.includes('balance too low') ||
    lower.includes('insufficient funds')
  ) {
    return 'Solde insuffisant pour finaliser cette opération.';
  }

  if (lower.includes('user denied') || lower.includes('rejected')) {
    return 'Action annulée dans le wallet.';
  }

  if (lower.includes('mnemonic') || lower.includes('identité')) {
    return 'Votre identité Sleepmask n’est pas encore activée.';
  }

  return message;
}
