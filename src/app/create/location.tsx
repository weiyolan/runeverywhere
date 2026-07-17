/**
 * Create step 2/4 (P2 G4) — drop the start point: fixed center pin over a
 * draggable map, debounced on-device reverse geocode, manual area fallback.
 */
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { WizardHeader } from '@/components/create/WizardHeader';
import { AppMap } from '@/components/map/AppMap';
import { MapPin } from '@/components/map/MapPin';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useExploreCenter, useUserLocation } from '@/hooks/useUserLocation';
import { regionForRadius, type Region } from '@/lib/geo';
import { locationStepSchema } from '@/lib/validation/run';
import { useCreateRunDraft } from '@/stores/createRun';
import { colors, radius, semantic, sizing, spacing, textStyles } from '@/theme/theme';

const GEOCODE_DEBOUNCE_MS = 600;
const PIN_REGION_M = 1_500;

export default function CreateLocationScreen() {
  const insets = useSafeAreaInsets();
  const draft = useCreateRunDraft();
  const location = useUserLocation();
  const fallback = useExploreCenter(location);
  const start = draft.point ?? fallback;

  const [geocodeState, setGeocodeState] = useState<'idle' | 'locating' | 'empty'>('idle');
  const geocodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onRegionChangeComplete = (region: Region) => {
    const point = { lat: region.latitude, lng: region.longitude };
    draft.set({ point });
    setGeocodeState('locating');
    if (geocodeTimer.current) clearTimeout(geocodeTimer.current);
    geocodeTimer.current = setTimeout(async () => {
      try {
        const [place] = await Location.reverseGeocodeAsync({
          latitude: point.lat,
          longitude: point.lng,
        });
        const area = place?.district ?? place?.subregion ?? place?.city ?? '';
        draft.set({
          area_name: area,
          city: place?.city ?? place?.region ?? '',
          country_code: place?.isoCountryCode ?? '',
        });
        setGeocodeState(area ? 'idle' : 'empty');
      } catch {
        // Offline geocode — leave manual entry available
        setGeocodeState('empty');
      }
    }, GEOCODE_DEBOUNCE_MS);
  };

  const valid = locationStepSchema.safeParse(draft).success && draft.area_name.trim().length > 0;
  const showManualArea = geocodeState === 'empty';

  return (
    <View style={styles.screen}>
      <View style={styles.headerWrap}>
        <WizardHeader step={2} title="Drop your start point" />
      </View>

      <View style={styles.mapWrap}>
        <AppMap
          style={StyleSheet.absoluteFill}
          initialRegion={regionForRadius(start, PIN_REGION_M)}
          showsUserLocation={location.status === 'granted'}
          onRegionChangeComplete={onRegionChangeComplete}
        />
        {/* Fixed center pin — the map drags underneath it */}
        <View pointerEvents="none" style={styles.centerPin}>
          <MapPin type={draft.type ?? 'discover'} />
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.sp4 }]}>
        <View style={styles.addressCard}>
          {geocodeState === 'locating' ? (
            <Text style={textStyles.caption}>Locating…</Text>
          ) : draft.area_name ? (
            <>
              <Text style={textStyles.cardTitle}>{draft.area_name}</Text>
              <Text style={textStyles.caption}>{draft.city}</Text>
            </>
          ) : (
            <Text style={textStyles.caption}>Unnamed area</Text>
          )}
          {showManualArea ? (
            <Input
              label="Area name"
              value={draft.area_name}
              onChangeText={(area_name) => draft.set({ area_name })}
              placeholder="e.g. Alfama"
              maxLength={40}
            />
          ) : null}
        </View>
        <Button
          label="Continue"
          full
          disabled={!valid}
          onPress={() => router.push('/create/details')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper2 },
  headerWrap: { paddingHorizontal: sizing.gutter, paddingBottom: spacing.sp3 },
  mapWrap: { flex: 1 },
  centerPin: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Anchor the teardrop tip at map center (pin height 48, tip at bottom)
    paddingBottom: 48,
  },
  footer: {
    paddingHorizontal: sizing.gutter,
    paddingTop: spacing.sp3,
    gap: spacing.sp3,
    backgroundColor: colors.paper2,
  },
  addressCard: {
    backgroundColor: semantic.bgSurface,
    borderRadius: radius.md,
    padding: spacing.sp4,
    gap: spacing.sp1,
  },
});
