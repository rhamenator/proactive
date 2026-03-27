import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type PillProps = {
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'gold';
};

export function Pill({ label, tone = 'default' }: PillProps) {
  return (
    <View style={[styles.base, toneStyles[tone]]}>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.md,
  },
  label: {
    fontSize: typography.small,
    fontWeight: '800',
    color: colors.text,
  },
});

const toneStyles = StyleSheet.create({
  default: {
    backgroundColor: colors.blueSoft,
  },
  success: {
    backgroundColor: '#E3F5EC',
  },
  warning: {
    backgroundColor: '#FCEFCC',
  },
  danger: {
    backgroundColor: '#F8E0DC',
  },
  gold: {
    backgroundColor: colors.goldSoft,
  },
});
