/**
 * Report/block sheet (P5 E5). Six design reasons; reports are write-only
 * (triage in Studio). Block severs server-side; we just invalidate.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { qk } from '@/lib/queryKeys';
import { block, insertReport, type ReportReason } from '@/lib/safety';
import {
  borderWidth,
  colors,
  fonts,
  radius,
  sizing,
  spacing,
  textStyles,
  typeScale,
} from '@/theme/theme';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'inappropriate_behaviour', label: 'Inappropriate behaviour' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'impersonation', label: 'Fake or impersonation' },
  { value: 'safety_concern', label: 'Safety concern' },
  { value: 'spam', label: 'Spam or scam' },
  { value: 'other', label: 'Something else' },
];

export interface ReportSheetProps {
  visible: boolean;
  onClose: () => void;
  subjectUserId: string;
  subjectName: string;
  runId?: string;
  messageId?: string;
  /** Called after a successful block (e.g. to navigate away). */
  onBlocked?: () => void;
}

export function ReportSheet({
  visible,
  onClose,
  subjectUserId,
  subjectName,
  runId,
  messageId,
  onBlocked,
}: ReportSheetProps) {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [working, setWorking] = useState(false);
  const [toast, setToast] = useState(false);

  const reset = () => {
    setReason(null);
    setNote('');
    setToast(false);
  };

  const submit = async () => {
    if (!reason) return;
    setWorking(true);
    try {
      await insertReport({ subjectUserId, reason, note: note.trim(), runId, messageId });
      setToast(true);
      setTimeout(() => {
        reset();
        onClose();
      }, 1500);
    } catch {
      setWorking(false);
    } finally {
      setWorking(false);
    }
  };

  // Blocking severs server-side; every surface the A3 table names refetches.
  const invalidateAfterBlock = () => {
    void queryClient.invalidateQueries({ queryKey: qk.blocks() });
    void queryClient.invalidateQueries({ queryKey: qk.runsNearbyAll() });
    void queryClient.invalidateQueries({ queryKey: qk.runsSearchAll() });
    void queryClient.invalidateQueries({ queryKey: qk.runsMine() });
    void queryClient.invalidateQueries({ queryKey: qk.runsPast() });
    void queryClient.invalidateQueries({ queryKey: qk.conversations() });
    void queryClient.invalidateQueries({ queryKey: ['conversation'] }); // all chat streams
    void queryClient.invalidateQueries({ queryKey: qk.notifications() });
    void queryClient.invalidateQueries({ queryKey: ['leaderboard'] }); // every week/city
    void queryClient.invalidateQueries({ queryKey: ['reviews'] }); // every reviewee
    void queryClient.invalidateQueries({ queryKey: ['run'] }); // run details + members
  };

  const confirmBlock = () =>
    Alert.alert(
      `Block ${subjectName}?`,
      'They disappear from your runs, chats and leaderboard. They won’t be told.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            await block(subjectUserId);
            invalidateAfterBlock();
            reset();
            onClose();
            onBlocked?.();
          },
        },
      ],
    );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropTouch} onPress={onClose} />
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Report {subjectName}</Text>
            <Text style={textStyles.caption}>
              Reports are private. Pick what happened — our safety team reviews every one.
            </Text>

            {toast ? (
              <View style={styles.toast}>
                <Text style={styles.toastText}>Thanks — sent to our safety team.</Text>
              </View>
            ) : (
              <>
                <View style={styles.reasons}>
                  {REASONS.map((r) => {
                    const selected = reason === r.value;
                    return (
                      <Pressable
                        key={r.value}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={[styles.reasonRow, selected && styles.reasonSelected]}
                        onPress={() => setReason(r.value)}
                      >
                        <View style={[styles.radio, selected && styles.radioOn]} />
                        <Text style={styles.reasonLabel}>{r.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Input
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={500}
                  placeholder="Anything else we should know? (optional)"
                />
                <Button
                  label={working ? 'SENDING…' : reason ? 'SUBMIT REPORT' : 'PICK A REASON'}
                  full
                  disabled={!reason || working}
                  onPress={() => void submit()}
                />
                <View style={styles.orRow}>
                  <View style={styles.orLine} />
                  <Text style={styles.orText}>OR</Text>
                  <View style={styles.orLine} />
                </View>
                <Button
                  label={`BLOCK ${subjectName.toUpperCase()}`}
                  variant="danger"
                  full
                  onPress={confirmBlock}
                />
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,12,0.5)',
    justifyContent: 'flex-end',
  },
  backdropTouch: { flex: 1 },
  sheet: {
    backgroundColor: colors.paper,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    maxHeight: '85%',
  },
  content: {
    padding: sizing.gutter,
    paddingBottom: spacing.sp10,
    gap: spacing.sp4,
  },
  title: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.d3,
    color: colors.ink900,
    textTransform: 'uppercase',
  },
  reasons: { gap: spacing.sp2 },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
    borderRadius: radius.sm,
    padding: spacing.sp3,
  },
  reasonSelected: { borderColor: colors.ink900 },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink300,
  },
  radioOn: {
    borderWidth: 6,
    borderColor: colors.ink900,
  },
  reasonLabel: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.ink900,
  },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sp3 },
  orLine: { flex: 1, height: 1, backgroundColor: colors.ink200 },
  orText: { ...textStyles.eyebrow, color: colors.ink400 },
  toast: {
    backgroundColor: colors.goSoft,
    borderRadius: radius.md,
    padding: spacing.sp4,
    alignItems: 'center',
  },
  toastText: {
    fontFamily: fonts.bodySemiBold,
    fontSize: typeScale.tSm,
    color: colors.go,
  },
});
