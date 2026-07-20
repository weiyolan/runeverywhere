import { router } from 'expo-router';
import { Check, Eye, EyeOff } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthShell, OrDivider } from '@/components/auth/AuthShell';
import { ProviderButton } from '@/components/auth/ProviderButton';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  appleSignInAvailable,
  prefillDisplayName,
  signInWithApple,
  signInWithGoogle,
  signUpWithEmail,
} from '@/lib/auth';
import { LEGAL_URLS } from '@/lib/legal';
import { mapAuthError, signUpSchema } from '@/lib/validation/auth';
import { useSession } from '@/stores/session';
import { borderWidth, colors, fonts, radius, spacing, textStyles, typeScale } from '@/theme/theme';

export default function SignUpScreen() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const refreshProfile = useSession((s) => s.refreshProfile);

  useEffect(() => {
    void appleSignInAvailable().then(setAppleAvailable);
  }, []);

  const valid = signUpSchema.safeParse({ displayName, email, password }).success && tosAccepted;

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const res = await signUpWithEmail({
        displayName: displayName.trim(),
        email: email.trim(),
        password,
      });
      if (res.needsEmailConfirm) setNeedsEmailConfirm(true);
      // Otherwise AuthGate lands on onboarding/profile.
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

  if (needsEmailConfirm) {
    // Unreachable while confirmations are off (P1 decision 9); future-proofing.
    return (
      <AuthShell title="CHECK YOUR EMAIL" subtitle="Confirm your address, then log in.">
        <Button label="BACK TO LOG IN" full onPress={() => router.replace('/(auth)/sign-in')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="CREATE ACCOUNT" subtitle="Start with the basics.">
      <View style={styles.form}>
        <Input
          label="FULL NAME"
          value={displayName}
          onChangeText={setDisplayName}
          autoComplete="name"
          maxLength={40}
        />
        <Input
          label="EMAIL"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Input
          label="PASSWORD"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
          autoComplete="new-password"
          invalid={error != null}
          hint={error ?? 'Use 8+ characters with letters and numbers.'}
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

        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: tosAccepted }}
          onPress={() => setTosAccepted((v) => !v)}
          style={styles.tosRow}
        >
          <View style={[styles.checkbox, tosAccepted && styles.checkboxOn]}>
            {tosAccepted ? <Check size={15} color={colors.volt} strokeWidth={3} /> : null}
          </View>
          <Text style={[textStyles.caption, styles.tosText]}>
            I agree to the{' '}
            <Text style={styles.tosLink} onPress={() => void Linking.openURL(LEGAL_URLS.terms)}>
              Terms of Service
            </Text>{' '}
            and{' '}
            <Text style={styles.tosLink} onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}>
              Privacy Policy
            </Text>
            .
          </Text>
        </Pressable>

        <Button
          label={working ? 'CREATING ACCOUNT…' : 'CONTINUE'}
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
        <Text style={textStyles.caption}>Already have an account? </Text>
        <Pressable onPress={() => router.replace('/(auth)/sign-in')} hitSlop={8}>
          <Text style={styles.footerLink}>LOG IN</Text>
        </Pressable>
      </View>
    </AuthShell>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: spacing.sp4,
  },
  tosRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp3,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.xs,
    borderWidth: borderWidth.mid,
    borderColor: colors.ink200,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: {
    backgroundColor: colors.ink900,
    borderColor: colors.ink900,
  },
  tosText: {
    flex: 1,
  },
  tosLink: {
    fontFamily: fonts.bodyBold,
    color: colors.ink900,
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
