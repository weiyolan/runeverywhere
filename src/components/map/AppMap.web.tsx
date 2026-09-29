/**
 * Web stand-in for AppMap — react-native-maps is native-only and crashes the
 * web bundle at import. Same exports; renders a placeholder, markers no-op.
 * ponytail: no web map; swap in a JS map lib here if web becomes a real target.
 */
import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { LatLng, Region } from 'react-native-maps';
import { semantic } from '@/theme/theme';
import type { AppMapHandle, AppMapProps } from './AppMap';

export type { LatLng, Region };
export type { AppMapHandle, AppMapProps };

export const AppMarker = (_: object) => null;
export const AppPolyline = (_: object) => null;

export const AppMap = forwardRef<AppMapHandle, AppMapProps>(function AppMap({ style }, ref) {
  useImperativeHandle(ref, () => ({ animateToRegion: () => {}, animateToCoordinate: () => {} }));
  return (
    <View style={[styles.box, style]}>
      <Text style={styles.text}>Map available in the mobile app</Text>
    </View>
  );
});

export default AppMap;

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: semantic.bgSunken },
  text: { color: semantic.textSecondary },
});
