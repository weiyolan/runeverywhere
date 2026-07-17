/**
 * Create step 1/4 (P2 G3) — pick the run type; selecting auto-advances.
 */
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WizardHeader } from '@/components/create/WizardHeader';
import { TypeChip } from '@/components/ui/TypeChip';
import { useCreateRunDraft } from '@/stores/createRun';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  runType,
  semantic,
  sizing,
  spacing,
  typeScale,
  type RunType,
} from '@/theme/theme';

const BLURBS: Record<RunType, string> = {
  discover: 'Explore a city or route — sightsee on foot at an easy effort.',
  challenge: 'Race pace or hard effort — push together, regroup at the top.',
  social: 'Easy, chatty meet-up or recovery — all paces welcome.',
};

export default function CreateTypeScreen() {
  const draft = useCreateRunDraft();

  const pick = (type: RunType) => {
    draft.set({ type });
    router.push('/create/location');
  };

  return (
    <View style={styles.screen}>
      <WizardHeader step={1} title="What kind of run?" />
      <View style={styles.cards}>
        {(Object.keys(BLURBS) as RunType[]).map((t) => (
          <Pressable
            key={t}
            accessibilityRole="button"
            accessibilityState={{ selected: draft.type === t }}
            onPress={() => pick(t)}
            style={[styles.card, draft.type === t && { borderColor: runType[t].main }]}
          >
            <TypeChip type={t} />
            <Text style={styles.blurb}>{BLURBS[t]}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper2,
    paddingHorizontal: sizing.gutter,
  },
  cards: { gap: spacing.sp3, marginTop: spacing.sp5 },
  card: {
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    borderWidth: borderWidth.bold,
    borderColor: colors.ink200,
    padding: spacing.sp4,
    gap: spacing.sp2,
  },
  blurb: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: semantic.textSecondary,
  },
});
