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
