/** Great-circle distance between two lat/lng points, in meters. */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // earth radius, meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function maxPairwiseDistance(samples: { lat: number; lng: number }[]): number {
  let maxDistance = 0;
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      maxDistance = Math.max(maxDistance, haversineDistance(samples[i].lat, samples[i].lng, samples[j].lat, samples[j].lng));
    }
  }
  return maxDistance;
}

/** Thai distance label: metres below 1 km ("650 ม."), kilometres from 1 km ("1.2 กม.", "520 กม."). */
export function formatDistance(metres: number): string {
  const m = Math.round(metres);
  if (m < 1000) return `${m} ม.`;
  const km = m / 1000;
  return `${km < 10 ? km.toFixed(1).replace(/\.0$/, "") : Math.round(km).toLocaleString("th-TH")} กม.`;
}
