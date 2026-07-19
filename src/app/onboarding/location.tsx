import * as Location from 'expo-location';
import { router } from 'expo-router';
import { MapPin } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { StepShell } from '@/components/onboarding/StepShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { setHomeLocation, updateProfile } from '@/lib/profile';
import { useSession } from '@/stores/session';
import { colors, fonts, radius, spacing, textStyles, typeScale } from '@/theme/theme';

/** Step 2/4 "WHERE DO YOU RUN?" (P1 H3) — home city + optional geolocation. */
export default function OnboardingLocationScreen() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [city, setCity] = useState(profile?.home_city ?? '');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationHint, setLocationHint] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const captureCurrentLocation = async () => {
    setLocating(true);
    setLocationHint(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        setLocationHint('You can type your city instead.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const places = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const place = places[0];
      const name = place?.city || place?.subregion || place?.region || '';
      if (name) setCity(name);
      setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setLocationHint('Could not get your location — type your city instead.');
    } finally {
      setLocating(false);
    }
  };

  const submit = async () => {
    setWorking(true);
    setError(null);
    try {
      const trimmed = city.trim();
      if (coords) {
        await setHomeLocation(coords.lat, coords.lng, trimmed);
      } else {
        // Manual path: null a stale home_point when the typed city changed —
        // otherwise a resumed session pairs the new city with old coordinates.
        await updateProfile({
          home_city: trimmed,
          ...(trimmed !== profile?.home_city ? { home_point: null } : {}),
        });
      }
      await refreshProfile();
      router.push('/onboarding/preferences');
    } catch {
      setError('Could not save — check your connection and try again.');
    } finally {
      setWorking(false);
    }
  };

  const located = coords != null;

  return (
    <StepShell
      step={2}
      onBack={() => router.back()}
      title="WHERE DO YOU RUN?"
      subtitle="Your home city anchors the runs you see first."
      ctaDisabled={city.trim().length === 0 || city.trim().length > 40}
      working={working}
      error={error}
      onContinue={() => void submit()}
    >
      <View style={styles.locationCard}>
        <Text style={styles.cardText}>
          Run Everywhere uses your location to show runs nearby and share your start point with
          people you run with.
        </Text>
        <View style={located ? styles.locatedWrap : undefined}>
          <Button
            label={locating ? 'LOCATING…' : located ? 'LOCATION SET' : 'USE CURRENT LOCATION'}
            variant={located ? 'secondary' : 'primary'}
            full
            disabled={locating}
            onPress={() => void captureCurrentLocation()}
          />
        </View>
        {locationHint ? <Text style={styles.cardHint}>{locationHint}</Text> : null}
      </View>

      <Input
        label="HOME CITY"
        value={city}
        onChangeText={(t) => {
          setCity(t);
          setCoords(null); // typed city invalidates the captured point
        }}
        maxLength={40}
        leading={<MapPin size={18} color={colors.ink400} />}
      />
    </StepShell>
  );
}

const styles = StyleSheet.create({
  locationCard: {
    backgroundColor: colors.ink900,
    borderRadius: radius.md,
    padding: spacing.sp5,
    gap: spacing.sp4,
  },
  cardText: {
    fontFamily: fonts.body,
    fontSize: typeScale.tSm,
    lineHeight: typeScale.tSm * 1.45,
    color: colors.ink300,
  },
  locatedWrap: {
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.go,
  },
  cardHint: {
    ...textStyles.caption,
    color: colors.ink300,
  },
});
