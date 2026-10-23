import { haversineDistance, maxPairwiseDistance } from "./geo";

export const MIN_SAMPLES_FOR_SIGNAL = 3;
export const JITTER_MIN_M = 0.5;
export const ACCURACY_UNREALISTIC_MAX_M = 5;
export const CENTROID_EPS_M = 1;

export type CheckinGpsSample = {
  lat: number;
  lng: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
};

export type CheckinLocation = { name: string; lat: number; lng: number };

export function scoreSuspicion(
  samples: CheckinGpsSample[] | undefined,
  finalLat: number,
  finalLng: number,
  location: CheckinLocation,
): { suspicious: boolean; reasons: string[] } {
  const validSamples = (samples ?? []).filter(
    (sample) => Number.isFinite(sample.lat) && sample.lat >= -90 && sample.lat <= 90 && Number.isFinite(sample.lng) && sample.lng >= -180 && sample.lng <= 180 && Number.isFinite(sample.accuracy),
  );
  const strongReasons: string[] = [];
  const supportingReasons: string[] = [];

  if (validSamples.length >= MIN_SAMPLES_FOR_SIGNAL) {
    const jitterM = maxPairwiseDistance(validSamples);
    if (jitterM < JITTER_MIN_M) strongReasons.push(`zero_jitter: ${validSamples.length} samples max pairwise distance ${jitterM.toFixed(2)} m < ${JITTER_MIN_M} m`);
    if (validSamples.every((sample) => sample.altitude === null)) supportingReasons.push("altitude_absent: altitude null on all fixes");
    const firstAccuracy = validSamples[0].accuracy;
    if (firstAccuracy <= ACCURACY_UNREALISTIC_MAX_M && validSamples.every((sample) => sample.accuracy === firstAccuracy)) {
      supportingReasons.push(`constant_unrealistic_accuracy: accuracy identical at ${firstAccuracy} m <= ${ACCURACY_UNREALISTIC_MAX_M} m`);
    }
  }

  const centroidDistanceM = haversineDistance(finalLat, finalLng, location.lat, location.lng);
  if (centroidDistanceM < CENTROID_EPS_M) strongReasons.push(`exact_centroid_match: submitted point ${centroidDistanceM.toFixed(2)} m from ${location.name} center < ${CENTROID_EPS_M} m`);
  return { suspicious: strongReasons.length > 0 || supportingReasons.length >= 2, reasons: [...strongReasons, ...supportingReasons] };
}
