import { Link, router } from 'expo-router';
import { Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell, OrDivider } from '@/components/auth/AuthShell';
import { ProviderButton } from '@/components/auth/ProviderButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  appleSignInAvailable,
  prefillDisplayName,
  signInWithApple,
  signInWithEmail,
  signInWithGoogle,
} from '@/lib/auth';
import { mapAuthError, signInSchema } from '@/lib/validation/auth';
import { useSession } from '@/stores/session';
import { colors, fonts, spacing, textStyles, typeScale } from '@/theme/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const refreshProfile = useSession((s) => s.refreshProfile);

  useEffect(() => {
    void appleSignInAvailable().then(setAppleAvailable);
  }, []);

  const valid = signInSchema.safeParse({ email, password }).success;

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      await signInWithEmail({ email: email.trim(), password });
      // AuthGate routes on the session change.
    } catch (e) {
      setError(mapAuthError(e));
    } finally {
      setWorking(false);
    }
  };

  const oauth = async (flow: () => Promise<{ fullName: string | null } | null>) => {
    setError(null);
    try {
      const res = await flow();
      if (res) {
        await prefillDisplayName(res.fullName);
        await refreshProfile();
      }
    } catch (e) {
      setError(mapAuthError(e));
    }
  };

  return (
    <AuthShell title="WELCOME BACK" subtitle="Log in to keep running with your people.">
      <View style={styles.form}>
        <Input
          label="EMAIL"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <View>
          <View style={styles.passwordLabelRow}>
            <Link href="/(auth)/forgot-password" style={styles.forgot}>
              FORGOT?
            </Link>
          </View>
          <Input
            label="PASSWORD"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete="current-password"
            invalid={error != null}
            hint={error ?? undefined}
            trailing={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                onPress={() => setShowPassword((v) => !v)}
                hitSlop={8}
              >
                {showPassword ? (
                  <EyeOff size={18} color={colors.ink400} />
                ) : (
                  <Eye size={18} color={colors.ink400} />
                )}
              </Pressable>
            }
          />
        </View>
        <Button
          label={working ? 'LOGGING IN…' : 'LOG IN'}
          full
          disabled={!valid || working}
          onPress={() => void submit()}
        />
      </View>

      <OrDivider />

      <View style={styles.providers}>
        {appleAvailable ? (
          <ProviderButton provider="apple" onPress={() => void oauth(signInWithApple)} />
        ) : null}
        <ProviderButton provider="google" onPress={() => void oauth(signInWithGoogle)} />
      </View>

      <View style={styles.footer}>
        <Text style={textStyles.caption}>New here? </Text>
        <Pressable onPress={() => router.replace('/(auth)/sign-up')} hitSlop={8}>
          <Text style={styles.footerLink}>CREATE ACCOUNT</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sp4,
  },
  passwordLabelRow: {
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1,
  },
  forgot: {
    fontFamily: fonts.display,
    fontSize: typeScale.tXs,
    color: colors.discover,
  },
  providers: {
    gap: spacing.sp3,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerLink: {
    fontFamily: fonts.displayExtra,
    fontSize: typeScale.tSm,
    color: colors.ink900,
  },
});
