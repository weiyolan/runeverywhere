/**
 * IconButton — port of `project/components/buttons/IconButton.d.ts` (P1 D2).
 * Icon-only control: back, share, filter, map recenter. A single icon element
 * child gets the variant's glyph color injected unless it sets its own.
 */
import { cloneElement, isValidElement, useState } from 'react';
import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { borderWidth, colors, motion, radius, semantic, shadows } from '@/theme/theme';

export type IconButtonVariant = 'surface' | 'ink' | 'volt' | 'ghost' | 'danger';

export interface IconButtonProps {
  variant?: IconButtonVariant;
  /** 36 / 44 / 52. Default "md" (44px hit target). */
  size?: 'sm' | 'md' | 'lg';
  /** Circular instead of squared. */
  round?: boolean;
  /** Toggled-on state (ink fill, volt glyph). */
  active?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  accessibilityLabel: string;
}

const DIMS = { sm: 36, md: 44, lg: 52 } as const;

const VARIANTS: Record<IconButtonVariant, { bg: string; fg: string; border?: string; shadow?: ViewStyle }> = {
  surface: { bg: semantic.bgSurface, fg: colors.ink900, border: colors.ink200, shadow: shadows.sm },
  ink: { bg: colors.ink900, fg: colors.paper },
  volt: { bg: colors.volt, fg: colors.voltInk },
  ghost: { bg: 'transparent', fg: colors.ink900 },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
};

export function IconButton({
  variant = 'surface',
  size = 'md',
  round = false,
  active = false,
  disabled = false,
  onPress,
  children,
  accessibilityLabel,
}: IconButtonProps) {
  const [pressed, setPressed] = useState(false);
  const v = VARIANTS[variant];
  const bg = active ? colors.ink900 : v.bg;
  const fg = active ? colors.volt : v.fg;
  const d = DIMS[size];

  const icon =
    isValidElement<{ color?: string }>(children) && children.props.color === undefined
      ? cloneElement(children, { color: fg })
      : children;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, selected: active }}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        v.shadow,
        {
          width: d,
          height: d,
          borderRadius: round ? radius.pill : radius.sm,
          backgroundColor: bg,
          ...(v.border && !active
            ? { borderWidth: borderWidth.mid, borderColor: v.border }
            : null),
          transform: [{ scale: pressed ? motion.pressScale : 1 }],
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default IconButton;
