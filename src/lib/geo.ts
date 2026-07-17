/**
 * Geography I/O helpers (P2 D3). PostgREST returns `geography(point)` columns
 * either as hex-(E)WKB strings or GeoJSON depending on the fetch path — every
 * read funnels through `parsePoint`.
 */
export interface LatLng {
  lat: number;
  lng: number;
}

export interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const WKB_POINT = 1;
const EWKB_SRID_FLAG = 0x20000000;

export function parsePoint(value: unknown): LatLng | null {
  if (value == null) return null;

  if (typeof value === 'object') {
    const g = value as { type?: unknown; coordinates?: unknown };
    if (g.type === 'Point' && Array.isArray(g.coordinates)) {
      const [lng, lat] = g.coordinates;
      if (typeof lng === 'number' && typeof lat === 'number') return { lat, lng };
    }
    return null;
  }

  if (typeof value !== 'string') return null;
  const hex = value.trim();
  // Point WKB: 1 (endian) + 4 (type) [+ 4 SRID] + 16 (x,y doubles) bytes
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0 || hex.length < 42) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  const view = new DataView(bytes.buffer);
  const littleEndian = bytes[0] === 1;
  const type = view.getUint32(1, littleEndian);
  if ((type & 0xff) !== WKB_POINT) return null;

  const offset = type & EWKB_SRID_FLAG ? 9 : 5;
  if (bytes.length < offset + 16) return null;
  return {
    lng: view.getFloat64(offset, littleEndian),
    lat: view.getFloat64(offset + 8, littleEndian),
  };
}

const EARTH_RADIUS_M = 6_371_008.8;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** Haversine distance — backs the "search this area" 5 km threshold. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

const METERS_PER_DEG_LAT = 111_320;

/** A map region spanning `radiusM` around `center`. */
export function regionForRadius(center: LatLng, radiusM: number): Region {
  const latitudeDelta = (radiusM * 2) / METERS_PER_DEG_LAT;
  return {
    latitude: center.lat,
    longitude: center.lng,
    latitudeDelta,
    longitudeDelta: latitudeDelta / Math.cos(rad(center.lat)),
  };
}
