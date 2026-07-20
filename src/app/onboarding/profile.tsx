import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { Camera, Check } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { StepShell } from '@/components/onboarding/StepShell';
import { Input } from '@/components/ui/Input';
import { LEGAL_URLS } from '@/lib/legal';
import { updateProfile, uploadAvatar } from '@/lib/profile';
import { useSession } from '@/stores/session';
import { borderWidth, colors, fonts, radius, spacing, textStyles } from '@/theme/theme';

/** Step 1/4 "ADD YOUR PROFILE" (P1 H2) — photo, name, bio (+ ToS for OAuth). */
export default function OnboardingProfileScreen() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [tosAccepted, setTosAccepted] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsTos = profile != null && profile.tos_accepted_at == null;
  const previewUri = pickedUri ?? profile?.avatar_url ?? null;
  const valid =
    displayName.trim().length >= 1 && displayName.trim().length <= 40 && (!needsTos || tosAccepted);

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      exif: false,
    });
    if (!res.canceled && res.assets[0]) setPickedUri(res.assets[0].uri);
  };

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const avatar_url = pickedUri ? await uploadAvatar(pickedUri) : undefined;
      await updateProfile({
        display_name: displayName.trim(),
        bio: bio.trim(),
        ...(avatar_url ? { avatar_url } : {}),
        ...(needsTos ? { tos_accepted_at: new Date().toISOString() } : {}),
      });
      await refreshProfile();
      router.push('/onboarding/location');
    } catch {
      setError('Could not save — check your connection and try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <StepShell
      step={1}
      title="ADD YOUR PROFILE"
      subtitle="Show other runners who they'll be running with."
      ctaDisabled={!valid}
      working={working}
      error={error}
      onContinue={() => void submit()}
    >
      <View style={styles.avatarBlock}>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a profile photo" onPress={() => void pickPhoto()}>
          <View style={styles.avatarCircle}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.avatarImage} contentFit="cover" />
            ) : null}
          </View>
          <View style={styles.cameraBadge}>
            <Camera size={20} color={colors.voltInk} />
          </View>
        </Pressable>
        <Text style={textStyles.caption}>Tap to add a profile photo</Text>
      </View>

      <View style={styles.form}>
        <Input
          label="DISPLAY NAME"
          value={displayName}
          onChangeText={setDisplayName}
          maxLength={40}
          autoComplete="name"
        />
        <Input
          label="BIO"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={160}
          hint={`${bio.length}/160`}
        />
        {needsTos ? (
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
        ) : null}
      </View>
    </StepShell>
  );
}

const AVATAR = 124;

const styles = StyleSheet.create({
  avatarBlock: {
    alignItems: 'center',
    gap: spacing.sp3,
  },
  avatarCircle: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.ink100,
    borderWidth: 3,
    borderColor: colors.ink900,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.paper2,
  },
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
});
