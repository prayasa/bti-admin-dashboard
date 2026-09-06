"use client";

import mapboxgl from "mapbox-gl";
import {
  Database,
  LoaderCircle,
  MapPin,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

import "mapbox-gl/dist/mapbox-gl.css";

import { Input } from "@/components/ui/input";
import {
  createEmptyRoadCollection,
  isPointInsideCoverage,
  searchPontianakRoads,
  type CoverageFeatureCollection,
  type PontianakRoadDataset,
  type PontianakRoadEntry,
  type RoadSegmentFeature,
  type RoadSegmentFeatureCollection,
} from "@/src/lib/pontianak-road-search";

export interface LocationValue {
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
}

interface ReverseGeocodeResponse {
  features?: Array<{
    place_name?: string;
  }>;
}

const DEFAULT_LONGITUDE = 109.3425;
const DEFAULT_LATITUDE = -0.0227;

const ROAD_DATA_URL =
  "/data/pontianak-city-streets.json";

const ROAD_SEGMENTS_URL =
  "/data/pontianak-city-street-segments.geojson";

const COVERAGE_DATA_URL =
  "/data/pontianak-city-boundary.geojson";

const COVERAGE_SOURCE_ID =
  "bti-pontianak-coverage";

const COVERAGE_FILL_LAYER_ID =
  "bti-pontianak-coverage-fill";

const COVERAGE_LINE_LAYER_ID =
  "bti-pontianak-coverage-line";

const SELECTED_ROAD_SOURCE_ID =
  "bti-selected-road";

const SELECTED_ROAD_CASING_LAYER_ID =
  "bti-selected-road-casing";

const SELECTED_ROAD_LAYER_ID =
  "bti-selected-road-line";

const SEARCH_RESULT_LIMIT = 10;

function asMapboxGeoJson(value: unknown) {
  return value as Parameters<
    mapboxgl.GeoJSONSource["setData"]
  >[0];
}

function formatRoadCategory(
  highwayType: string | undefined,
) {
  switch (highwayType) {
    case "trunk":
      return "Jalan utama";
    case "primary":
      return "Jalan primer";
    case "secondary":
      return "Jalan sekunder";
    case "tertiary":
      return "Jalan tersier";
    case "living_street":
      return "Jalan lingkungan";
    case "service":
      return "Jalan akses";
    case "footway":
      return "Jalur pejalan kaki";
    case "path":
      return "Jalur lokal";
    case "track":
      return "Jalan lintasan";
    case "cycleway":
      return "Jalur sepeda";
    case "residential":
      return "Jalan permukiman";
    default:
      return "Jalan lokal";
  }
}

function formatApproximateLength(
  meters: number,
) {
  if (!Number.isFinite(meters) || meters <= 0) {
    return "Panjang belum tersedia";
  }

  if (meters < 1_000) {
    return `±${Math.round(meters)} m`;
  }

  return `±${(meters / 1_000).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  )} km`;
}

function isValidRoadDataset(
  value: unknown,
): value is PontianakRoadDataset {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<
    PontianakRoadDataset
  >;

  return (
    Array.isArray(candidate.streets) &&
    candidate.streets.length > 0
  );
}

function isValidCoverageDataset(
  value: unknown,
): value is CoverageFeatureCollection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<
    CoverageFeatureCollection
  >;

  return (
    candidate.type === "FeatureCollection" &&
    Array.isArray(candidate.features) &&
    candidate.features.length > 0
  );
}

function isValidSegmentDataset(
  value: unknown,
): value is RoadSegmentFeatureCollection {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<
    RoadSegmentFeatureCollection
  >;

  return (
    candidate.type === "FeatureCollection" &&
    Array.isArray(candidate.features)
  );
}

export function LocationPicker({
  value,
  onChange,
}: LocationPickerProps) {
  const mapContainerRef =
    useRef<HTMLDivElement | null>(null);

  const searchContainerRef =
    useRef<HTMLDivElement | null>(null);

  const mapRef =
    useRef<mapboxgl.Map | null>(null);

  const markerRef =
    useRef<mapboxgl.Marker | null>(null);

  const abortControllerRef =
    useRef<AbortController | null>(null);

  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  const coverageRef =
    useRef<CoverageFeatureCollection | null>(
      null,
    );

  const selectedRoadNameRef =
    useRef<string | null>(null);

  const [isMapReady, setIsMapReady] =
    useState(false);

  const [
    isResolvingAddress,
    setIsResolvingAddress,
  ] = useState(false);

  const [
    isDatasetLoading,
    setIsDatasetLoading,
  ] = useState(true);

  const [datasetError, setDatasetError] =
    useState<string | null>(null);

  const [coverageMessage, setCoverageMessage] =
    useState<string | null>(null);

  const [roadDataset, setRoadDataset] =
    useState<PontianakRoadDataset | null>(
      null,
    );

  const [coverageDataset, setCoverageDataset] =
    useState<CoverageFeatureCollection | null>(
      null,
    );

  const [segmentDataset, setSegmentDataset] =
    useState<RoadSegmentFeatureCollection | null>(
      null,
    );

  const [searchQuery, setSearchQuery] =
    useState("");

  const [isSearchOpen, setIsSearchOpen] =
    useState(false);

  const [activeResultIndex, setActiveResultIndex] =
    useState(0);

  const [selectedRoadId, setSelectedRoadId] =
    useState<string | null>(null);

  const accessToken =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const searchResults = useMemo(
    () =>
      searchPontianakRoads(
        roadDataset?.streets ?? [],
        searchQuery,
        SEARCH_RESULT_LIMIT,
      ),
    [roadDataset, searchQuery],
  );

  const segmentsByRoadId = useMemo(() => {
    const index = new Map<
      string,
      RoadSegmentFeature[]
    >();

    segmentDataset?.features.forEach(
      (feature) => {
        const roadId =
          feature.properties.road_id;

        const existing =
          index.get(roadId) ?? [];

        existing.push(feature);
        index.set(roadId, existing);
      },
    );

    return index;
  }, [segmentDataset]);

  const selectedRoad = useMemo(
    () =>
      roadDataset?.streets.find(
        (road) => road.id === selectedRoadId,
      ) ?? null,
    [roadDataset, selectedRoadId],
  );

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    coverageRef.current = coverageDataset;
  }, [coverageDataset]);

  useEffect(() => {
    selectedRoadNameRef.current =
      selectedRoad?.name ?? null;
  }, [selectedRoad]);

  useEffect(() => {
    const handlePointerDown = (
      event: PointerEvent,
    ) => {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsSearchOpen(false);
      }
    };

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    );

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const loadDatasets = async () => {
      setIsDatasetLoading(true);
      setDatasetError(null);

      try {
        const [
          roadsResponse,
          coverageResponse,
          segmentsResponse,
        ] = await Promise.all([
          fetch(ROAD_DATA_URL, {
            signal: controller.signal,
          }),
          fetch(COVERAGE_DATA_URL, {
            signal: controller.signal,
          }),
          fetch(ROAD_SEGMENTS_URL, {
            signal: controller.signal,
          }),
        ]);

        if (
          !roadsResponse.ok ||
          !coverageResponse.ok ||
          !segmentsResponse.ok
        ) {
          throw new Error(
            "Salah satu file dataset tidak dapat dimuat.",
          );
        }

        const [roads, coverage, segments] =
          await Promise.all([
            roadsResponse.json() as Promise<unknown>,
            coverageResponse.json() as Promise<unknown>,
            segmentsResponse.json() as Promise<unknown>,
          ]);

        if (!isValidRoadDataset(roads)) {
          throw new Error(
            "Format indeks jalan tidak valid.",
          );
        }

        if (!isValidCoverageDataset(coverage)) {
          throw new Error(
            "Format coverage Kota Pontianak tidak valid.",
          );
        }

        if (!isValidSegmentDataset(segments)) {
          throw new Error(
            "Format geometri jalan tidak valid.",
          );
        }

        setRoadDataset(roads);
        setCoverageDataset(coverage);
        setSegmentDataset(segments);
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Gagal memuat dataset jalan Pontianak:",
          error,
        );

        setDatasetError(
          "Dataset jalan Kota Pontianak tidak dapat dimuat. Segarkan halaman dan coba kembali.",
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsDatasetLoading(false);
        }
      }
    };

    void loadDatasets();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (
      !accessToken ||
      !mapContainerRef.current ||
      mapRef.current
    ) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    const initialLongitude =
      valueRef.current.longitude ??
      DEFAULT_LONGITUDE;

    const initialLatitude =
      valueRef.current.latitude ??
      DEFAULT_LATITUDE;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [
        initialLongitude,
        initialLatitude,
      ],
      zoom:
        valueRef.current.latitude !== null &&
        valueRef.current.longitude !== null
          ? 16
          : 13,
    });

    const marker = new mapboxgl.Marker({
      color: "#2563eb",
    });

    mapRef.current = map;
    markerRef.current = marker;

    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
      }),
      "bottom-right",
    );

    const handleMapLoad = () => {
      if (
        !map.getSource(
          SELECTED_ROAD_SOURCE_ID,
        )
      ) {
        map.addSource(
          SELECTED_ROAD_SOURCE_ID,
          {
            type: "geojson",
            data: asMapboxGeoJson(
              createEmptyRoadCollection(),
            ),
          },
        );

        map.addLayer({
          id: SELECTED_ROAD_CASING_LAYER_ID,
          type: "line",
          source: SELECTED_ROAD_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#ffffff",
            "line-width": 8,
            "line-opacity": 0.95,
          },
        });

        map.addLayer({
          id: SELECTED_ROAD_LAYER_ID,
          type: "line",
          source: SELECTED_ROAD_SOURCE_ID,
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#2563eb",
            "line-width": 5,
            "line-opacity": 0.95,
          },
        });
      }

      setIsMapReady(true);
      map.resize();
    };

    const resolveMapClick = async (
      event: mapboxgl.MapMouseEvent,
    ) => {
      const {
        lng: longitude,
        lat: latitude,
      } = event.lngLat;

      if (!coverageRef.current) {
        setCoverageMessage(
          "Data coverage belum siap. Tunggu hingga dataset selesai dimuat.",
        );
        return;
      }

      if (
        !isPointInsideCoverage(
          longitude,
          latitude,
          coverageRef.current,
        )
      ) {
        setCoverageMessage(
          "Titik berada di luar wilayah penugasan Kota Pontianak.",
        );
        return;
      }

      setCoverageMessage(null);

      marker
        .setLngLat([longitude, latitude])
        .addTo(map);

      const fallbackAddress =
        selectedRoadNameRef.current ||
        valueRef.current.address ||
        "Titik di Kota Pontianak telah dipilih. Lengkapi alamat secara manual.";

      onChangeRef.current({
        address: fallbackAddress,
        latitude,
        longitude,
      });

      abortControllerRef.current?.abort();

      const controller = new AbortController();
      abortControllerRef.current = controller;
      setIsResolvingAddress(true);

      try {
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${accessToken}&language=id&limit=1`,
          {
            signal: controller.signal,
          },
        );

        if (!response.ok) {
          throw new Error(
            "Reverse geocoding tidak berhasil.",
          );
        }

        const data =
          (await response.json()) as ReverseGeocodeResponse;

        const resolvedAddress =
          data.features?.[0]?.place_name;

        onChangeRef.current({
          address:
            resolvedAddress || fallbackAddress,
          latitude,
          longitude,
        });
      } catch (error) {
        if (
          error instanceof DOMException &&
          error.name === "AbortError"
        ) {
          return;
        }

        console.error(
          "Gagal mengambil alamat lokasi:",
          error,
        );

        onChangeRef.current({
          address: fallbackAddress,
          latitude,
          longitude,
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsResolvingAddress(false);
        }
      }
    };

    const handleMapClick = (
      event: mapboxgl.MapMouseEvent,
    ) => {
      void resolveMapClick(event);
    };

    map.on("load", handleMapLoad);
    map.on("click", handleMapClick);

    return () => {
      abortControllerRef.current?.abort();
      map.off("load", handleMapLoad);
      map.off("click", handleMapClick);
      map.remove();

      mapRef.current = null;
      markerRef.current = null;
    };
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;

    if (
      !map ||
      !isMapReady ||
      !coverageDataset
    ) {
      return;
    }

    const existingSource = map.getSource(
      COVERAGE_SOURCE_ID,
    ) as mapboxgl.GeoJSONSource | undefined;

    if (existingSource) {
      existingSource.setData(
        asMapboxGeoJson(coverageDataset),
      );
      return;
    }

    map.addSource(COVERAGE_SOURCE_ID, {
      type: "geojson",
      data: asMapboxGeoJson(coverageDataset),
    });

    map.addLayer(
      {
        id: COVERAGE_FILL_LAYER_ID,
        type: "fill",
        source: COVERAGE_SOURCE_ID,
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.06,
        },
      },
      SELECTED_ROAD_CASING_LAYER_ID,
    );

    map.addLayer(
      {
        id: COVERAGE_LINE_LAYER_ID,
        type: "line",
        source: COVERAGE_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#2563eb",
          "line-width": 2,
          "line-opacity": 0.8,
          "line-dasharray": [2, 2],
        },
      },
      SELECTED_ROAD_CASING_LAYER_ID,
    );
  }, [coverageDataset, isMapReady]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapReady) {
      return;
    }

    const source = map.getSource(
      SELECTED_ROAD_SOURCE_ID,
    ) as mapboxgl.GeoJSONSource | undefined;

    if (!source) {
      return;
    }

    const selectedFeatures = selectedRoadId
      ? segmentsByRoadId.get(
          selectedRoadId,
        ) ?? []
      : [];

    source.setData(
      asMapboxGeoJson({
        type: "FeatureCollection",
        features: selectedFeatures,
      }),
    );
  }, [
    isMapReady,
    segmentsByRoadId,
    selectedRoadId,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;

    if (!map || !marker) {
      return;
    }

    if (
      value.latitude === null ||
      value.longitude === null
    ) {
      marker.remove();
      return;
    }

    marker
      .setLngLat([
        value.longitude,
        value.latitude,
      ])
      .addTo(map);

    map.easeTo({
      center: [
        value.longitude,
        value.latitude,
      ],
      zoom: Math.max(map.getZoom(), 15),
      duration: 700,
    });
  }, [value.latitude, value.longitude]);

  const handleRoadSelect = (
    road: PontianakRoadEntry,
  ) => {
    setSelectedRoadId(road.id);
    setSearchQuery(road.name);
    setIsSearchOpen(false);
    setCoverageMessage(null);

    markerRef.current?.remove();

    onChangeRef.current({
      address: road.name,
      latitude: null,
      longitude: null,
    });

    const map = mapRef.current;

    if (!map) {
      return;
    }

    const [west, south, east, north] =
      road.bbox;

    if (
      [west, south, east, north].every(
        Number.isFinite,
      )
    ) {
      map.fitBounds(
        [
          [west, south],
          [east, north],
        ],
        {
          padding: 80,
          maxZoom: 17,
          duration: 800,
        },
      );
      return;
    }

    map.easeTo({
      center: [
        road.center.longitude,
        road.center.latitude,
      ],
      zoom: 16,
      duration: 800,
    });
  };

  const handleSearchKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      setIsSearchOpen(false);
      return;
    }

    if (searchResults.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setIsSearchOpen(true);
      setActiveResultIndex((current) =>
        Math.min(
          current + 1,
          searchResults.length - 1,
        ),
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setIsSearchOpen(true);
      setActiveResultIndex((current) =>
        Math.max(current - 1, 0),
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();

      const selectedResult =
        searchResults[activeResultIndex] ??
        searchResults[0];

      if (selectedResult) {
        handleRoadSelect(selectedResult.road);
      }
    }
  };

  const clearRoadSearch = () => {
    setSearchQuery("");
    setSelectedRoadId(null);
    setActiveResultIndex(0);
    setIsSearchOpen(false);
    setCoverageMessage(null);
  };

  if (!accessToken) {
    return (
      <div className="flex min-h-96 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <div className="max-w-md text-center">
          <TriangleAlert
            className="mx-auto size-8 text-destructive"
            aria-hidden="true"
          />

          <h3 className="mt-3 text-sm font-semibold text-foreground">
            Token Mapbox belum tersedia
          </h3>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Tambahkan variabel{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
              NEXT_PUBLIC_MAPBOX_TOKEN
            </code>{" "}
            ke file environment project.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-muted">
      <div
        ref={mapContainerRef}
        className="h-[460px] w-full lg:h-[540px]"
        aria-label="Peta pemilihan lokasi klien dalam coverage Kota Pontianak"
      />

      <div
        ref={searchContainerRef}
        className="absolute left-3 top-3 z-20 w-[calc(100%-1.5rem)] max-w-md"
      >
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />

          <Input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setActiveResultIndex(0);
              setIsSearchOpen(true);
            }}
            onFocus={() => setIsSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Cari jalan atau gang di Kota Pontianak..."
            className="h-11 bg-background/95 pl-9 pr-10 text-sm shadow-md backdrop-blur-sm"
            role="combobox"
            aria-expanded={isSearchOpen}
            aria-controls="pontianak-road-results"
            aria-autocomplete="list"
            aria-activedescendant={
              isSearchOpen &&
              searchResults[activeResultIndex]
                ? `pontianak-road-result-${activeResultIndex}`
                : undefined
            }
            disabled={
              isDatasetLoading ||
              Boolean(datasetError)
            }
          />

          {searchQuery ? (
            <button
              type="button"
              onClick={clearRoadSearch}
              className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Hapus pencarian jalan"
              title="Hapus pencarian"
            >
              <X
                className="size-4"
                aria-hidden="true"
              />
            </button>
          ) : null}
        </div>

        {isSearchOpen ? (
          <div
            id="pontianak-road-results"
            role="listbox"
            className="mt-2 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 text-popover-foreground shadow-xl"
          >
            {isDatasetLoading ? (
              <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
                Memuat indeks jalan Kota Pontianak...
              </div>
            ) : datasetError ? (
              <div className="flex items-start gap-2 px-3 py-4 text-sm text-destructive">
                <TriangleAlert
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {datasetError}
              </div>
            ) : searchQuery.trim().length < 2 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Ketik minimal dua karakter nama jalan.
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground">
                Jalan tidak ditemukan dalam dataset Kota Pontianak.
              </div>
            ) : (
              searchResults.map(
                ({ road }, index) => (
                  <button
                    key={road.id}
                    id={`pontianak-road-result-${index}`}
                    type="button"
                    role="option"
                    aria-selected={
                      index === activeResultIndex
                    }
                    onMouseEnter={() =>
                      setActiveResultIndex(index)
                    }
                    onClick={() =>
                      handleRoadSelect(road)
                    }
                    className={[
                      "w-full rounded-md px-3 py-2.5 text-left transition-colors",
                      index === activeResultIndex
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent/60",
                    ].join(" ")}
                  >
                    <span className="block text-sm font-medium">
                      {road.name}
                    </span>

                    <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
                      <span>
                        {formatRoadCategory(
                          road.highway_types[0],
                        )}
                      </span>

                      <span aria-hidden="true">
                        •
                      </span>

                      <span>
                        {road.segment_count} ruas
                      </span>

                      <span aria-hidden="true">
                        •
                      </span>

                      <span>
                        {formatApproximateLength(
                          road.approximate_length_meters,
                        )}
                      </span>
                    </span>

                    {road.aliases.length > 0 ? (
                      <span className="mt-1 block truncate text-[10px] text-muted-foreground">
                        Alias: {road.aliases.join(", ")}
                      </span>
                    ) : null}
                  </button>
                ),
              )
            )}
          </div>
        ) : null}
      </div>

      {coverageMessage ? (
        <div
          role="alert"
          className="absolute left-3 right-3 top-16 z-10 flex max-w-xl items-start gap-2 rounded-md border border-destructive/30 bg-background/95 px-3 py-2.5 text-xs text-destructive shadow-md backdrop-blur-sm"
        >
          <TriangleAlert
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          {coverageMessage}
        </div>
      ) : null}

      {!isMapReady ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Memuat peta lokasi...
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 left-3 right-14 z-10 flex flex-wrap items-end justify-between gap-2">
        <div className="max-w-md rounded-md border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          <div className="flex items-start gap-2">
            <MapPin
              className="mt-0.5 size-4 shrink-0 text-primary"
              aria-hidden="true"
            />

            <span>
              {selectedRoad
                ? `${selectedRoad.name} dipilih. Klik lokasi bangunan klien pada ruas yang disorot.`
                : "Cari jalan, lalu klik lokasi bangunan klien di dalam coverage Kota Pontianak."}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 text-[10px]">
            <Database
              className="size-3"
              aria-hidden="true"
            />

            {roadDataset
              ? `${roadDataset.streets.length.toLocaleString("id-ID")} jalan/gang • Data © OpenStreetMap contributors`
              : "Dataset jalan lokal Kota Pontianak"}
          </div>
        </div>

        {isResolvingAddress ? (
          <div className="flex shrink-0 items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm">
            <LoaderCircle
              className="size-3.5 animate-spin"
              aria-hidden="true"
            />
            Membaca alamat
          </div>
        ) : null}
      </div>
    </div>
  );
}