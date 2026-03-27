import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';

import { colors, radius, spacing, typography } from '../theme';

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'result';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const variantStyle =
    variant === 'primary'
      ? styles.primary
      : variant === 'secondary'
        ? styles.secondary
        : variant === 'danger'
          ? styles.danger
          : variant === 'result'
            ? styles.result
            : styles.ghost;

  const textStyle =
    variant === 'primary' || variant === 'danger' || variant === 'result'
      ? styles.lightText
      : styles.darkText;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variantStyle,
        pressed && !disabled && styles.pressed,
        (disabled || loading) && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'secondary' || variant === 'ghost' ? colors.blue : '#fff'} />
      ) : (
        <Text style={[styles.label, textStyle]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: colors.gold,
  },
  secondary: {
    backgroundColor: colors.blueSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  result: {
    backgroundColor: colors.navy,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  darkText: {
    color: colors.text,
  },
  lightText: {
    color: '#fff',
  },
  pressed: {
    transform: [{ scale: 0.985 }],
    opacity: 0.95,
  },
  disabled: {
    opacity: 0.55,
  },
});
