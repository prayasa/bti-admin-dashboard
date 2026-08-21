"use client";

import { useEffect, useRef, useState } from "react";
import MapboxGeocoder, {
  type MapboxGeocoderResultEvent,
} from "@mapbox/mapbox-gl-geocoder";
import mapboxgl from "mapbox-gl";
import { LoaderCircle, MapPin, TriangleAlert } from "lucide-react";

import "@mapbox/mapbox-gl-geocoder/dist/mapbox-gl-geocoder.css";
import "mapbox-gl/dist/mapbox-gl.css";

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

export function LocationPicker({
  value,
  onChange,
}: LocationPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  const [isMapReady, setIsMapReady] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);

  const accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!accessToken || !mapContainerRef.current || mapRef.current) {
      return;
    }

    mapboxgl.accessToken = accessToken;

    const initialLongitude = valueRef.current.longitude ?? DEFAULT_LONGITUDE;
    const initialLatitude = valueRef.current.latitude ?? DEFAULT_LATITUDE;

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [initialLongitude, initialLatitude],
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

    const geocoder = new MapboxGeocoder({
      accessToken,
      mapboxgl,
      marker: false,
      placeholder: "Cari jalan, gedung, atau area...",
      countries: "id",
      language: "id",
      limit: 10,
      minLength: 3,
      proximity: {
        longitude: DEFAULT_LONGITUDE,
        latitude: DEFAULT_LATITUDE,
      },
      types: "poi,address,neighborhood,locality,place,district",
    });

    map.addControl(geocoder, "top-left");

    geocoder.on(
      "result",
      ({ result }: MapboxGeocoderResultEvent) => {
        const [longitude, latitude] = result.center;

        marker.setLngLat([longitude, latitude]).addTo(map);

        onChangeRef.current({
          address: result.place_name,
          latitude,
          longitude,
        });
      },
    );

    const handleMapClick = async (event: mapboxgl.MapMouseEvent) => {
      const { lng: longitude, lat: latitude } = event.lngLat;

      marker.setLngLat([longitude, latitude]).addTo(map);

      onChangeRef.current({
        address: valueRef.current.address,
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
          throw new Error("Reverse geocoding tidak berhasil.");
        }

        const data = (await response.json()) as ReverseGeocodeResponse;
        const resolvedAddress = data.features?.[0]?.place_name;

        onChangeRef.current({
          address:
            resolvedAddress ??
            valueRef.current.address ??
            "Titik koordinat telah dipilih. Lengkapi alamat secara manual.",
          latitude,
          longitude,
        });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        console.error("Gagal mengambil alamat lokasi:", error);

        onChangeRef.current({
          address:
            valueRef.current.address ||
            "Titik koordinat telah dipilih. Lengkapi alamat secara manual.",
          latitude,
          longitude,
        });
      } finally {
        if (!controller.signal.aborted) {
          setIsResolvingAddress(false);
        }
      }
    };

    map.on("click", handleMapClick);
    map.on("load", () => {
      setIsMapReady(true);
      map.resize();
    });

    return () => {
      abortControllerRef.current?.abort();
      map.off("click", handleMapClick);
      map.remove();

      mapRef.current = null;
      markerRef.current = null;
    };
  }, [accessToken]);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;

    if (!map || !marker) {
      return;
    }

    if (value.latitude === null || value.longitude === null) {
      marker.remove();
      return;
    }

    marker
      .setLngLat([value.longitude, value.latitude])
      .addTo(map);

    map.easeTo({
      center: [value.longitude, value.latitude],
      zoom: Math.max(map.getZoom(), 15),
      duration: 700,
    });
  }, [value.latitude, value.longitude]);

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
        className="h-[420px] w-full lg:h-[500px]"
        aria-label="Peta pemilihan lokasi klien"
      />

      {!isMapReady ? (
        <div className="absolute inset-0 flex items-center justify-center bg-background/90">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle
              className="size-4 animate-spin"
              aria-hidden="true"
            />
            Memuat peta lokasi...
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none absolute bottom-3 left-3 right-14 flex items-center justify-between gap-3">
        <div className="flex max-w-md items-center gap-2 rounded-md border border-border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          <MapPin
            className="size-4 shrink-0 text-primary"
            aria-hidden="true"
          />
          Cari lokasi atau klik langsung pada peta untuk menempatkan pin.
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