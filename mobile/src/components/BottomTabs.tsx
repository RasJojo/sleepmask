import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, shadows } from '../theme';

type BottomTabsProps = {
  activeTab: 'home' | 'transfer' | 'profile';
  onChange: (tab: 'home' | 'transfer' | 'profile') => void;
};

const tabs: Array<{
  key: 'home' | 'transfer' | 'profile';
  label: string;
  caption: string;
}> = [
  { key: 'home', label: 'Accueil', caption: 'Solde' },
  { key: 'transfer', label: 'Transfert', caption: 'Payer' },
  { key: 'profile', label: 'Profil', caption: 'Compte' },
];

export function BottomTabs({ activeTab, onChange }: BottomTabsProps) {
  return (
    <View style={[styles.shell, shadows.card]}>
      {tabs.map(tab => {
        const active = tab.key === activeTab;

        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={({ pressed }) => [
              styles.tab,
              active ? styles.tabActive : null,
              pressed ? styles.tabPressed : null,
            ]}
          >
            <View style={[styles.dot, active ? styles.dotActive : null]} />
            <Text style={[styles.label, active ? styles.labelActive : null]}>
              {tab.label}
            </Text>
            <Text
              style={[styles.caption, active ? styles.captionActive : null]}
            >
              {tab.caption}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    gap: 8,
    padding: 8,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 24,
  },
  tabActive: {
    backgroundColor: colors.black,
  },
  tabPressed: {
    opacity: 0.88,
  },
  dot: {
    width: 6,
    height: 6,
    marginBottom: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  dotActive: {
    backgroundColor: colors.mint,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  labelActive: {
    color: colors.surfaceRaised,
  },
  caption: {
    marginTop: 4,
    fontSize: 11,
    color: colors.textMuted,
  },
  captionActive: {
    color: '#B9C5D2',
  },
});
