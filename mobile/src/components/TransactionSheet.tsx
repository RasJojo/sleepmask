import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, shadows } from '../theme';
import { SleepMaskMark } from './SleepMaskMark';
import { StatusPill } from './StatusPill';

type TransactionSheetProps = {
  visible: boolean;
  phase: 'pending' | 'success';
  variant: 'pay' | 'receive';
  amount: string;
  counterparty: string;
  onClose: () => void;
};

export function TransactionSheet({
  visible,
  phase,
  variant,
  amount,
  counterparty,
  onClose,
}: TransactionSheetProps) {
  const insets = useSafeAreaInsets();
  const maskTranslate = useRef(new Animated.Value(-260)).current;
  const maskScale = useRef(new Animated.Value(1)).current;
  const sheetOpacity = useRef(new Animated.Value(0)).current;
  const breathing = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (!visible) {
      breathing.current?.stop();
      return;
    }

    sheetOpacity.setValue(0);
    Animated.timing(sheetOpacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [sheetOpacity, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    breathing.current?.stop();

    if (phase === 'pending') {
      maskTranslate.setValue(-260);
      Animated.timing(maskTranslate, {
        toValue: 18,
        duration: 700,
        useNativeDriver: true,
      }).start();

      breathing.current = Animated.loop(
        Animated.sequence([
          Animated.timing(maskScale, {
            toValue: 1.02,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(maskScale, {
            toValue: 1,
            duration: 1200,
            useNativeDriver: true,
          }),
        ]),
      );

      breathing.current.start();
    } else {
      Animated.timing(maskTranslate, {
        toValue: -280,
        duration: 620,
        useNativeDriver: true,
      }).start();
    }

    return () => {
      breathing.current?.stop();
    };
  }, [maskScale, maskTranslate, phase, visible]);

  const title =
    phase === 'pending'
      ? 'Transaction masquée...'
      : variant === 'pay'
      ? 'Paiement envoyé'
      : 'Paiement reçu';

  const subtitle =
    phase === 'pending'
      ? "Nous protégeons l'échange pendant la confirmation."
      : variant === 'pay'
      ? 'Votre transaction en USDC a été confirmée.'
      : 'Les fonds en USDC sont disponibles.';

  const status = phase === 'pending' ? 'En attente' : 'Terminé';

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={styles.backdrop}>
        <Animated.View
          style={[
            styles.sheet,
            shadows.floating,
            {
              marginTop: insets.top + 28,
              marginBottom: Math.max(insets.bottom, 24),
              opacity: sheetOpacity,
            },
          ]}
        >
          <View style={styles.sheetHeader}>
            <SleepMaskMark size={52} />
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>Fermer</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>

          <View style={styles.previewCard}>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Montant</Text>
              <Text style={styles.previewValue}>{amount} USDC</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>
                {variant === 'pay' ? 'Tag local' : 'Repère local'}
              </Text>
              <Text style={styles.previewDetail}>{counterparty}</Text>
            </View>
            <View style={styles.previewRow}>
              <Text style={styles.previewLabel}>Statut</Text>
              <StatusPill status={status} />
            </View>

            <Animated.View
              pointerEvents="none"
              style={[
                styles.maskOverlay,
                {
                  transform: [
                    { translateY: maskTranslate },
                    { scale: maskScale },
                  ],
                },
              ]}
            >
              <SleepMaskMark size={118} />
              <Text style={styles.maskTitle}>Masque en place</Text>
              <Text style={styles.maskText}>
                Les détails restent couverts jusqu&apos;à la validation.
              </Text>
            </Animated.View>
          </View>

          {phase === 'success' ? (
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>
                {variant === 'pay'
                  ? 'Le masque se lève.'
                  : 'La réception apparaît.'}
              </Text>
              <Text style={styles.successText}>
                Le flux reste simple, calme et entièrement mocké pour ce
                prototype.
              </Text>
            </View>
          ) : (
            <Text style={styles.pendingFootnote}>
              Confirmation simulée en cours.
            </Text>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 15, 25, 0.25)',
    paddingHorizontal: 18,
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.surfaceRaised,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 22,
    paddingVertical: 20,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  closeText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  title: {
    marginTop: 18,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  previewCard: {
    marginTop: 24,
    borderRadius: radius.lg,
    backgroundColor: colors.backgroundAlt,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 20,
    minHeight: 260,
    overflow: 'hidden',
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  previewLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  previewValue: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  previewDetail: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  maskOverlay: {
    position: 'absolute',
    top: 0,
    left: 14,
    right: 14,
    height: 196,
    borderRadius: 36,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  maskTitle: {
    marginTop: 18,
    fontSize: 18,
    fontWeight: '700',
    color: colors.surfaceRaised,
  },
  maskText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: '#BCC8D5',
  },
  successCard: {
    marginTop: 20,
    borderRadius: radius.md,
    backgroundColor: colors.mint,
    padding: 18,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.blackSoft,
  },
  successText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.blackSoft,
  },
  pendingFootnote: {
    marginTop: 18,
    fontSize: 13,
    color: colors.textMuted,
  },
});
