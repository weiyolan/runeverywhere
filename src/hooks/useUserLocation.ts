/**
 * Foreground location with the P2 E1 fallback chain:
 * device coords → profiles.home_point → Lisbon.
 */
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

import { parsePoint, type LatLng } from '@/lib/geo';
import { useSession } from '@/stores/session';

export const LISBON: LatLng = { lat: 38.7223, lng: -9.1393 };

export interface UserLocation {
  status: 'loading' | 'granted' | 'denied';
  coords: LatLng | null;
}

export function useUserLocation(): UserLocation {
  const [state, setState] = useState<UserLocation>({ status: 'loading', coords: null });

  useEffect(() => {
    let mounted = true;
    (async () => {
      let { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        ({ status } = await Location.requestForegroundPermissionsAsync());
      }
      if (status !== 'granted') {
        if (mounted) setState({ status: 'denied', coords: null });
        return;
      }
      try {
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (mounted) {
          setState({
            status: 'granted',
            coords: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          });
        }
      } catch {
        // GPS unavailable (airplane mode etc.) — fall through to home/Lisbon
        if (mounted) setState({ status: 'granted', coords: null });
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return state;
}

/** Query/map center: device coords → home_point → Lisbon. */
export function useExploreCenter(location: UserLocation): LatLng {
  const profile = useSession((s) => s.profile);
  return location.coords ?? parsePoint(profile?.home_point) ?? LISBON;
}
