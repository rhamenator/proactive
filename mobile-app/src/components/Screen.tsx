import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme';

type ScreenProps = {
  children: ReactNode;
};

export function Screen({ children }: ScreenProps) {
  return (
    <View style={styles.root}>
      <View style={styles.glowLeft} pointerEvents="none" />
      <View style={styles.glowRight} pointerEvents="none" />
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
        {children}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.cream,
  },
  safe: {
    flex: 1,
  },
  glowLeft: {
    position: 'absolute',
    top: -60,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: 'rgba(29,95,167,0.10)',
  },
  glowRight: {
    position: 'absolute',
    top: 140,
    right: -90,
    width: 220,
    height: 220,
    borderRadius: 999,
    backgroundColor: 'rgba(212,165,42,0.10)',
  },
});
