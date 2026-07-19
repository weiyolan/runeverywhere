/**
 * ProviderButton (P1 D3) — Apple/Google sign-in rows. Apple = ink fill,
 * Google = white with mid border; uppercase condensed label per the flow HTML.
 */
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  motion,
  radius,
  tracking,
  typeScale,
} from '@/theme/theme';

// Glyph paths from the design flow HTML.
function AppleGlyph({ color }: { color: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={color}>
      <Path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </Svg>
  );
}

function GoogleGlyph() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </Svg>
  );
}

export interface ProviderButtonProps {
  provider: 'apple' | 'google';
  onPress: () => void;
  disabled?: boolean;
}

export function ProviderButton({ provider, onPress, disabled = false }: ProviderButtonProps) {
  const [pressed, setPressed] = useState(false);
  const apple = provider === 'apple';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={apple ? 'Continue with Apple' : 'Continue with Google'}
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        styles.base,
        apple ? styles.apple : styles.google,
        { transform: [{ scale: pressed ? motion.pressScale : 1 }], opacity: disabled ? 0.4 : 1 },
      ]}
    >
      {apple ? <AppleGlyph color={colors.paper} /> : <GoogleGlyph />}
      <Text style={[styles.label, { color: apple ? colors.paper : colors.ink900 }]}>
        {apple ? 'CONTINUE WITH APPLE' : 'CONTINUE WITH GOOGLE'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    height: 50,
    borderRadius: radius.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  apple: {
    backgroundColor: colors.ink900,
  },
  google: {
    backgroundColor: colors.paper,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
  },
  label: {
    fontFamily: fonts.display,
    fontSize: typeScale.tSm,
    letterSpacing: letterSpacing(typeScale.tSm, tracking.caps),
  },
});
