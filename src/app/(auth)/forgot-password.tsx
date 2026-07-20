import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { AuthShell } from '@/components/auth/AuthShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { exchangeResetCode, requestPasswordReset, updatePassword } from '@/lib/auth';
import { mapAuthError, passwordSchema } from '@/lib/validation/auth';
import { useSession } from '@/stores/session';
import { colors, spacing, textStyles } from '@/theme/theme';

/**
 * Two modes in one route (P1 F4): request (default) and reset — activated by
 * the deep link `runeverywhere://forgot-password?code=…`. The `recovering`
 * flag suspends AuthGate redirects while the exchange + new password happen.
 */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ code?: string; error?: string; error_code?: string }>();
  const setRecovering = useSession((s) => s.setRecovering);

  // Request mode state
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  // Reset mode state
  const [exchanged, setExchanged] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [updated, setUpdated] = useState(false);

  const [working, setWorking] = useState(false);
  // Supabase error redirects (expired/invalid link) arrive without a code.
  const [error, setError] = useState<string | null>(() =>
    params.error_code === 'otp_expired' || params.error
      ? 'That link expired — request a new one.'
      : null,
  );

  const code = typeof params.code === 'string' ? params.code : undefined;
  const resetMode = code != null;

  useEffect(() => {
    if (!code) return;
    setRecovering(true);
    exchangeResetCode(code)
      .then(() => setExchanged(true))
      .catch(() => {
        // PKCE cross-device failure or expired code.
        setError('That link expired — request a new one.');
        setRecovering(false);
      });
    // Reset-mode teardown happens explicitly on submit success.
  }, [code, setRecovering]);

  const submitRequest = async () => {
    setWorking(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setWorking(false);
    }
  };

  const passwordsValid =
    passwordSchema.safeParse(newPassword).success && newPassword === confirmPassword;

  const submitNewPassword = async () => {
    setWorking(true);
    setError(null);
    try {
      await updatePassword(newPassword);
      setUpdated(true);
      // AuthGate resumes routing (tabs or onboarding) once recovering clears.
      setTimeout(() => setRecovering(false), 1200);
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setWorking(false);
    }
  };

  if (resetMode && exchanged) {
    return (
      <AuthShell title="NEW PASSWORD" subtitle="Set a new password for your account.">
        <View style={styles.form}>
          <Input
            label="NEW PASSWORD"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            autoComplete="new-password"
            hint="Use 8+ characters with letters and numbers."
          />
          <Input
            label="CONFIRM PASSWORD"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoComplete="new-password"
            invalid={confirmPassword.length > 0 && newPassword !== confirmPassword}
            hint={
              confirmPassword.length > 0 && newPassword !== confirmPassword
                ? 'Passwords do not match.'
                : undefined
            }
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {updated ? <Text style={styles.success}>Password updated.</Text> : null}
          <Button
            label={working ? 'SAVING…' : 'SET NEW PASSWORD'}
            full
            disabled={!passwordsValid || working || updated}
            onPress={() => void submitNewPassword()}
          />
        </View>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="RESET PASSWORD" subtitle="We'll email you a reset link.">
      {sent ? (
        <View style={styles.form}>
          <Text style={textStyles.body}>Check your email — open the link on this phone.</Text>
          <Button
            label="BACK TO LOG IN"
            variant="secondary"
            full
            onPress={() => router.replace('/(auth)/sign-in')}
          />
        </View>
      ) : (
        <View style={styles.form}>
          <Input
            label="EMAIL"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button
            label={working ? 'SENDING…' : 'SEND RESET LINK'}
            full
            disabled={email.trim().length === 0 || working}
            onPress={() => void submitRequest()}
          />
        </View>
      )}
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sp4,
  },
  error: {
    ...textStyles.caption,
    color: colors.danger,
  },
  success: {
    ...textStyles.caption,
    color: colors.go,
  },
});
