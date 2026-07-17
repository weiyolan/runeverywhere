/**
 * Google Maps JSON style — the design's pale paper canvas (P2 C8).
 * Token-matched to theme.ts: paper2 geometry, discoverSoft water, muted
 * greens for parks (go is a signal color, never terrain), POI/transit off so
 * nothing competes with MapPins.
 */
export const mapStyle = [
  // Base geometry + default label treatment
  { elementType: 'geometry', stylers: [{ color: '#F5F5F3' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6B6B73' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#FFFFFF' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  // Administrative hairlines only
  { featureType: 'administrative', elementType: 'geometry.stroke', stylers: [{ color: '#DEDEE2' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },

  // Only locality/neighborhood labels survive
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#6B6B73' }] },
  { featureType: 'administrative.neighborhood', elementType: 'labels.text.fill', stylers: [{ color: '#6B6B73' }] },

  // POIs and transit off entirely — MapPins own the canvas
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  // Parks / natural landscape: muted green, labels hidden with the POI layer
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#E4EFE4' }] },
  { featureType: 'landscape.natural', elementType: 'geometry', stylers: [{ color: '#E4EFE4' }] },

  // Roads: white fills, hairline strokes; highways slightly darker
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#DEDEE2' }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ECECEE' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ visibility: 'on' }, { color: '#6B6B73' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ visibility: 'on' }, { color: '#6B6B73' }] },

  // Water: soft discover-blue tint
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#E7F0FF' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#6B6B73' }] },
];

export default mapStyle;
