export type Coordinates = { lat: number; lng: number };

function valid(lat: number, lng: number): Coordinates | null {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}

export function parseMapLocation(input: string): Coordinates | null {
  const text = input.trim();
  const pair = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (pair) return valid(Number(pair[1]), Number(pair[2]));
  const pin = text.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i);
  if (pin) return valid(Number(pin[1]), Number(pin[2]));
  try {
    const url = new URL(text);
    const at = url.href.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,|\/|$)/);
    const query = url.searchParams.get("q") ?? url.searchParams.get("ll");
    const queryPair = query?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    const match = at ?? queryPair;
    return match ? valid(Number(match[1]), Number(match[2])) : null;
  } catch { return null; }
}

export function isThailandPoint({ lat, lng }: Coordinates) { return lat >= 5.5 && lat <= 20.5 && lng >= 97.3 && lng <= 105.7; }
