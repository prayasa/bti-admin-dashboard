export interface PontianakRoadEntry {
  id: string;
  name: string;
  normalized_name: string;
  aliases: string[];
  search_terms: string[];
  highway_types: string[];
  segment_count: number;
  osm_way_ids: number[];
  center: {
    longitude: number;
    latitude: number;
  };
  bbox: [number, number, number, number];
  approximate_length_meters: number;
}

export interface PontianakRoadDataset {
  metadata: {
    dataset_name: string;
    dataset_version: number;
    coverage_name: string;
    coverage_type: string;
    boundary_osm_relation_id: number;
    source: string;
    source_snapshot_at: string;
    attribution: string;
    license: string;
    normalized_street_count: number;
  };
  streets: PontianakRoadEntry[];
}

export interface CoverageGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates:
    | number[][][]
    | number[][][][];
}

export interface CoverageFeatureCollection {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    id?: string;
    properties: Record<string, unknown>;
    geometry: CoverageGeometry;
  }>;
}

export interface RoadSegmentFeature {
  type: "Feature";
  id?: string;
  properties: {
    osm_way_id: number;
    road_id: string;
    name: string;
    normalized_name: string;
    highway: string;
    ref?: string;
    oneway?: string;
    surface?: string;
  };
  geometry: {
    type: "LineString";
    coordinates: number[][];
  };
}

export interface RoadSegmentFeatureCollection {
  type: "FeatureCollection";
  features: RoadSegmentFeature[];
}

export interface RoadSearchResult {
  road: PontianakRoadEntry;
  score: number;
}

function removeDiacritics(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function normalizeRoadSearch(
  value: string,
) {
  return removeDiacritics(value)
    .toLocaleLowerCase("id-ID")
    .trim()
    .replace(
      /^[\s.]*j(?:a?l|ln)\.?\s+/,
      "jalan ",
    )
    .replace(
      /^[\s.]*g(?:g|ng)\.?\s+/,
      "gang ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function removeRoadPrefix(value: string) {
  return value
    .replace(/^(jalan|gang)\s+/, "")
    .trim();
}

function getTermScore(
  term: string,
  normalizedQuery: string,
  queryWithoutPrefix: string,
) {
  const normalizedTerm =
    normalizeRoadSearch(term);

  const termWithoutPrefix =
    removeRoadPrefix(normalizedTerm);

  if (!normalizedTerm) {
    return Number.POSITIVE_INFINITY;
  }

  if (normalizedTerm === normalizedQuery) {
    return 0;
  }

  if (
    queryWithoutPrefix &&
    termWithoutPrefix === queryWithoutPrefix
  ) {
    return 1;
  }

  if (normalizedTerm.startsWith(normalizedQuery)) {
    return 10 +
      normalizedTerm.length -
      normalizedQuery.length;
  }

  if (
    queryWithoutPrefix &&
    termWithoutPrefix.startsWith(
      queryWithoutPrefix,
    )
  ) {
    return 12 +
      termWithoutPrefix.length -
      queryWithoutPrefix.length;
  }

  const queryTokens = queryWithoutPrefix
    .split(" ")
    .filter(Boolean);

  if (
    queryTokens.length > 0 &&
    queryTokens.every((token) =>
      termWithoutPrefix.includes(token),
    )
  ) {
    return (
      30 +
      Math.max(
        0,
        termWithoutPrefix.indexOf(
          queryTokens[0],
        ),
      )
    );
  }

  return Number.POSITIVE_INFINITY;
}

export function searchPontianakRoads(
  streets: PontianakRoadEntry[],
  query: string,
  limit = 10,
): RoadSearchResult[] {
  const normalizedQuery =
    normalizeRoadSearch(query);

  const queryWithoutPrefix =
    removeRoadPrefix(normalizedQuery);

  if (queryWithoutPrefix.length < 2) {
    return [];
  }

  const results: RoadSearchResult[] = [];

  streets.forEach((road) => {
    const terms = new Set<string>([
      road.name,
      road.normalized_name,
      ...road.aliases,
      ...road.search_terms,
    ]);

    let bestScore = Number.POSITIVE_INFINITY;

    terms.forEach((term) => {
      bestScore = Math.min(
        bestScore,
        getTermScore(
          term,
          normalizedQuery,
          queryWithoutPrefix,
        ),
      );
    });

    if (Number.isFinite(bestScore)) {
      results.push({
        road,
        score: bestScore,
      });
    }
  });

  return results
    .sort((first, second) => {
      if (first.score !== second.score) {
        return first.score - second.score;
      }

      return first.road.name.localeCompare(
        second.road.name,
        "id-ID",
        {
          sensitivity: "base",
          numeric: true,
        },
      );
    })
    .slice(0, Math.max(1, limit));
}

function isPointInsideRing(
  longitude: number,
  latitude: number,
  ring: number[][],
) {
  let isInside = false;

  for (
    let currentIndex = 0,
      previousIndex = ring.length - 1;
    currentIndex < ring.length;
    previousIndex = currentIndex,
      currentIndex += 1
  ) {
    const current = ring[currentIndex];
    const previous = ring[previousIndex];

    if (!current || !previous) {
      continue;
    }

    const currentLongitude = current[0];
    const currentLatitude = current[1];
    const previousLongitude = previous[0];
    const previousLatitude = previous[1];

    const crossesLatitude =
      currentLatitude > latitude !==
      previousLatitude > latitude;

    if (!crossesLatitude) {
      continue;
    }

    const longitudeAtLatitude =
      ((previousLongitude - currentLongitude) *
        (latitude - currentLatitude)) /
        (previousLatitude - currentLatitude) +
      currentLongitude;

    if (longitude < longitudeAtLatitude) {
      isInside = !isInside;
    }
  }

  return isInside;
}

function isPointInsidePolygon(
  longitude: number,
  latitude: number,
  polygon: number[][][],
) {
  const outerRing = polygon[0];

  if (
    !outerRing ||
    !isPointInsideRing(
      longitude,
      latitude,
      outerRing,
    )
  ) {
    return false;
  }

  const isInsideHole = polygon
    .slice(1)
    .some((hole) =>
      isPointInsideRing(
        longitude,
        latitude,
        hole,
      ),
    );

  return !isInsideHole;
}

export function isPointInsideCoverage(
  longitude: number,
  latitude: number,
  coverage: CoverageFeatureCollection | null,
) {
  if (
    !coverage ||
    !Number.isFinite(longitude) ||
    !Number.isFinite(latitude)
  ) {
    return false;
  }

  return coverage.features.some((feature) => {
    const geometry = feature.geometry;

    if (geometry.type === "Polygon") {
      return isPointInsidePolygon(
        longitude,
        latitude,
        geometry.coordinates as number[][][],
      );
    }

    return (
      geometry.coordinates as number[][][][]
    ).some((polygon) =>
      isPointInsidePolygon(
        longitude,
        latitude,
        polygon,
      ),
    );
  });
}

export function createEmptyRoadCollection(): RoadSegmentFeatureCollection {
  return {
    type: "FeatureCollection",
    features: [],
  };
}