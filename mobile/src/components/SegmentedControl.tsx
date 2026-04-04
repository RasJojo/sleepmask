import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../theme';

type SegmentedControlProps = {
  options: Array<{ key: string; label: string }>;
  value: string;
  onChange: (nextValue: string) => void;
};

export function SegmentedControl({
  options,
  value,
  onChange,
}: SegmentedControlProps) {
  return (
    <View style={styles.wrapper}>
      {options.map(option => {
        const active = option.key === value;

        return (
          <Pressable
            key={option.key}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.segment,
              active ? styles.segmentActive : null,
              pressed ? styles.segmentPressed : null,
            ]}
          >
            <Text style={[styles.label, active ? styles.labelActive : null]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    padding: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segment: {
    flex: 1,
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  segmentActive: {
    backgroundColor: colors.black,
  },
  segmentPressed: {
    opacity: 0.88,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textMuted,
  },
  labelActive: {
    color: colors.surfaceRaised,
  },
});
