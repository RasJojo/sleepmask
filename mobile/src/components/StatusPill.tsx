import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '../theme';

type StatusPillProps = {
  status: 'Terminé' | 'En attente' | 'Échoué';
};

export function StatusPill({ status }: StatusPillProps) {
  const tone =
    status === 'Terminé'
      ? styles.success
      : status === 'En attente'
      ? styles.pending
      : styles.error;

  const textTone =
    status === 'Terminé'
      ? styles.successText
      : status === 'En attente'
      ? styles.pendingText
      : styles.errorText;

  return (
    <View style={[styles.base, tone]}>
      <Text style={[styles.text, textTone]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
  success: {
    backgroundColor: colors.mint,
  },
  successText: {
    color: colors.blackSoft,
  },
  pending: {
    backgroundColor: colors.surface,
  },
  pendingText: {
    color: colors.textMuted,
  },
  error: {
    backgroundColor: colors.danger,
  },
  errorText: {
    color: colors.dangerDeep,
  },
});
