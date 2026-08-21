declare module "@mapbox/mapbox-gl-geocoder" {
  import type { IControl, Map as MapboxMap } from "mapbox-gl";

  export interface MapboxGeocoderResult {
    center: [number, number];
    place_name: string;
    id?: string;
    text?: string;
    place_type?: string[];
    relevance?: number;
    [key: string]: unknown;
  }

  export interface MapboxGeocoderResultEvent {
    result: MapboxGeocoderResult;
  }

  export interface MapboxGeocoderOptions {
    accessToken: string;
    mapboxgl: unknown;
    marker?: boolean | Record<string, unknown>;
    placeholder?: string;
    countries?: string;
    language?: string;
    limit?: number;
    minLength?: number;
    proximity?: {
      longitude: number;
      latitude: number;
    };
    types?: string;
  }

  export default class MapboxGeocoder implements IControl {
    constructor(options: MapboxGeocoderOptions);

    on(
      type: "result",
      listener: (event: MapboxGeocoderResultEvent) => void,
    ): this;

    onAdd(map: MapboxMap): HTMLElement;
    onRemove(map: MapboxMap): void;
  }
}