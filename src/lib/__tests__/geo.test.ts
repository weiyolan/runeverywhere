import { describe, expect, it } from 'vitest';

import { distanceMeters, parsePoint, regionForRadius } from '@/lib/geo';

// Real PostgREST encoding of the seed home_point (lisbon), pulled from psql:
// select encode(st_asewkb(home_point::geometry),'hex') …
const LISBON_HEX = '0101000020e610000065aa6054524722c04df38e53745c4340';

describe('parsePoint', () => {
  it('parses hex-EWKB strings (PostgREST geography encoding)', () => {
    const p = parsePoint(LISBON_HEX);
    expect(p).not.toBeNull();
    expect(p!.lng).toBeCloseTo(-9.1393, 6);
    expect(p!.lat).toBeCloseTo(38.7223, 6);
  });

  it('parses uppercase hex too', () => {
    const p = parsePoint(LISBON_HEX.toUpperCase());
    expect(p!.lat).toBeCloseTo(38.7223, 6);
  });

  it('parses GeoJSON points', () => {
    const p = parsePoint({ type: 'Point', coordinates: [-9.1393, 38.7223] });
    expect(p).toEqual({ lat: 38.7223, lng: -9.1393 });
  });

  it('returns null for garbage', () => {
    expect(parsePoint(null)).toBeNull();
    expect(parsePoint(undefined)).toBeNull();
    expect(parsePoint('not-a-point')).toBeNull();
    expect(parsePoint({ type: 'Polygon', coordinates: [] })).toBeNull();
    expect(parsePoint('0102000020e61000')).toBeNull(); // truncated / not a point
  });
});

describe('distanceMeters', () => {
  it('is ~0 for identical points and symmetric', () => {
    const a = { lat: 38.7223, lng: -9.1393 };
    const b = { lat: 38.7139, lng: -9.13 };
    expect(distanceMeters(a, a)).toBeCloseTo(0, 5);
    expect(distanceMeters(a, b)).toBeCloseTo(distanceMeters(b, a), 5);
  });

  it('matches PostGIS for the Alfama↔center pair (~1.2 km)', () => {
    // select st_distance on the same pair → 1218.9 m (geography, spheroid);
    // haversine (sphere) lands within ~0.5%
    const d = distanceMeters({ lat: 38.7223, lng: -9.1393 }, { lat: 38.7139, lng: -9.13 });
    expect(d).toBeGreaterThan(1180);
    expect(d).toBeLessThan(1260);
  });
});

describe('regionForRadius', () => {
  it('spans the requested radius in latitude', () => {
    const r = regionForRadius({ lat: 38.7223, lng: -9.1393 }, 25_000);
    // 25 km radius → 50 km diameter ≈ 0.45° of latitude
    expect(r.latitudeDelta).toBeGreaterThan(0.4);
    expect(r.latitudeDelta).toBeLessThan(0.5);
    expect(r.latitude).toBe(38.7223);
    // longitude delta widens with latitude (1/cos φ)
    expect(r.longitudeDelta).toBeGreaterThan(r.latitudeDelta);
  });
});
