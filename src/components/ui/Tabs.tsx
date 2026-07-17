/**
 * Tabs — port of `project/components/navigation/Tabs.d.ts` (P2 C1).
 * Underline for section nav (ALL / MANAGED BY YOU / JOINED); pill for
 * map↔list and filter toggles.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  borderWidth,
  colors,
  fonts,
  letterSpacing,
  radius,
  tracking,
  typeScale,
} from '@/theme/theme';

export interface TabItem {
  id: string;
  label: string;
  /** Count badge (e.g. JOINED · 3). */
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onChange?: (id: string) => void;
  /** "underline" for section nav, "pill" for toggles. Default "underline". */
  variant?: 'underline' | 'pill';
  /** Active-state accent color — pass a run-type token to color by type. */
  accent?: string;
  /** Stretch tabs to fill width. Default true. */
  full?: boolean;
}

export function Tabs({
  items,
  value,
  onChange,
  variant = 'underline',
  accent = colors.ink900,
  full = true,
}: TabsProps) {
  const pill = variant === 'pill';

  return (
    <View style={[pill ? styles.barPill : styles.barUnderline, !full && styles.barHug]}>
      {items.map((it) => {
        const active = it.id === value;
        const fg = pill
          ? active
            ? colors.paper
            : colors.ink500
          : active
            ? colors.ink900
            : colors.ink400;
        return (
          <Pressable
            key={it.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange?.(it.id)}
            style={[
              pill ? styles.tabPill : styles.tabUnderline,
              full && styles.tabFull,
              pill && active && { backgroundColor: accent },
              !pill && { borderBottomColor: active ? accent : 'transparent' },
            ]}
          >
            <Text style={[styles.label, { color: fg }]}>{it.label}</Text>
            {it.count != null ? (
              <View
                style={[
                  styles.count,
                  {
                    backgroundColor: active
                      ? pill
                        ? 'rgba(255,255,255,0.25)'
                        : accent
                      : colors.ink200,
                  },
                ]}
              >
                <Text style={[styles.countText, { color: active ? colors.paper : colors.ink500 }]}>
                  {it.count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  barUnderline: {
    flexDirection: 'row',
    borderBottomWidth: borderWidth.mid,
    borderBottomColor: colors.ink200,
  },
  barPill: {
    flexDirection: 'row',
    gap: 4,
    backgroundColor: colors.paper3,
    borderRadius: radius.pill,
    padding: 4,
  },
  barHug: {
    alignSelf: 'flex-start',
  },
  tabFull: {
    flex: 1,
  },
  tabUnderline: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    // Active underline sits on top of the bar's hairline
    borderBottomWidth: 3,
    marginBottom: -borderWidth.mid,
  },
  tabPill: {
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
  },
  label: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.dEyebrow,
    textTransform: 'uppercase',
    letterSpacing: letterSpacing(typeScale.dEyebrow, tracking.caps),
  },
  count: {
    borderRadius: radius.pill,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  countText: {
    fontFamily: fonts.bodyBold,
    fontSize: typeScale.t2xs,
  },
});

export default Tabs;
