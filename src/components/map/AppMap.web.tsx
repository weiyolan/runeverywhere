/**
 * AppMap — web implementation (MapLibre GL via react-map-gl). react-native-maps
 * is native-only; this keeps the exact AppMap API so screens stay untouched.
 * Touch pan/pinch work in iOS Safari + Android Chrome (canvas sets touch-action: none).
 * ponytail: OpenFreeMap free tiles, no key/SLA — move to MapTiler or self-hosted if volume grows.
 */
import 'maplibre-gl/dist/maplibre-gl.css';

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { MapPressEvent } from 'react-native-maps';
import { Layer, Map as MapGL, Marker, Source, type MapInstance, type MapRef } from 'react-map-gl/maplibre';

import { boundsToRegion, regionToBounds, type Region as GeoRegion } from '@/lib/geo';
import { colors } from '@/theme/theme';

import type { AppMapHandle, AppMapProps, LatLng, Region } from './AppMap';

export type { AppMapHandle, AppMapProps, LatLng, Region };

const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

interface AppMarkerProps {
  coordinate: LatLng;
  anchor?: { x: number; y: number };
  onPress?: () => void;
  tracksViewChanges?: boolean;
  children?: React.ReactNode;
}

export function AppMarker({ coordinate, anchor, onPress, children }: AppMarkerProps) {
  return (
    <Marker
      longitude={coordinate.longitude}
      latitude={coordinate.latitude}
      anchor={anchor?.y === 1 ? 'bottom' : 'center'}
      onClick={(e) => {
        // Native: a marker tap never reaches the map's onPress. Match that.
        e.originalEvent.stopPropagation();
        onPress?.();
      }}
    >
      {children}
    </Marker>
  );
}

interface AppPolylineProps {
  coordinates: LatLng[];
  strokeColor?: string;
  strokeWidth?: number;
}

export function AppPolyline({ coordinates, strokeColor = colors.ink900, strokeWidth = 4 }: AppPolylineProps) {
  const id = useId();
  return (
    <Source
      id={`line-${id}`}
      type="geojson"
      data={{
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: coordinates.map((c) => [c.longitude, c.latitude]),
        },
      }}
    >
      <Layer
        id={`line-layer-${id}`}
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': strokeColor, 'line-width': strokeWidth }}
      />
    </Source>
  );
}

function useWatchedPosition(enabled: boolean): LatLng | null {
  const [pos, setPos] = useState<LatLng | null>(null);
  useEffect(() => {
    if (!enabled || !navigator.geolocation) return;
    const watch = navigator.geolocation.watchPosition(
      (p) => setPos({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [enabled]);
  return enabled ? pos : null;
}

export const AppMap = forwardRef<AppMapHandle, AppMapProps>(function AppMap(
  {
    initialRegion,
    onRegionChangeComplete,
    onPress,
    onMapReady,
    showsUserLocation = false,
    interactive = true,
    style,
    children,
  },
  ref,
) {
  const map = useRef<MapRef>(null);
  const resizing = useRef(false);
  const userPos = useWatchedPosition(showsUserLocation);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, durationMs = 300) =>
      map.current?.fitBounds(regionToBounds(region as GeoRegion), { duration: durationMs }),
    animateToCoordinate: (latLng) =>
      map.current?.easeTo({ center: [latLng.longitude, latLng.latitude], duration: 300 }),
  }));

  const emitRegion = (m: MapInstance) => {
    const b = m.getBounds();
    onRegionChangeComplete?.(
      boundsToRegion([
        [b.getWest(), b.getSouth()],
        [b.getEast(), b.getNorth()],
      ]),
    );
  };

  return (
    <View style={[styles.root, style]}>
      <MapGL
        ref={map}
        mapStyle={MAP_STYLE}
        initialViewState={{ bounds: regionToBounds(initialRegion as GeoRegion) }}
        style={{ width: '100%', height: '100%' }}
        interactive={interactive}
        dragRotate={false}
        pitchWithRotate={false}
        touchPitch={false}
        attributionControl={{ compact: true }}
        onLoad={(e) => {
          e.target.touchZoomRotate.disableRotation();
          onMapReady?.();
          emitRegion(e.target); // native fires onRegionChangeComplete once on load too
        }}
        // A container resize fires resize, then moveend, without the camera moving. Reporting
        // it loops: region change -> footer text changes height -> map resizes -> region change.
        onResize={() => {
          resizing.current = true;
        }}
        onMoveEnd={(e) => {
          if (resizing.current) {
            resizing.current = false;
            return;
          }
          emitRegion(e.target);
        }}
        onClick={(e) =>
          onPress?.({
            nativeEvent: { coordinate: { latitude: e.lngLat.lat, longitude: e.lngLat.lng } },
          } as unknown as MapPressEvent)
        }
      >
        {children}
        {userPos && (
          <AppMarker coordinate={userPos}>
            <View style={styles.userDot} />
          </AppMarker>
        )}
      </MapGL>
    </View>
  );
});

export default AppMap;

const styles = StyleSheet.create({
  root: { overflow: 'hidden' },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.discover,
    borderWidth: 3,
    borderColor: colors.paper,
  },
});
