/** Edit profile (P5 F3) — photo, name, bio, city, chips; write-through save. */
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { Camera, X } from 'lucide-react-native';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SelectChip } from '@/components/onboarding/SelectChip';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Input } from '@/components/ui/Input';
import { setHomeLocation, updateProfile, uploadAvatar } from '@/lib/profile';
import { qk } from '@/lib/queryKeys';
import { useSession } from '@/stores/session';
import { colors, sizing, spacing, textStyles } from '@/theme/theme';
import type { Database } from '@/types/database.types';

type PaceBand = Database['public']['Enums']['pace_band'];
type DistanceBand = Database['public']['Enums']['distance_band'];
type RunTypeEnum = Database['public']['Enums']['run_type'];

const PACES: PaceBand[] = ['easy', 'steady', 'quick', 'fast'];
const DISTANCES: DistanceBand[] = ['short', 'mid', 'long', 'ultra'];
const RUN_TYPES: RunTypeEnum[] = ['discover', 'challenge', 'social'];
const LANGUAGES = ['EN', 'PT', 'ES', 'FR', 'DE', 'IT'];

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [name, setName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [city, setCity] = useState(profile?.home_city ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [pace, setPace] = useState<PaceBand | null>(profile?.pace_band ?? null);
  const [distance, setDistance] = useState<DistanceBand | null>(profile?.distance_band ?? null);
  const [likes, setLikes] = useState<RunTypeEnum[]>(profile?.like_types ?? []);
  const [languages, setLanguages] = useState<string[]>(profile?.languages ?? []);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name !== (profile?.display_name ?? '') ||
    bio !== (profile?.bio ?? '') ||
    city !== (profile?.home_city ?? '') ||
    pace !== (profile?.pace_band ?? null) ||
    distance !== (profile?.distance_band ?? null) ||
    JSON.stringify(likes) !== JSON.stringify(profile?.like_types ?? []) ||
    JSON.stringify(languages) !== JSON.stringify(profile?.languages ?? []) ||
    pickedUri != null ||
    coords != null;

  const cancel = () => {
    if (dirty) {
      Alert.alert('Discard changes?', undefined, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => router.back() },
      ]);
    } else {
      router.back();
    }
  };

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

  const locate = async () => {
    setLocating(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const p = places[0];
      const nameFromGeo = p?.city || p?.subregion || p?.region;
      if (nameFromGeo) setCity(nameFromGeo);
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } finally {
      setLocating(false);
    }
  };

  const save = async () => {
    setWorking(true);
    setError(null);
    try {
      const avatar_url = pickedUri ? await uploadAvatar(pickedUri) : undefined;
      if (coords && city.trim()) {
        await setHomeLocation(coords.lat, coords.lng, city.trim());
      }
      await updateProfile({
        display_name: name.trim(),
        bio: bio.trim(),
        ...(coords ? {} : { home_city: city.trim() || null }),
        pace_band: pace,
        distance_band: distance,
        like_types: likes,
        languages,
        ...(avatar_url ? { avatar_url } : {}),
      });
      await refreshProfile();
      void queryClient.invalidateQueries({ queryKey: qk.profile(profile?.id ?? '') });
      router.back();
    } catch {
      setError('Could not save — try again.');
    } finally {
      setWorking(false);
    }
  };

  const previewUri = pickedUri ?? profile?.avatar_url ?? null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + spacing.sp3 }]}>
      <View style={styles.header}>
        <IconButton variant="ghost" accessibilityLabel="Cancel" onPress={cancel}>
          <X size={22} />
        </IconButton>
        <Text style={[textStyles.sectionHeader, styles.headerTitle]}>Edit profile</Text>
        <Button
          label={working ? 'SAVING…' : 'SAVE'}
          size="sm"
          disabled={working || name.trim().length === 0}
          onPress={() => void save()}
        />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.sp10 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarBlock}>
          <Pressable accessibilityRole="button" accessibilityLabel="Change photo" onPress={() => void pickPhoto()}>
            <View style={styles.avatarCircle}>
              {previewUri ? (
                <Image source={{ uri: previewUri }} style={styles.avatarImage} contentFit="cover" />
              ) : null}
            </View>
            <View style={styles.cameraBadge}>
              <Camera size={18} color={colors.voltInk} />
            </View>
          </Pressable>
          <Text style={textStyles.caption}>Change photo</Text>
        </View>

        <Input label="DISPLAY NAME" value={name} onChangeText={setName} maxLength={40} />
        <Input
          label="BIO"
          value={bio}
          onChangeText={setBio}
          multiline
          maxLength={160}
          hint={`${bio.length}/160`}
        />
        <View style={styles.cityRow}>
          <View style={styles.cityInput}>
            <Input label="HOME CITY" value={city} onChangeText={(t) => { setCity(t); setCoords(null); }} maxLength={40} />
          </View>
          <Button
            label={locating ? '…' : 'LOCATE'}
            size="sm"
            variant="ghost"
            disabled={locating}
            onPress={() => void locate()}
          />
        </View>

        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>USUAL PACE</Text>
          <View style={styles.chipRow}>
            {PACES.map((p) => (
              <SelectChip key={p} label={p.toUpperCase()} selected={pace === p} onPress={() => setPace(p)} />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>USUAL DISTANCE</Text>
          <View style={styles.chipRow}>
            {DISTANCES.map((d) => (
              <SelectChip key={d} label={d.toUpperCase()} selected={distance === d} onPress={() => setDistance(d)} />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>RUN TYPES YOU LIKE</Text>
          <View style={styles.chipRow}>
            {RUN_TYPES.map((t) => (
              <SelectChip
                key={t}
                label={t.toUpperCase()}
                selected={likes.includes(t)}
                onPress={() =>
                  setLikes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
                }
              />
            ))}
          </View>
        </View>
        <View style={styles.section}>
          <Text style={textStyles.eyebrow}>LANGUAGES</Text>
          <View style={styles.chipRow}>
            {LANGUAGES.map((l) => (
              <SelectChip
                key={l}
                label={l}
                selected={languages.includes(l)}
                onPress={() =>
                  setLanguages((prev) =>
                    prev.includes(l) ? prev.filter((x) => x !== l) : [...prev, l],
                  )
                }
              />
            ))}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const AVATAR = 96;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sp2,
    paddingHorizontal: spacing.sp3,
    paddingBottom: spacing.sp2,
  },
  headerTitle: { flex: 1 },
  content: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    gap: spacing.sp4,
  },
  avatarBlock: { alignItems: 'center', gap: spacing.sp2 },
  avatarCircle: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.ink100,
    borderWidth: 3,
    borderColor: colors.ink900,
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.volt,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.paper2,
  },
  cityRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sp2 },
  cityInput: { flex: 1 },
  section: { gap: spacing.sp2 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sp2 },
  error: { ...textStyles.caption, color: colors.danger },
});
