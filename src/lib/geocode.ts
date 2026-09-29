/**
 * Reverse geocoding for every platform. expo-location's reverseGeocodeAsync
 * was removed on web (SDK 49), so browsers go through Nominatim instead.
 * ponytail: Nominatim is dev/low-volume only (1 req/s, no heavy app use) — swap
 * the web branch to MapTiler or Google Geocoding before launch.
 */
import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface Place {
  city?: string;
  district?: string;
  subregion?: string;
  region?: string;
  /** ISO 3166-1 alpha-2, uppercase */
  countryCode?: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  if (Platform.OS !== 'web') {
    const [p] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
    if (!p) return null;
    return {
      city: p.city ?? undefined,
      district: p.district ?? undefined,
      subregion: p.subregion ?? undefined,
      region: p.region ?? undefined,
      countryCode: p.isoCountryCode ?? undefined,
    };
  }
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&lat=${lat}&lon=${lng}`,
    { headers: { 'Accept-Language': navigator.language } },
  );
  if (!res.ok) throw new Error(`reverse geocode ${res.status}`);
  const a = ((await res.json()) as { address?: Record<string, string> }).address;
  if (!a) return null;
  return {
    city: a.city ?? a.town ?? a.village,
    district: a.suburb ?? a.neighbourhood ?? a.city_district,
    subregion: a.county,
    region: a.state,
    countryCode: a.country_code?.toUpperCase(),
  };
}
