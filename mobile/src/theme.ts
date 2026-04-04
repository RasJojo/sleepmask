import { StyleSheet } from 'react-native';

export const colors = {
  background: '#F8FAFC',
  backgroundAlt: '#F4F7FB',
  surface: '#EEF3F8',
  surfaceRaised: '#FFFFFF',
  border: '#D9E2EC',
  black: '#111111',
  blackSoft: '#1C1F24',
  text: '#1C1F24',
  textMuted: '#6B7280',
  textSubtle: '#93A0AF',
  mint: '#CFE8DE',
  mintDeep: '#7EA894',
  danger: '#EFC9C9',
  dangerDeep: '#A34F4F',
};

export const spacing = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 24,
  xl: 32,
};

export const radius = {
  sm: 14,
  md: 22,
  lg: 30,
  pill: 999,
};

export const shadows = StyleSheet.create({
  card: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  floating: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
});
