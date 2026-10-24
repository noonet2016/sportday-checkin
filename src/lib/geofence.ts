import { prisma } from "@/lib/prisma";
import { haversineDistance } from "@/lib/geo";

export type Geofence = { lat: number; lng: number; radius: number };

/** Campus geofence from system_settings, or null when an admin has not set it yet. */
export async function getGeofence(): Promise<Geofence | null> {
  const settings = await prisma.systemSetting.findMany({ where: { key: { in: ["geofence_lat", "geofence_lng", "geofence_radius_m"] } } });
  const value = (key: string) => Number(settings.find((setting) => setting.key === key)?.value);
  const fence = { lat: value("geofence_lat"), lng: value("geofence_lng"), radius: value("geofence_radius_m") };
  return [fence.lat, fence.lng, fence.radius].every(Number.isFinite) && fence.radius > 0 ? fence : null;
}

/** Whole metres from the geofence centre. */
export function distanceFromCentre(fence: Geofence, lat: number, lng: number): number {
  return Math.round(haversineDistance(lat, lng, fence.lat, fence.lng));
}
