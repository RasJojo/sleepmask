import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../theme';

type QrCodeMockProps = {
  size?: number;
};

function buildCells() {
  const dimension = 21;
  const cells: boolean[] = [];

  const isFinder = (row: number, column: number, top: number, left: number) => {
    const withinRow = row >= top && row < top + 7;
    const withinColumn = column >= left && column < left + 7;
    if (!withinRow || !withinColumn) {
      return false;
    }

    const border =
      row === top || row === top + 6 || column === left || column === left + 6;
    const core =
      row >= top + 2 &&
      row <= top + 4 &&
      column >= left + 2 &&
      column <= left + 4;

    return border || core;
  };

  for (let row = 0; row < dimension; row += 1) {
    for (let column = 0; column < dimension; column += 1) {
      const finder =
        isFinder(row, column, 0, 0) ||
        isFinder(row, column, 0, 14) ||
        isFinder(row, column, 14, 0);

      const quietPattern =
        ((row * column + row + column) % 3 === 0 && (row + column) % 2 === 0) ||
        (row % 4 === 0 && column % 5 === 0);

      cells.push(finder || quietPattern);
    }
  }

  return cells;
}

export function QrCodeMock({ size = 220 }: QrCodeMockProps) {
  const cells = useMemo(buildCells, []);
  const dimension = 21;
  const padding = 14;
  const cellSize = Math.floor((size - padding * 2) / dimension);

  return (
    <View style={[styles.frame, { width: size, height: size, padding }]}>
      <View style={styles.grid}>
        {cells.map((cell, index) => (
          <View
            key={index}
            style={[
              styles.cell,
              cell ? styles.cellFilled : styles.cellEmpty,
              {
                width: cellSize,
                height: cellSize,
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderRadius: 28,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  grid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  cell: {
    borderRadius: 2,
  },
  cellFilled: {
    backgroundColor: colors.black,
  },
  cellEmpty: {
    backgroundColor: 'transparent',
  },
});
