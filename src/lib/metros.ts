/**
 * Major metropolitan areas the pool can drop money near, with rough metro
 * populations (millions) used as weights. Random drops land within a few
 * miles of these centres, or of places people are actually active.
 */
export type Metro = { name: string; lat: number; lng: number; pop: number };

export const METROS: Metro[] = [
  { name: "New York", lat: 40.7484, lng: -73.9857, pop: 19.5 },
  { name: "Los Angeles", lat: 34.0522, lng: -118.2437, pop: 13.0 },
  { name: "Chicago", lat: 41.8781, lng: -87.6298, pop: 9.5 },
  { name: "Houston", lat: 29.7604, lng: -95.3698, pop: 7.1 },
  { name: "Dallas", lat: 32.7767, lng: -96.797, pop: 7.6 },
  { name: "Miami", lat: 25.7617, lng: -80.1918, pop: 6.1 },
  { name: "Atlanta", lat: 33.749, lng: -84.388, pop: 6.1 },
  { name: "Washington DC", lat: 38.9072, lng: -77.0369, pop: 6.3 },
  { name: "Philadelphia", lat: 39.9526, lng: -75.1652, pop: 6.2 },
  { name: "Boston", lat: 42.3601, lng: -71.0589, pop: 4.9 },
  { name: "San Francisco", lat: 37.7749, lng: -122.4194, pop: 4.6 },
  { name: "Phoenix", lat: 33.4484, lng: -112.074, pop: 4.9 },
  { name: "Seattle", lat: 47.6062, lng: -122.3321, pop: 4.0 },
  { name: "Denver", lat: 39.7392, lng: -104.9903, pop: 3.0 },
  { name: "Las Vegas", lat: 36.1699, lng: -115.1398, pop: 2.3 },
  { name: "Austin", lat: 30.2672, lng: -97.7431, pop: 2.4 },
  { name: "Nashville", lat: 36.1627, lng: -86.7816, pop: 2.1 },
  { name: "San Diego", lat: 32.7157, lng: -117.1611, pop: 3.3 },
  { name: "Toronto", lat: 43.6532, lng: -79.3832, pop: 6.4 },
  { name: "Vancouver", lat: 49.2827, lng: -123.1207, pop: 2.6 },
  { name: "Mexico City", lat: 19.4326, lng: -99.1332, pop: 21.8 },
  { name: "São Paulo", lat: -23.5505, lng: -46.6333, pop: 22.4 },
  { name: "Buenos Aires", lat: -34.6037, lng: -58.3816, pop: 15.4 },
  { name: "London", lat: 51.5074, lng: -0.1278, pop: 14.9 },
  { name: "Paris", lat: 48.8566, lng: 2.3522, pop: 12.3 },
  { name: "Berlin", lat: 52.52, lng: 13.405, pop: 6.1 },
  { name: "Madrid", lat: 40.4168, lng: -3.7038, pop: 6.7 },
  { name: "Barcelona", lat: 41.3874, lng: 2.1686, pop: 5.6 },
  { name: "Rome", lat: 41.9028, lng: 12.4964, pop: 4.3 },
  { name: "Amsterdam", lat: 52.3676, lng: 4.9041, pop: 2.5 },
  { name: "Lisbon", lat: 38.7223, lng: -9.1393, pop: 2.9 },
  { name: "Dubai", lat: 25.2048, lng: 55.2708, pop: 3.6 },
  { name: "Istanbul", lat: 41.0082, lng: 28.9784, pop: 15.6 },
  { name: "Lagos", lat: 6.5244, lng: 3.3792, pop: 15.9 },
  { name: "Nairobi", lat: -1.2921, lng: 36.8219, pop: 5.1 },
  { name: "Cape Town", lat: -33.9249, lng: 18.4241, pop: 4.8 },
  { name: "Mumbai", lat: 19.076, lng: 72.8777, pop: 21.3 },
  { name: "Delhi", lat: 28.6139, lng: 77.209, pop: 32.9 },
  { name: "Bangalore", lat: 12.9716, lng: 77.5946, pop: 13.6 },
  { name: "Singapore", lat: 1.3521, lng: 103.8198, pop: 6.0 },
  { name: "Bangkok", lat: 13.7563, lng: 100.5018, pop: 11.0 },
  { name: "Jakarta", lat: -6.2088, lng: 106.8456, pop: 11.2 },
  { name: "Manila", lat: 14.5995, lng: 120.9842, pop: 14.7 },
  { name: "Hong Kong", lat: 22.3193, lng: 114.1694, pop: 7.5 },
  { name: "Shanghai", lat: 31.2304, lng: 121.4737, pop: 29.2 },
  { name: "Beijing", lat: 39.9042, lng: 116.4074, pop: 21.5 },
  { name: "Seoul", lat: 37.5665, lng: 126.978, pop: 25.5 },
  { name: "Tokyo", lat: 35.6762, lng: 139.6503, pop: 37.1 },
  { name: "Osaka", lat: 34.6937, lng: 135.5023, pop: 19.0 },
  { name: "Sydney", lat: -33.8688, lng: 151.2093, pop: 5.3 },
  { name: "Melbourne", lat: -37.8136, lng: 144.9631, pop: 5.2 },
];

/** Pick a metro at random, weighted by population. */
export function pickMetro(rand = Math.random): Metro {
  const total = METROS.reduce((s, m) => s + m.pop, 0);
  let r = rand() * total;
  for (const m of METROS) {
    r -= m.pop;
    if (r <= 0) return m;
  }
  return METROS[0];
}
