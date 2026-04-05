import React, { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, shadows } from '../theme';

type BalanceRevealCardProps = {
  compact: boolean;
  masked: boolean;
  onToggle: () => void;
  balance?: string;
};

export function BalanceRevealCard({
  compact,
  masked,
  onToggle,
  balance,
}: BalanceRevealCardProps) {
  const reveal = useRef(new Animated.Value(masked ? 0 : 1)).current;

  useEffect(() => {
    Animated.spring(reveal, {
      toValue: masked ? 0 : 1,
      stiffness: 150,
      damping: 18,
      mass: 0.9,
      useNativeDriver: true,
    }).start();
  }, [masked, reveal]);

  const overlayTranslateY = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0, compact ? -132 : -152],
  });

  const overlayRotate = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-8deg'],
  });

  const overlayScale = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.94],
  });

  const contentOpacity = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  const contentTranslateY = reveal.interpolate({
    inputRange: [0, 1],
    outputRange: [10, 0],
  });

  return (
    <View style={[styles.shell, compact ? styles.shellCompact : null]}>
      <View
        style={[
          styles.surfaceCard,
          compact ? styles.surfaceCardCompact : null,
          shadows.floating,
        ]}
      >
        <View style={styles.surfaceGlow} />

        <Animated.View
          style={[
            styles.content,
            {
              opacity: contentOpacity,
              transform: [{ translateY: contentTranslateY }],
            },
          ]}
        >
          <Text style={styles.label}>Solde Sleepmask</Text>
          <Text style={styles.value}>{balance ?? '—'}</Text>
          <Text style={styles.caption}>
            USDC est l’actif principal des paiements Sleepmask.
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        pointerEvents="none"
        style={[
          styles.overlayWrap,
          compact ? styles.overlayWrapCompact : null,
          {
            transform: [
              { translateY: overlayTranslateY },
              { rotate: overlayRotate },
              { scale: overlayScale },
            ],
          },
        ]}
      >
        <View style={[styles.strap, styles.strapLeft]} />
        <View style={[styles.strap, styles.strapRight]} />
        <View
          style={[
            styles.overlayMask,
            compact ? styles.overlayMaskCompact : null,
          ]}
        >
          <View style={styles.overlayHighlight} />
          <View style={[styles.dimple, styles.dimpleLeft]} />
          <View style={[styles.dimple, styles.dimpleRight]} />
          <View style={styles.overlayStitch} />
          <Text style={styles.overlayTitle}>Solde masqué</Text>
          <Text style={styles.overlayText}>
            Appuyez sur afficher pour lever le masque.
          </Text>
        </View>
      </Animated.View>

      <Pressable onPress={onToggle} style={styles.toggleChip}>
        <Text style={styles.toggleChipText}>
          {masked ? 'Afficher' : 'Reposer'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'relative',
    paddingTop: 34,
    paddingHorizontal: 4,
  },
  shellCompact: {
    paddingTop: 28,
  },
  surfaceCard: {
    minHeight: 222,
    borderRadius: 52,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
    overflow: 'hidden',
  },
  surfaceCardCompact: {
    minHeight: 204,
    borderRadius: 46,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 22,
  },
  surfaceGlow: {
    position: 'absolute',
    top: -60,
    left: -10,
    width: 220,
    height: 140,
    borderRadius: 999,
    backgroundColor: '#F4F8FC',
  },
  toggleChip: {
    position: 'absolute',
    top: 54,
    right: 24,
    zIndex: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  toggleChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  content: {
    marginTop: 40,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
  },
  value: {
    marginTop: 16,
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '700',
    color: colors.text,
  },
  caption: {
    marginTop: 14,
    maxWidth: 240,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textMuted,
  },
  overlayWrap: {
    position: 'absolute',
    top: 46,
    left: 18,
    right: 18,
    alignItems: 'center',
    zIndex: 2,
  },
  overlayWrapCompact: {
    top: 40,
    left: 14,
    right: 14,
  },
  strap: {
    position: 'absolute',
    top: '43%',
    width: 28,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#2A2F36',
  },
  strapLeft: {
    left: -14,
  },
  strapRight: {
    right: -14,
  },
  overlayMask: {
    width: '100%',
    minHeight: 178,
    borderRadius: 999,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 26,
    paddingVertical: 26,
  },
  overlayMaskCompact: {
    minHeight: 162,
    paddingHorizontal: 22,
    paddingVertical: 22,
  },
  overlayHighlight: {
    position: 'absolute',
    top: 22,
    width: '54%',
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  dimple: {
    position: 'absolute',
    top: '34%',
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#090B0E',
    opacity: 0.85,
  },
  dimpleLeft: {
    left: '23%',
  },
  dimpleRight: {
    right: '23%',
  },
  overlayStitch: {
    position: 'absolute',
    bottom: 26,
    width: '32%',
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.11)',
  },
  overlayTitle: {
    marginTop: 10,
    fontSize: 21,
    fontWeight: '700',
    color: colors.surfaceRaised,
  },
  overlayText: {
    marginTop: 10,
    maxWidth: 210,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#B8C4D0',
  },
});
