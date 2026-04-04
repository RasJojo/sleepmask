import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';

type SleepMaskMarkProps = {
  size?: number;
  tone?: 'dark' | 'light';
};

export function SleepMaskMark({
  size = 112,
  tone = 'dark',
}: SleepMaskMarkProps) {
  const width = size * 1.6;
  const height = size * 0.78;
  const maskColor = tone === 'dark' ? colors.black : colors.surfaceRaised;
  const strapColor = tone === 'dark' ? '#2A2F36' : '#DEE7F0';
  const highlightColor =
    tone === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)';
  const dimpleColor = tone === 'dark' ? '#0C0D10' : '#E8EEF5';
  const stitchColor =
    tone === 'dark' ? 'rgba(255,255,255,0.11)' : 'rgba(17,17,17,0.08)';

  return (
    <View style={[styles.root, { width, height }]}>
      <View
        style={[
          styles.strap,
          styles.leftStrap,
          { backgroundColor: strapColor, top: height * 0.37 },
        ]}
      />
      <View
        style={[
          styles.strap,
          styles.rightStrap,
          { backgroundColor: strapColor, top: height * 0.37 },
        ]}
      />
      <View
        style={[
          styles.mask,
          {
            backgroundColor: maskColor,
            borderColor: tone === 'dark' ? colors.black : colors.border,
            width,
            height,
          },
        ]}
      >
        <View
          style={[
            styles.highlight,
            {
              backgroundColor: highlightColor,
              width: width * 0.62,
              left: width * 0.18,
            },
          ]}
        />
        <View
          style={[
            styles.dimple,
            {
              backgroundColor: dimpleColor,
              width: width * 0.18,
              height: height * 0.18,
              left: width * 0.2,
            },
          ]}
        />
        <View
          style={[
            styles.dimple,
            {
              backgroundColor: dimpleColor,
              width: width * 0.18,
              height: height * 0.18,
              right: width * 0.2,
            },
          ]}
        />
        <View
          style={[
            styles.stitch,
            {
              backgroundColor: stitchColor,
              width: width * 0.34,
              bottom: height * 0.22,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  strap: {
    position: 'absolute',
    width: 26,
    height: 8,
    borderRadius: 999,
  },
  leftStrap: {
    left: -18,
  },
  rightStrap: {
    right: -18,
  },
  mask: {
    borderRadius: 999,
    borderWidth: 1,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  highlight: {
    position: 'absolute',
    top: '16%',
    height: '10%',
    borderRadius: 999,
  },
  dimple: {
    position: 'absolute',
    top: '32%',
    borderRadius: 999,
    opacity: 0.85,
  },
  stitch: {
    position: 'absolute',
    height: 4,
    borderRadius: 999,
  },
});
