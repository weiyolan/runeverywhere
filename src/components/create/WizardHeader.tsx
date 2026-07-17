/**
 * Create-wizard header: STEP n/4 eyebrow, optional back, close with
 * confirm-discard when the draft is dirty (P2 G3).
 */
import { router } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/IconButton';
import { useCreateRunDraft } from '@/stores/createRun';
import { spacing, textStyles } from '@/theme/theme';

export function WizardHeader({ step, title }: { step: number; title: string }) {
  const insets = useSafeAreaInsets();
  const isDirty = useCreateRunDraft((s) => s.isDirty);
  const reset = useCreateRunDraft((s) => s.reset);

  const close = () => {
    const dismiss = () => {
      reset();
      router.dismissAll();
    };
    if (isDirty()) {
      Alert.alert('Discard this run?', 'Your draft will be lost.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: dismiss },
      ]);
    } else {
      dismiss();
    }
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sp2 }]}>
      <View style={styles.row}>
        {step > 1 ? (
          <IconButton accessibilityLabel="Back" variant="ghost" onPress={() => router.back()}>
            <ArrowLeft size={20} />
          </IconButton>
        ) : (
          <View style={styles.spacer} />
        )}
        <Text style={textStyles.eyebrow}>STEP {step} / 4</Text>
        <IconButton accessibilityLabel="Close" variant="ghost" onPress={close}>
          <X size={20} />
        </IconButton>
      </View>
      <Text style={textStyles.screenTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.sp2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  spacer: { width: 44 },
});

export default WizardHeader;
