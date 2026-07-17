/**
 * Avatar — port of `project/components/data/Avatar.d.ts` (P2 C3).
 * Runner photo with initials fallback, verified tick, optional status ring.
 */
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { borderWidth, colors, fonts, radius, semantic } from '@/theme/theme';

export interface AvatarProps {
  src?: string | null;
  /** Initials fallback source when no photo. */
  name?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Verified runner tick (go-green). */
  verified?: boolean;
  /** Status ring color token (e.g. colors.volt, colors.go). */
  ring?: string | null;
}

const DIMS = { xs: 24, sm: 32, md: 40, lg: 56, xl: 84 } as const;

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export function Avatar({ src, name, size = 'md', verified = false, ring }: AvatarProps) {
  const d = DIMS[size];
  const tick = Math.max(16, d * 0.34);

  return (
    <View style={{ width: d, height: d }}>
      <View
        style={[
          styles.circle,
          { width: d, height: d },
          ring ? { borderWidth: 2, borderColor: ring } : null,
        ]}
      >
        {src ? (
          <Image
            source={{ uri: src }}
            cachePolicy="memory-disk"
            style={styles.photo}
            accessibilityLabel={name ?? undefined}
          />
        ) : (
          <Text style={[styles.initials, { fontSize: Math.max(10, d * 0.34) }]}>
            {name ? initials(name) : ''}
          </Text>
        )}
      </View>
      {verified ? (
        <View
          accessibilityLabel="Verified runner"
          style={[styles.tick, { width: tick, height: tick }]}
        >
          <View style={styles.tickGlyph} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    borderRadius: radius.pill,
    overflow: 'hidden',
    backgroundColor: colors.ink100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  initials: {
    fontFamily: fonts.display,
    color: colors.ink700,
  },
  tick: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    borderRadius: radius.pill,
    backgroundColor: colors.go,
    borderWidth: borderWidth.bold,
    borderColor: semantic.bgSurface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** Small check mark built from a rotated border corner. */
  tickGlyph: {
    width: 7,
    height: 4,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    borderColor: colors.paper,
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
});

export default Avatar;
