/**
 * Button — port of `project/components/buttons/Button.d.ts`.
 * Labels are ALWAYS short, uppercase, verb-first ("REQUEST TO JOIN").
 * One primary (volt) per screen.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import {
  borderWidth,
  fonts,
  letterSpacing,
  motion,
  radius,
  semantic,
  shadows,
  sizing,
  tracking,
  typeScale,
} from '@/theme/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'volt-outline';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md' | 'lg';
  shape?: 'rounded' | 'pill' | 'square';
  /** Stretch to fill the row. */
  full?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
  disabled?: boolean;
}

const HEIGHTS = { sm: sizing.controlHSm, md: sizing.controlH, lg: 60 } as const;
const FONT_SIZES = { sm: typeScale.tSm, md: typeScale.tMd, lg: typeScale.tLg } as const;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  shape = 'rounded',
  full = false,
  iconLeft,
  iconRight,
  disabled = false,
}: ButtonProps) {
  const [pressed, setPressed] = useState(false);

  const palette: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: pressed ? semantic.actionPress : semantic.action, fg: semantic.actionInk },
    secondary: { bg: semantic.bgInverse, fg: semantic.textOnDark },
    ghost: { bg: 'transparent', fg: semantic.textPrimary, border: semantic.borderStrong },
    danger: { bg: semantic.bgSurface, fg: '#E5342A', border: '#E5342A' },
    'volt-outline': { bg: 'transparent', fg: semantic.textOnDark, border: semantic.action },
  };
  const { bg, fg, border } = palette[variant];

  const containerStyle: ViewStyle = {
    height: HEIGHTS[size],
    borderRadius: shape === 'pill' ? radius.pill : shape === 'square' ? radius.xs : radius.md,
    backgroundColor: bg,
    ...(border ? { borderWidth: borderWidth.bold, borderColor: border } : null),
    ...(variant === 'primary' && !disabled ? shadows.volt : null),
    ...(full ? { alignSelf: 'stretch' as const } : null),
    transform: [{ scale: pressed ? motion.pressScale : 1 }],
    opacity: disabled ? 0.4 : 1,
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[styles.base, containerStyle]}
    >
      {iconLeft ? <View style={styles.icon}>{iconLeft}</View> : null}
      <Text
        style={[
          styles.label,
          {
            color: fg,
            fontSize: FONT_SIZES[size],
            letterSpacing: letterSpacing(FONT_SIZES[size], tracking.caps),
          },
        ]}
      >
        {label}
      </Text>
      {iconRight ? <View style={styles.icon}>{iconRight}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    minWidth: sizing.touchMin,
  },
  label: {
    fontFamily: fonts.display,
    textTransform: 'uppercase',
  },
  icon: {
    marginHorizontal: 6,
  },
});

export default Button;
