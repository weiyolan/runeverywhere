/**
 * AppMap — the ONE react-native-maps wrapper (P2 C7; PLAN.md §1: a MapLibre
 * swap stays a one-module change). Everything outside src/components/map
 * imports this — an ESLint no-restricted-imports fence enforces it.
 */
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type LatLng,
  type MapPressEvent,
  type Region,
} from 'react-native-maps';

import { mapStyle } from './mapStyle';

export type { LatLng, Region };
/** Marker/Polyline re-exports so screens never touch react-native-maps directly. */
export const AppMarker = Marker;
export const AppPolyline = Polyline;

export interface AppMapHandle {
  animateToRegion: (region: Region, durationMs?: number) => void;
  animateToCoordinate: (latLng: LatLng) => void;
}

export interface AppMapProps {
  initialRegion: Region;
  onRegionChangeComplete?: (region: Region) => void;
  onPress?: (event: MapPressEvent) => void;
  onMapReady?: () => void;
  showsUserLocation?: boolean;
  /** false → all gestures off, for mini-map previews. Default true. */
  interactive?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
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
  const map = useRef<MapView>(null);

  useImperativeHandle(ref, () => ({
    animateToRegion: (region, durationMs = 300) => map.current?.animateToRegion(region, durationMs),
    animateToCoordinate: (latLng) =>
      map.current?.animateCamera({ center: latLng }, { duration: 300 }),
  }));

  return (
    <MapView
      ref={map}
      provider={PROVIDER_GOOGLE}
      customMapStyle={mapStyle}
      initialRegion={initialRegion}
      onRegionChangeComplete={onRegionChangeComplete}
      onPress={onPress}
      onMapReady={onMapReady}
      showsUserLocation={showsUserLocation}
      showsMyLocationButton={false}
      toolbarEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      scrollEnabled={interactive}
      zoomEnabled={interactive}
      zoomTapEnabled={interactive}
      style={style}
    >
      {children}
    </MapView>
  );
});

export default AppMap;
