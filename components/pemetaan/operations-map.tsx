"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LoaderCircle, LocateFixed, TriangleAlert } from "lucide-react";
import mapboxgl from "mapbox-gl";

import "mapbox-gl/dist/mapbox-gl.css";

import type { MapLayerVisibility } from "@/components/pemetaan/map-legend";
import { Button } from "@/components/ui/button";

export interface MapAssignmentPoint {
  id: string;
  technicianName: string;
  clientName: string;
  clientAddress: string;
  latitude: number;
  longitude: number;
  status: string;
}

export interface AttendanceMapPoint {
  id: string;
  technicianName: string;
  latitude: number;
  longitude: number;
  isValid: boolean;
  type: string;
  loggedAt: string;
}

export interface LiveTechnicianPoint {
  technicianId: string;
  assignmentId: string;
  sessionId: string;
  technicianName: string;
  clientName: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  speedMps: number | null;
  bearingDegrees: number | null;
  isMock: boolean;
  isStale: boolean;
  recordedAt: string;
  receivedAt: string;
}

export interface TrackingRoutePath {
  sessionId: string;
  coordinates: Array<[number, number]>;
}

interface OperationsMapProps {
  assignments: MapAssignmentPoint[];
  attendancePoints: AttendanceMapPoint[];
  liveTechnicians: LiveTechnicianPoint[];
  trackingPaths: TrackingRoutePath[];
  visibility: MapLayerVisibility;
}

interface PopupRow {
  label: string;
  value: string;
}

const OFFICE_LONGITUDE = 109.32172547120854;
const OFFICE_LATITUDE = -0.030199545602447704;
const GEOFENCE_RADIUS_METERS = 50;
const EARTH_RADIUS_METERS = 6_371_000;

const GEOFENCE_SOURCE_ID = "bti-office-geofence";
const GEOFENCE_FILL_LAYER_ID = "bti-office-geofence-fill";
const GEOFENCE_LINE_LAYER_ID = "bti-office-geofence-line";
const TRACKING_HISTORY_SOURCE_ID = "bti-tracking-history";
const TRACKING_HISTORY_LAYER_ID = "bti-tracking-history-line";

function isValidCoordinate(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180 &&
    !(latitude === 0 && longitude === 0)
  );
}

function createGeofenceFeature(
  longitude: number,
  latitude: number,
  radiusMeters: number,
  points = 72,
) {
  const coordinates: number[][] = [];
  const angularDistance = radiusMeters / EARTH_RADIUS_METERS;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;

  for (let index = 0; index <= points; index += 1) {
    const bearing = (index / points) * Math.PI * 2;

    const destinationLatitude = Math.asin(
      Math.sin(latitudeRadians) * Math.cos(angularDistance) +
        Math.cos(latitudeRadians) *
          Math.sin(angularDistance) *
          Math.cos(bearing),
    );

    const destinationLongitude =
      longitudeRadians +
      Math.atan2(
        Math.sin(bearing) *
          Math.sin(angularDistance) *
          Math.cos(latitudeRadians),
        Math.cos(angularDistance) -
          Math.sin(latitudeRadians) *
            Math.sin(destinationLatitude),
      );

    coordinates.push([
      (destinationLongitude * 180) / Math.PI,
      (destinationLatitude * 180) / Math.PI,
    ]);
  }

  return {
    type: "Feature" as const,
    properties: {
      radiusMeters,
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [coordinates],
    },
  };
}

function createPopupContent(
  title: string,
  rows: PopupRow[],
  accentColor: string,
) {
  const container =
    document.createElement("div");

  container.style.minWidth = "210px";
  container.style.padding = "4px 2px";

  container.style.fontFamily =
    "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif";

  /*
   * Mengikuti warna popover aktif sehingga isi
   * popup tetap terbaca saat tema berubah tanpa
   * perlu membuat ulang marker Mapbox.
   */
  container.style.color =
    "var(--popover-foreground)";

  const heading =
    document.createElement("p");

  heading.textContent = title;
  heading.style.margin = "0 0 8px";
  heading.style.fontSize = "13px";
  heading.style.fontWeight = "700";
  heading.style.lineHeight = "1.4";
  heading.style.color = accentColor;

  container.appendChild(heading);

  const list =
    document.createElement("div");

  list.style.display = "grid";
  list.style.gap = "5px";

  rows.forEach((row) => {
    const item =
      document.createElement("div");

    item.style.display = "grid";

    item.style.gridTemplateColumns =
      "72px minmax(0, 1fr)";

    item.style.gap = "8px";
    item.style.fontSize = "11px";
    item.style.lineHeight = "1.45";

    const label =
      document.createElement("span");

    label.textContent = row.label;

    label.style.color =
      "var(--muted-foreground)";

    const value =
      document.createElement("span");

    value.textContent = row.value;

    value.style.color =
      "var(--popover-foreground)";

    value.style.fontWeight = "600";

    value.style.overflowWrap =
      "anywhere";

    item.append(label, value);
    list.appendChild(item);
  });

  container.appendChild(list);

  return container;
}

function createOfficeMarkerElement() {
  const outer = document.createElement("div");
  outer.style.display = "flex";
  outer.style.height = "28px";
  outer.style.width = "28px";
  outer.style.alignItems = "center";
  outer.style.justifyContent = "center";
  outer.style.borderRadius = "9999px";
  outer.style.border = "1px solid rgba(37, 99, 235, 0.35)";
  outer.style.background = "rgba(219, 234, 254, 0.9)";

  const inner = document.createElement("div");
  inner.style.height = "11px";
  inner.style.width = "11px";
  inner.style.borderRadius = "9999px";
  inner.style.border = "2px solid #ffffff";
  inner.style.background = "#1d4ed8";
  inner.style.boxShadow = "0 1px 2px rgba(15, 23, 42, 0.25)";

  outer.appendChild(inner);

  return outer;
}

function createAttendanceMarkerElement(isValid: boolean) {
  const element = document.createElement("div");

  element.style.height = "15px";
  element.style.width = "15px";
  element.style.borderRadius = "9999px";
  element.style.border = "2px solid #ffffff";
  element.style.background = isValid ? "#8b5cf6" : "#ef4444";
  element.style.boxShadow = "0 1px 3px rgba(15, 23, 42, 0.35)";

  return element;
}

function createLiveTechnicianMarkerElement(
  isStale: boolean,
  isMock: boolean,
) {
  const outer = document.createElement("div");
  const color = isMock
    ? "#dc2626"
    : isStale
      ? "#d97706"
      : "#0891b2";

  outer.style.display = "flex";
  outer.style.height = "30px";
  outer.style.width = "30px";
  outer.style.alignItems = "center";
  outer.style.justifyContent = "center";
  outer.style.borderRadius = "9999px";
  outer.style.border = `2px solid ${color}`;
  outer.style.background = "rgba(255, 255, 255, 0.94)";
  outer.style.boxShadow = "0 2px 8px rgba(15, 23, 42, 0.3)";

  const inner = document.createElement("div");
  inner.style.height = "12px";
  inner.style.width = "12px";
  inner.style.borderRadius = "9999px";
  inner.style.background = color;
  inner.style.border = "2px solid #ffffff";

  outer.appendChild(inner);

  return outer;
}

function getAssignmentMarkerColor(status: string) {
  switch (status) {
    case "Success":
      return "#10b981";
    case "On Process":
      return "#2563eb";
    default:
      return "#f59e0b";
  }
}

function getAssignmentStatusLabel(status: string) {
  switch (status) {
    case "Pending":
      return "Menunggu";
    case "On Process":
      return "Diproses";
    case "Success":
      return "Selesai";
    default:
      return status || "Tidak diketahui";
  }
}

function formatAttendanceTime(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
    timeZone: "Asia/Pontianak",
  }).format(new Date(value));
}

function formatLiveTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Tidak tersedia";
  }

  return `${new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Pontianak",
  }).format(date)} WIB`;
}

function formatSpeed(speedMps: number | null) {
  if (speedMps === null || !Number.isFinite(speedMps)) {
    return "-";
  }

  return `${Math.max(0, speedMps * 3.6).toFixed(1)} km/jam`;
}

function createTrackingHistoryFeatureCollection(
  trackingPaths: TrackingRoutePath[],
) {
  return {
    type: "FeatureCollection" as const,
    features: trackingPaths
      .filter((path) => path.coordinates.length >= 2)
      .map((path) => ({
        type: "Feature" as const,
        properties: {
          sessionId: path.sessionId,
        },
        geometry: {
          type: "LineString" as const,
          coordinates: path.coordinates,
        },
      })),
  };
}

export function OperationsMap({
  assignments,
  attendancePoints,
  liveTechnicians,
  trackingPaths,
  visibility,
}: OperationsMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const officeMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const dynamicMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const hasAutoFittedRef = useRef(false);

  const [isMapReady, setIsMapReady] = useState(false);

  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  const clearDynamicMarkers = useCallback(() => {
    dynamicMarkersRef.current.forEach((marker) => marker.remove());
    dynamicMarkersRef.current = [];
  }, []);

  const fitVisiblePoints = useCallback(() => {
    const map = mapRef.current;

    if (!map) {
      return;
    }

    const bounds = new mapboxgl.LngLatBounds();
    let pointCount = 0;

    if (visibility.office) {
      bounds.extend([OFFICE_LONGITUDE, OFFICE_LATITUDE]);
      pointCount += 1;
    }

    assignments.forEach((assignment) => {
      const isCompleted = assignment.status === "Success";
      const isVisible = isCompleted
        ? visibility.completedAssignments
        : visibility.activeAssignments;

      if (
        isVisible &&
        isValidCoordinate(
          assignment.latitude,
          assignment.longitude,
        )
      ) {
        bounds.extend([
          assignment.longitude,
          assignment.latitude,
        ]);
        pointCount += 1;
      }
    });

    if (visibility.attendance) {
      attendancePoints.forEach((attendance) => {
        if (
          isValidCoordinate(
            attendance.latitude,
            attendance.longitude,
          )
        ) {
          bounds.extend([
            attendance.longitude,
            attendance.latitude,
          ]);
          pointCount += 1;
        }
      });
    }

    if (visibility.liveTechnicians) {
      liveTechnicians.forEach((technician) => {
        if (
          isValidCoordinate(
            technician.latitude,
            technician.longitude,
          )
        ) {
          bounds.extend([
            technician.longitude,
            technician.latitude,
          ]);
          pointCount += 1;
        }
      });
    }

    if (pointCount <= 1) {
      map.easeTo({
        center: [OFFICE_LONGITUDE, OFFICE_LATITUDE],
        zoom: 14,
        duration: 700,
      });
      return;
    }

    map.fitBounds(bounds, {
      padding: {
        top: 70,
        right: 70,
        bottom: 70,
        left: 70,
      },
      maxZoom: 16,
      duration: 800,
    });
  }, [
    assignments,
    attendancePoints,
    liveTechnicians,
    visibility,
  ]);

  useEffect(() => {
    if (!accessToken || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [OFFICE_LONGITUDE, OFFICE_LATITUDE],
      zoom: 14,
    });

    mapRef.current = map;

    map.addControl(
      new mapboxgl.NavigationControl({
        showCompass: true,
        showZoom: true,
      }),
      "bottom-right",
    );

    map.addControl(
      new mapboxgl.FullscreenControl(),
      "bottom-right",
    );

    const officeMarker = new mapboxgl.Marker({
      element: createOfficeMarkerElement(),
    })
      .setLngLat([OFFICE_LONGITUDE, OFFICE_LATITUDE])
      .setPopup(
        new mapboxgl.Popup({
          offset: 18,
          closeButton: true,
        }).setDOMContent(
          createPopupContent(
            "Kantor Pusat BTI",
            [
              {
                label: "Area",
                value: "Geofence presensi",
              },
              {
                label: "Radius",
                value: `${GEOFENCE_RADIUS_METERS} meter`,
              },
              {
                label: "Koordinat",
                value: `${OFFICE_LATITUDE.toFixed(6)}, ${OFFICE_LONGITUDE.toFixed(6)}`,
              },
            ],
            "#1d4ed8",
          ),
        ),
      )
      .addTo(map);

    officeMarkerRef.current = officeMarker;

    const handleMapLoad = () => {
      map.addSource(GEOFENCE_SOURCE_ID, {
        type: "geojson",
        data: createGeofenceFeature(
          OFFICE_LONGITUDE,
          OFFICE_LATITUDE,
          GEOFENCE_RADIUS_METERS,
        ),
      });

      map.addLayer({
        id: GEOFENCE_FILL_LAYER_ID,
        type: "fill",
        source: GEOFENCE_SOURCE_ID,
        paint: {
          "fill-color": "#2563eb",
          "fill-opacity": 0.12,
        },
      });

      map.addLayer({
        id: GEOFENCE_LINE_LAYER_ID,
        type: "line",
        source: GEOFENCE_SOURCE_ID,
        paint: {
          "line-color": "#2563eb",
          "line-width": 2,
          "line-opacity": 0.75,
        },
      });

      map.addSource(TRACKING_HISTORY_SOURCE_ID, {
        type: "geojson",
        data: createTrackingHistoryFeatureCollection([]),
      });

      map.addLayer({
        id: TRACKING_HISTORY_LAYER_ID,
        type: "line",
        source: TRACKING_HISTORY_SOURCE_ID,
        layout: {
          "line-cap": "round",
          "line-join": "round",
        },
        paint: {
          "line-color": "#0891b2",
          "line-width": 4,
          "line-opacity": 0.72,
        },
      });

      setIsMapReady(true);
      map.resize();
    };

    map.on("load", handleMapLoad);

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(mapContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      clearDynamicMarkers();
      officeMarker.remove();
      map.off("load", handleMapLoad);
      map.remove();

      mapRef.current = null;
      officeMarkerRef.current = null;
      hasAutoFittedRef.current = false;
    };
  }, [accessToken, clearDynamicMarkers]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapReady) {
      return;
    }

    const officeVisibility = visibility.office
      ? "visible"
      : "none";

    if (map.getLayer(GEOFENCE_FILL_LAYER_ID)) {
      map.setLayoutProperty(
        GEOFENCE_FILL_LAYER_ID,
        "visibility",
        officeVisibility,
      );
    }

    if (map.getLayer(GEOFENCE_LINE_LAYER_ID)) {
      map.setLayoutProperty(
        GEOFENCE_LINE_LAYER_ID,
        "visibility",
        officeVisibility,
      );
    }

    const officeElement = officeMarkerRef.current?.getElement();

    if (officeElement) {
      officeElement.style.display = visibility.office
        ? "flex"
        : "none";
    }
  }, [isMapReady, visibility.office]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapReady) {
      return;
    }

    const source = map.getSource(
      TRACKING_HISTORY_SOURCE_ID,
    ) as mapboxgl.GeoJSONSource | undefined;

    source?.setData(
      createTrackingHistoryFeatureCollection(trackingPaths),
    );

    if (map.getLayer(TRACKING_HISTORY_LAYER_ID)) {
      map.setLayoutProperty(
        TRACKING_HISTORY_LAYER_ID,
        "visibility",
        visibility.liveTechnicians ? "visible" : "none",
      );
    }
  }, [
    isMapReady,
    trackingPaths,
    visibility.liveTechnicians,
  ]);

  useEffect(() => {
    const map = mapRef.current;

    if (!map || !isMapReady) {
      return;
    }

    clearDynamicMarkers();

    assignments.forEach((assignment) => {
      if (
        !isValidCoordinate(
          assignment.latitude,
          assignment.longitude,
        )
      ) {
        return;
      }

      const isCompleted = assignment.status === "Success";
      const shouldDisplay = isCompleted
        ? visibility.completedAssignments
        : visibility.activeAssignments;

      if (!shouldDisplay) {
        return;
      }

      const marker = new mapboxgl.Marker({
        color: getAssignmentMarkerColor(assignment.status),
      })
        .setLngLat([
          assignment.longitude,
          assignment.latitude,
        ])
        .setPopup(
          new mapboxgl.Popup({
            offset: 25,
          }).setDOMContent(
            createPopupContent(
              assignment.clientName,
              [
                {
                  label: "Teknisi",
                  value: assignment.technicianName,
                },
                {
                  label: "Status",
                  value: getAssignmentStatusLabel(
                    assignment.status,
                  ),
                },
                {
                  label: "Alamat",
                  value: assignment.clientAddress,
                },
              ],
              getAssignmentMarkerColor(assignment.status),
            ),
          ),
        )
        .addTo(map);

      dynamicMarkersRef.current.push(marker);
    });

    if (visibility.attendance) {
      attendancePoints.forEach((attendance) => {
        if (
          !isValidCoordinate(
            attendance.latitude,
            attendance.longitude,
          )
        ) {
          return;
        }

        const marker = new mapboxgl.Marker({
          element: createAttendanceMarkerElement(
            attendance.isValid,
          ),
        })
          .setLngLat([
            attendance.longitude,
            attendance.latitude,
          ])
          .setPopup(
            new mapboxgl.Popup({
              offset: 14,
            }).setDOMContent(
              createPopupContent(
                attendance.isValid
                  ? "Presensi valid"
                  : "Presensi di luar radius",
                [
                  {
                    label: "Teknisi",
                    value: attendance.technicianName,
                  },
                  {
                    label: "Tipe",
                    value: attendance.type,
                  },
                  {
                    label: "Waktu",
                    value: formatAttendanceTime(
                      attendance.loggedAt,
                    ),
                  },
                  {
                    label: "Validasi",
                    value: attendance.isValid
                      ? "Dalam radius"
                      : "Di luar radius",
                  },
                ],
                attendance.isValid ? "#7c3aed" : "#dc2626",
              ),
            ),
          )
          .addTo(map);

        dynamicMarkersRef.current.push(marker);
      });
    }

    if (visibility.liveTechnicians) {
      liveTechnicians.forEach((technician) => {
        if (
          !isValidCoordinate(
            technician.latitude,
            technician.longitude,
          )
        ) {
          return;
        }

        const marker = new mapboxgl.Marker({
          element: createLiveTechnicianMarkerElement(
            technician.isStale,
            technician.isMock,
          ),
        })
          .setLngLat([
            technician.longitude,
            technician.latitude,
          ])
          .setPopup(
            new mapboxgl.Popup({
              offset: 20,
            }).setDOMContent(
              createPopupContent(
                technician.technicianName,
                [
                  {
                    label: "Tugas",
                    value: technician.clientName,
                  },
                  {
                    label: "Status",
                    value: technician.isMock
                      ? "Mock location"
                      : technician.isStale
                        ? "Lokasi terlambat"
                        : "Aktif",
                  },
                  {
                    label: "Akurasi",
                    value: `±${Math.round(
                      technician.accuracyMeters,
                    )} meter`,
                  },
                  {
                    label: "Kecepatan",
                    value: formatSpeed(technician.speedMps),
                  },
                  {
                    label: "Diterima",
                    value: formatLiveTime(
                      technician.receivedAt,
                    ),
                  },
                ],
                technician.isMock
                  ? "#dc2626"
                  : technician.isStale
                    ? "#b45309"
                    : "#0e7490",
              ),
            ),
          )
          .addTo(map);

        dynamicMarkersRef.current.push(marker);
      });
    }

    if (
      !hasAutoFittedRef.current &&
      (assignments.length > 0 ||
        attendancePoints.length > 0 ||
        liveTechnicians.length > 0)
    ) {
      hasAutoFittedRef.current = true;
      window.requestAnimationFrame(fitVisiblePoints);
    }

    return clearDynamicMarkers;
  }, [
    assignments,
    attendancePoints,
    liveTechnicians,
    clearDynamicMarkers,
    fitVisiblePoints,
    isMapReady,
    visibility.activeAssignments,
    visibility.attendance,
    visibility.completedAssignments,
    visibility.liveTechnicians,
  ]);

  if (!accessToken) {
    return (
      <div className="flex min-h-[560px] items-center justify-center bg-muted/30 p-6">
        <div className="max-w-md text-center">
          <TriangleAlert
            className="mx-auto size-8 text-destructive"
            aria-hidden="true"
          />

          <h3 className="mt-3 text-sm font-semibold text-foreground">
            Token Mapbox belum tersedia
          </h3>

          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Tambahkan{" "}
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
    <div className="relative h-[560px] w-full overflow-hidden bg-muted lg:h-[650px]">
  <div
    ref={mapContainerRef}
    className="h-full w-full"
    aria-label="Peta pemantauan penugasan, presensi, dan posisi realtime teknisi"
  />

      {!isMapReady ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/90">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Memuat data spasial...
          </div>
        </div>
      ) : null}

      {isMapReady ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fitVisiblePoints}
          className="absolute right-3 top-3 z-10 bg-background/95 shadow-sm"
        >
          <LocateFixed className="size-4" aria-hidden="true" />
          Sesuaikan tampilan
        </Button>
      ) : null}
    </div>
  );
}
