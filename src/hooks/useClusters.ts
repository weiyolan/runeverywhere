/**
 * Supercluster over nearby runs (P2 E2).
 */
import { useMemo } from 'react';
import Supercluster from 'supercluster';

import { formatPinLabel } from '@/lib/format';
import type { LatLng, Region } from '@/lib/geo';
import type { NearbyRun } from '@/lib/runs';
import type { RunType } from '@/theme/theme';

export interface PinProperties {
  runId: string;
  type: RunType;
  kmLabel: string;
}

export type ClusterFeature =
  | Supercluster.PointFeature<PinProperties>
  | Supercluster.ClusterFeature<Supercluster.AnyProps>;

const BBOX_PAD = 0.6;

export function useClusters(runs: NearbyRun[], region: Region) {
  const index = useMemo(() => {
    const sc = new Supercluster<PinProperties, Supercluster.AnyProps>({ radius: 48, maxZoom: 16 });
    sc.load(
      runs.map((r) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [r.run.point.lng, r.run.point.lat] },
        properties: {
          runId: r.run.id,
          type: r.run.type,
          kmLabel: formatPinLabel(r.run.distance_km),
        },
      })),
    );
    return sc;
  }, [runs]);

  const zoom = Math.round(Math.log2(360 / region.longitudeDelta));
  const clusters: ClusterFeature[] = index.getClusters(
    [
      region.longitude - region.longitudeDelta * BBOX_PAD,
      region.latitude - region.latitudeDelta * BBOX_PAD,
      region.longitude + region.longitudeDelta * BBOX_PAD,
      region.latitude + region.latitudeDelta * BBOX_PAD,
    ],
    zoom,
  );

  const expansionRegion = (clusterId: number, center: LatLng): Region => {
    const expZoom = Math.min(index.getClusterExpansionZoom(clusterId) + 0.5, 20);
    const longitudeDelta = 360 / 2 ** expZoom;
    return {
      latitude: center.lat,
      longitude: center.lng,
      latitudeDelta: longitudeDelta * Math.cos((center.lat * Math.PI) / 180),
      longitudeDelta,
    };
  };

  return { clusters, expansionRegion };
}
