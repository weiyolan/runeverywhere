/** Account & security (P5 F9): email change, password change, delete account. */
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { supabase } from '@/lib/supabase';
import { passwordSchema } from '@/lib/validation/auth';
import { useSession } from '@/stores/session';
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

export default function AccountScreen() {
  const insets = useSafeAreaInsets();
  const session = useSession((s) => s.session);
  const signOut = useSession((s) => s.signOut);

  const [newEmail, setNewEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [passwordDone, setPasswordDone] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const changeEmail = async () => {
    setWorking('email');
    setError(null);
    try {
      const { error: e } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (e) throw e;
      setEmailSent(true);
    } catch {
      setError('Could not start the email change — try again.');
    } finally {
      setWorking(null);
    }
  };

  const passwordsValid = passwordSchema.safeParse(password).success && password === password2;

  const changePassword = async () => {
    setWorking('password');
    setError(null);
    setPasswordDone(false);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      setPasswordDone(true);
      setPassword('');
      setPassword2('');
    } catch {
      setError('Could not update the password — try again.');
    } finally {
      setWorking(null);
    }
  };

  const deleteAccount = async () => {
    setWorking('delete');
    setDeleteError(null);
    try {
      const { data, error: e } = await supabase.functions.invoke('delete-account', {
        body: { confirm: 'DELETE' },
      });
      if (e || !(data as { ok?: boolean } | null)?.ok) {
        throw e ?? new Error('delete failed');
      }
      await signOut();
      router.replace('/(auth)/welcome');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Deletion failed — try again.');
    } finally {
      setWorking(null);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Back" onPress={() => router.back()}>
          <ArrowLeft size={22} />
        </IconButton>
        <Text style={textStyles.sectionHeader}>Account &amp; security</Text>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.sp10 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>EMAIL</Text>
          <Text style={textStyles.caption}>Current: {session?.user.email ?? '—'}</Text>
          {emailSent ? (
            <View style={styles.infoBanner}>
              <Text style={styles.infoText}>Check both inboxes to confirm the change.</Text>
            </View>
          ) : (
            <>
              <Input
                label="NEW EMAIL"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Button
                label={working === 'email' ? 'SENDING…' : 'SEND CONFIRMATION'}
                variant="secondary"
                full
                disabled={newEmail.trim().length === 0 || working != null}
                onPress={() => void changeEmail()}
              />
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>PASSWORD</Text>
          <Input
            label="NEW PASSWORD"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            hint="Use 8+ characters with letters and numbers."
          />
          <Input
            label="CONFIRM PASSWORD"
            value={password2}
            onChangeText={setPassword2}
            secureTextEntry
            invalid={password2.length > 0 && password !== password2}
            hint={password2.length > 0 && password !== password2 ? 'Passwords do not match.' : undefined}
          />
          {passwordDone ? <Text style={styles.success}>Password updated.</Text> : null}
          <Button
            label={working === 'password' ? 'UPDATING…' : 'UPDATE PASSWORD'}
            variant="secondary"
            full
            disabled={!passwordsValid || working != null}
            onPress={() => void changePassword()}
          />
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.dangerZone}>
          <Text style={styles.dangerTitle}>DANGER ZONE</Text>
          <Text style={textStyles.caption}>
            Deleting your account removes your profile, runs, messages, tracks and points. This
            cannot be undone.
          </Text>
          <Button label="DELETE ACCOUNT" variant="danger" full onPress={() => setDeleteOpen(true)} />
        </View>
      </ScrollView>

      <Modal visible={deleteOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.dangerTitle}>DELETE YOUR ACCOUNT?</Text>
            <Text style={textStyles.caption}>
              Everything goes: profile, runs, chats, tracks and points. Type DELETE to confirm.
            </Text>
            <Input value={deleteText} onChangeText={setDeleteText} placeholder="DELETE" autoCapitalize="characters" />
            {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
            <Button
              label={working === 'delete' ? 'DELETING…' : 'DELETE FOREVER'}
              variant="danger"
              full
              disabled={deleteText !== 'DELETE' || working != null}
              onPress={() => void deleteAccount()}
            />
            <Button label="CANCEL" variant="ghost" full onPress={() => setDeleteOpen(false)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    paddingHorizontal: spacing.sp3,
    paddingBottom: spacing.sp2,
  },
  content: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    gap: spacing.sp6,
  },
  section: { gap: spacing.sp3 },
  infoBanner: {
    backgroundColor: colors.discoverSoft,
    borderRadius: radius.sm,
    padding: spacing.sp3,
  },
  infoText: {
    fontFamily: fonts.bodyMedium,
    fontSize: typeScale.tSm,
    color: colors.discover,
  },
  success: { ...textStyles.caption, color: colors.go },
  error: { ...textStyles.caption, color: colors.danger },
  dangerZone: {
    gap: spacing.sp3,
    borderWidth: borderWidth.mid,
    borderColor: colors.dangerSoft,
    borderRadius: radius.md,
    padding: spacing.sp4,
  },
  dangerTitle: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tMd,
    color: colors.danger,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11,11,12,0.6)',
    justifyContent: 'center',
    paddingHorizontal: sizing.gutter,
  },
  modalCard: {
    backgroundColor: colors.paper,
    borderRadius: radius.lg,
    padding: spacing.sp5,
    gap: spacing.sp3,
  },
});
