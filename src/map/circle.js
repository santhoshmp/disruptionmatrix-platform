// circle.js — Approximates a geographic circle as a GeoJSON polygon.
// GL circle layers only support pixel radii, so true-kilometre blast radii
// need a polygon approximation. Accurate enough at operational zoom levels.

export function circlePolygon(lon, lat, radiusKm, points = 64) {
  const dLat = radiusKm / 111.32;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  const dLon = radiusKm / (111.32 * Math.max(cosLat, 0.01));
  const ring = [];
  for (let i = 0; i <= points; i++) {
    const a = (i / points) * 2 * Math.PI;
    ring.push([lon + dLon * Math.sin(a), lat + dLat * Math.cos(a)]);
  }
  return { type: 'Polygon', coordinates: [ring] };
}

export function bboxPolygon(minLat, minLon, maxLat, maxLon) {
  return {
    type: 'Polygon',
    coordinates: [[
      [minLon, minLat], [maxLon, minLat], [maxLon, maxLat],
      [minLon, maxLat], [minLon, minLat],
    ]],
  };
}
