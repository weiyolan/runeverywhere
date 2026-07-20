/**
 * START RUN entry point (P4 F4 + A5): first-use pre-permission explainer,
 * then the OS prompts fire from the live screen's startRecording call.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, radius, sizing, spacing, typeScale } from '@/theme/theme';

const EXPLAINER_KEY = 're.permExplainerShown';

export function useStartRun() {
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);

  const go = (runId: string) => router.push(`/live/${runId}`);

  const startRun = async (runId: string) => {
    const shown = await AsyncStorage.getItem(EXPLAINER_KEY);
    if (shown) {
      go(runId);
    } else {
      setPendingRunId(runId);
    }
  };

  const explainer = (
    <Modal visible={pendingRunId != null} transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>TRACK YOUR RUN</Text>
          <Text style={styles.body}>
            To keep counting with your screen locked, Run Everywhere needs location access while
            you run. iOS will ask for &lsquo;Always&rsquo;.
          </Text>
          <Button
            label="ALLOW TRACKING"
            full
            onPress={() => {
              void AsyncStorage.setItem(EXPLAINER_KEY, '1');
              const runId = pendingRunId;
              setPendingRunId(null);
              if (runId) go(runId);
            }}
          />
          <Button
            label="NOT NOW"
            variant="ghost"
            full
            onPress={() => setPendingRunId(null)}
          />
        </View>
      </View>
    </Modal>
  );

  return { startRun, explainer };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,12,0.6)',
    justifyContent: 'flex-end',
    paddingHorizontal: sizing.gutter,
    paddingBottom: spacing.sp8,
  },
  card: {
    backgroundColor: colors.ink900,
    borderRadius: radius.lg,
    padding: spacing.sp5,
    gap: spacing.sp3,
  },
  title: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.paper,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: colors.ink300,
  },
});
