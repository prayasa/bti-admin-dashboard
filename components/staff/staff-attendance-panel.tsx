"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import jsQR from "jsqr";
import {
  Camera,
  CameraOff,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LoaderCircle,
  LocateFixed,
  MapPin,
  QrCode,
  RefreshCw,
  ScanLine,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/src/utils/supabase";

const LOCATION_TIMEOUT_MILLIS = 20_000;
const LOCATION_REFRESH_THRESHOLD_MILLIS = 25_000;
const SCAN_INTERVAL_MILLIS = 100;
const MAX_SCAN_WIDTH = 960;

type AttendanceType = "MASUK" | "PULANG";

type AttendancePhase =
  | "idle"
  | "preparing"
  | "scanning"
  | "submitting"
  | "accepted"
  | "rejected"
  | "error";

interface LocationSnapshot {
  latitude: number;
  longitude: number;
  accuracyMeters: number;
  recordedAt: number;
}

interface AttendanceResult {
  accepted: boolean;
  message: string;
  attendanceType: AttendanceType;
  attendanceId: string;
  attendanceTime: string;
  distanceMeters: number | null;
  accuracyMeters: number;
}

interface StaffAttendancePanelProps {
  technicianId: string;
  browserDeviceId: string;
  onSessionInvalid: (message: string) => void;
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeText(value: unknown) {
  return typeof value === "string"
    ? value.trim()
    : "";
}

function parseRpcRecord(data: unknown) {
  if (isRecord(data)) {
    return data;
  }

  if (
    Array.isArray(data) &&
    data.length > 0 &&
    isRecord(data[0])
  ) {
    return data[0];
  }

  return null;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error)) {
    return [
      error.message,
      error.details,
      error.hint,
      error.code,
    ]
      .map(normalizeText)
      .filter(Boolean)
      .join(" ");
  }

  return normalizeText(error);
}

function getSafeErrorDiagnostic(error: unknown) {
  if (!isRecord(error)) {
    return {
      code: "",
      message: getErrorMessage(error),
    };
  }

  return {
    code: normalizeText(error.code),
    message: normalizeText(error.message),
    details: normalizeText(error.details),
    hint: normalizeText(error.hint),
  };
}

function getGeolocationErrorCode(
  error: unknown,
) {
  if (
    isRecord(error) &&
    typeof error.code === "number"
  ) {
    return error.code;
  }

  return null;
}

function isSessionValidationError(error: unknown) {
  const message = getErrorMessage(error)
    .toLowerCase();

  return (
    message.includes("perangkat belum terdaftar") ||
    message.includes("terikat pada perangkat lain") ||
    message.includes("identitas teknisi tidak valid") ||
    message.includes("akun teknisi tidak ditemukan")
  );
}

function getLocationErrorMessage(error: unknown) {
  const errorCode =
    getGeolocationErrorCode(error);

  if (errorCode === 1) {
    return "Izin lokasi ditolak. Izinkan lokasi untuk situs BTI Staff melalui pengaturan Safari.";
  }

  if (errorCode === 2) {
    return "Lokasi belum tersedia. Pastikan layanan lokasi aktif dan coba di area terbuka.";
  }

  if (errorCode === 3) {
    return "Pengambilan lokasi melewati batas waktu. Pastikan GPS aktif lalu coba kembali.";
  }

  const message = getErrorMessage(error)
    .toLowerCase();

  if (message.includes("secure context")) {
    return "Kamera dan lokasi hanya tersedia melalui HTTPS.";
  }

  return "Lokasi belum dapat diperoleh. Periksa izin lokasi dan koneksi perangkat.";
}

function getCameraErrorMessage(error: unknown) {
  const errorName = isRecord(error)
    ? normalizeText(error.name)
    : error instanceof Error
      ? error.name
      : "";

  if (
    errorName === "NotAllowedError" ||
    errorName === "SecurityError"
  ) {
    return "Izin kamera ditolak. Izinkan kamera untuk situs BTI Staff melalui pengaturan Safari.";
  }

  if (
    errorName === "NotFoundError" ||
    errorName === "DevicesNotFoundError"
  ) {
    return "Kamera perangkat tidak ditemukan.";
  }

  if (
    errorName === "NotReadableError" ||
    errorName === "TrackStartError"
  ) {
    return "Kamera sedang digunakan aplikasi lain. Tutup aplikasi kamera lalu coba kembali.";
  }

  if (errorName === "OverconstrainedError") {
    return "Kamera belakang tidak tersedia dengan konfigurasi yang diminta.";
  }

  return "Kamera belum dapat dibuka. Periksa izin kamera lalu coba kembali.";
}

function getFreshLocation() {
  return new Promise<LocationSnapshot>(
    (resolve, reject) => {
      if (!("geolocation" in navigator)) {
        reject(
          new Error(
            "Geolocation tidak tersedia pada browser ini.",
          ),
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, accuracy } =
            position.coords;

          if (
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            !Number.isFinite(accuracy)
          ) {
            reject(
              new Error(
                "Koordinat lokasi tidak valid.",
              ),
            );
            return;
          }

          resolve({
            latitude,
            longitude,
            accuracyMeters: Math.max(0, accuracy),
            recordedAt:
              Number.isFinite(position.timestamp) &&
              position.timestamp > 0
                ? position.timestamp
                : Date.now(),
          });
        },
        reject,
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: LOCATION_TIMEOUT_MILLIS,
        },
      );
    },
  );
}

function parseAttendanceResult(
  data: unknown,
  attendanceType: AttendanceType,
  fallbackAccuracyMeters: number,
): AttendanceResult | null {
  const record = parseRpcRecord(data);

  if (!record) {
    return null;
  }

  const accepted = record.accepted === true;
  const message =
    normalizeText(record.message) ||
    (accepted
      ? "Presensi diterima."
      : "Presensi ditolak.");

  const returnedType = normalizeText(
    record.tipe_log,
  ).toUpperCase();

  const parsedDistance = Number(
    record.distance_meters,
  );

  const parsedAccuracy = Number(
    record.accuracy_meters,
  );

  return {
    accepted,
    message,
    attendanceType:
      returnedType === "PULANG"
        ? "PULANG"
        : returnedType === "MASUK"
          ? "MASUK"
          : attendanceType,
    attendanceId:
      normalizeText(record.id_absen) ||
      normalizeText(record.id),
    attendanceTime: normalizeText(
      record.waktu_log,
    ),
    distanceMeters: Number.isFinite(
      parsedDistance,
    )
      ? parsedDistance
      : null,
    accuracyMeters: Number.isFinite(
      parsedAccuracy,
    )
      ? parsedAccuracy
      : fallbackAccuracyMeters,
  };
}

function formatAccuracy(value: number) {
  return `±${Math.round(value)} m`;
}

function formatDistance(value: number) {
  if (value < 1_000) {
    return `${Math.round(value)} m`;
  }

  return `${(value / 1_000).toLocaleString(
    "id-ID",
    {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  )} km`;
}

function formatAttendanceTime(value: string) {
  if (!value) {
    return "Baru saja";
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(parsedDate);
}

export function StaffAttendancePanel({
  technicianId,
  browserDeviceId,
  onSessionInvalid,
}: StaffAttendancePanelProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mediaStreamRef =
    useRef<MediaStream | null>(null);
  const animationFrameRef =
    useRef<number | null>(null);
  const locationWatchIdRef =
    useRef<number | null>(null);
  const scannerActiveRef = useRef(false);
  const processingResultRef = useRef(false);
  const latestLocationRef =
    useRef<LocationSnapshot | null>(null);

  const [attendanceType, setAttendanceType] =
    useState<AttendanceType>("MASUK");
  const [phase, setPhase] =
    useState<AttendancePhase>("idle");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [statusMessage, setStatusMessage] =
    useState("");
  const [locationSnapshot, setLocationSnapshot] =
    useState<LocationSnapshot | null>(null);
  const [attendanceResult, setAttendanceResult] =
    useState<AttendanceResult | null>(null);

  const stopCapture = useCallback(() => {
    scannerActiveRef.current = false;

    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(
        animationFrameRef.current,
      );
      animationFrameRef.current = null;
    }

    if (locationWatchIdRef.current !== null) {
      navigator.geolocation.clearWatch(
        locationWatchIdRef.current,
      );
      locationWatchIdRef.current = null;
    }

    if (mediaStreamRef.current) {
      for (const track of
        mediaStreamRef.current.getTracks()) {
        track.stop();
      }

      mediaStreamRef.current = null;
    }

    const videoElement = videoRef.current;

    if (videoElement) {
      videoElement.pause();
      videoElement.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopCapture();
    };
  }, [stopCapture]);

  const submitAttendance = async (
    qrPayload: string,
  ) => {
    setPhase("submitting");
    setStatusMessage(
      "Memvalidasi QR dan geofence kantor...",
    );
    setErrorMessage("");

    try {
      let currentLocation =
        latestLocationRef.current;

      if (
        !currentLocation ||
        Date.now() - currentLocation.recordedAt >
          LOCATION_REFRESH_THRESHOLD_MILLIS
      ) {
        setStatusMessage(
          "Memperbarui lokasi sebelum presensi...",
        );

        currentLocation =
          await getFreshLocation();

        latestLocationRef.current =
          currentLocation;
        setLocationSnapshot(currentLocation);
      }

      const locationAgeMillis = Math.max(
        0,
        Math.round(
          Date.now() -
            currentLocation.recordedAt,
        ),
      );

      const { data, error } =
        await supabase.rpc(
          "staff_submit_attendance",
          {
            p_technician_id: technicianId,
            p_device_id: browserDeviceId,
            p_attendance_type: attendanceType,
            p_qr_payload: qrPayload,
            p_latitude:
              currentLocation.latitude,
            p_longitude:
              currentLocation.longitude,
            p_accuracy_meters:
              currentLocation.accuracyMeters,
            p_location_age_ms:
              locationAgeMillis,
            /*
             * Web Geolocation tidak menyediakan indikator
             * Android mock-location. Karena itu PWA hanya
             * mengirim hasil lokasi browser, sedangkan
             * geofence tetap diverifikasi di server.
             */
            p_is_mock: false,
          },
        );

      if (error) {
        console.warn(
          "RPC staff_submit_attendance gagal:",
          getSafeErrorDiagnostic(error),
        );

        if (isSessionValidationError(error)) {
          onSessionInvalid(
            "Sesi perangkat tidak lagi valid. Silakan login kembali.",
          );
          return;
        }

        setPhase("error");
        setStatusMessage("");
        setErrorMessage(
          getErrorMessage(error) ||
            "Presensi belum dapat diproses server.",
        );
        return;
      }

      const parsedResult =
        parseAttendanceResult(
          data,
          attendanceType,
          currentLocation.accuracyMeters,
        );

      if (!parsedResult) {
        throw new Error(
          "Respons presensi tidak valid.",
        );
      }

      setAttendanceResult(parsedResult);
      setStatusMessage("");
      setErrorMessage("");
      setPhase(
        parsedResult.accepted
          ? "accepted"
          : "rejected",
      );
    } catch (error) {
      console.error(
        "Presensi PWA mengalami gangguan:",
        getSafeErrorDiagnostic(error),
      );

      setPhase("error");
      setStatusMessage("");

      const errorText = getErrorMessage(error);

      if (
        errorText
          .toLowerCase()
          .includes("lokasi") ||
        errorText
          .toLowerCase()
          .includes("geolocation")
      ) {
        setErrorMessage(
          getLocationErrorMessage(error),
        );
      } else {
        setErrorMessage(
          "Presensi belum dapat diproses. Periksa koneksi lalu coba kembali.",
        );
      }
    } finally {
      processingResultRef.current = false;
    }
  };

  const handleDecodedPayload = (
    qrPayload: string,
  ) => {
    const normalizedPayload = qrPayload.trim();

    if (
      !normalizedPayload ||
      processingResultRef.current
    ) {
      return;
    }

    processingResultRef.current = true;
    stopCapture();
    setStatusMessage(
      "QR terbaca. Menyiapkan validasi presensi...",
    );

    void submitAttendance(normalizedPayload);
  };

  const startLocationWatch = () => {
    if (!("geolocation" in navigator)) {
      return;
    }

    locationWatchIdRef.current =
      navigator.geolocation.watchPosition(
        (position) => {
          const nextLocation: LocationSnapshot = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: Math.max(
              0,
              position.coords.accuracy,
            ),
            recordedAt:
              position.timestamp > 0
                ? position.timestamp
                : Date.now(),
          };

          latestLocationRef.current =
            nextLocation;
          setLocationSnapshot(nextLocation);
        },
        (error) => {
          console.info(
            "Pembaruan lokasi PWA tertunda:",
            {
              code: error.code,
              message: error.message,
            },
          );
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: LOCATION_TIMEOUT_MILLIS,
        },
      );
  };

  const startScanner = async () => {
    if (
      phase === "preparing" ||
      phase === "scanning" ||
      phase === "submitting"
    ) {
      return;
    }

    stopCapture();
    processingResultRef.current = false;
    setAttendanceResult(null);
    setErrorMessage("");
    setStatusMessage(
      "Memeriksa lokasi perangkat...",
    );
    setPhase("preparing");

    if (!window.isSecureContext) {
      setPhase("error");
      setStatusMessage("");
      setErrorMessage(
        "Kamera dan lokasi memerlukan HTTPS. Buka BTI Staff melalui alamat deployment HTTPS.",
      );
      return;
    }

    try {
      const initialLocation =
        await getFreshLocation();

      latestLocationRef.current =
        initialLocation;
      setLocationSnapshot(initialLocation);
      startLocationWatch();

      if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
      ) {
        throw new Error(
          "MEDIA_DEVICES_UNAVAILABLE",
        );
      }

      setStatusMessage(
        "Membuka kamera belakang...",
      );

      const mediaStream =
        await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: {
              ideal: "environment",
            },
            width: {
              ideal: 1280,
            },
            height: {
              ideal: 720,
            },
          },
        });

      mediaStreamRef.current = mediaStream;

      const videoElement = videoRef.current;

      if (!videoElement) {
        throw new Error(
          "Elemen kamera tidak tersedia.",
        );
      }

      videoElement.srcObject = mediaStream;
      videoElement.muted = true;
      videoElement.playsInline = true;

      await videoElement.play();

      scannerActiveRef.current = true;
      setPhase("scanning");
      setStatusMessage(
        "Arahkan kamera ke Dynamic QR Code kantor.",
      );

      let lastScanTime = 0;

      const scanFrame = (timestamp: number) => {
        if (!scannerActiveRef.current) {
          return;
        }

        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (
          video &&
          canvas &&
          video.readyState >=
            HTMLMediaElement.HAVE_CURRENT_DATA &&
          timestamp - lastScanTime >=
            SCAN_INTERVAL_MILLIS
        ) {
          lastScanTime = timestamp;

          const sourceWidth = video.videoWidth;
          const sourceHeight = video.videoHeight;

          if (
            sourceWidth > 0 &&
            sourceHeight > 0
          ) {
            const scale = Math.min(
              1,
              MAX_SCAN_WIDTH / sourceWidth,
            );

            canvas.width = Math.max(
              1,
              Math.round(sourceWidth * scale),
            );
            canvas.height = Math.max(
              1,
              Math.round(sourceHeight * scale),
            );

            const context =
              canvas.getContext("2d", {
                willReadFrequently: true,
              });

            if (context) {
              context.drawImage(
                video,
                0,
                0,
                canvas.width,
                canvas.height,
              );

              const imageData =
                context.getImageData(
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );

              const decodedQr = jsQR(
                imageData.data,
                imageData.width,
                imageData.height,
                {
                  inversionAttempts:
                    "attemptBoth",
                },
              );

              if (decodedQr?.data) {
                handleDecodedPayload(
                  decodedQr.data,
                );
                return;
              }
            }
          }
        }

        animationFrameRef.current =
          window.requestAnimationFrame(
            scanFrame,
          );
      };

      animationFrameRef.current =
        window.requestAnimationFrame(scanFrame);
    } catch (error) {
      stopCapture();
      setPhase("error");
      setStatusMessage("");

      const errorText = getErrorMessage(error);

      if (
        errorText
          .toLowerCase()
          .includes("location") ||
        errorText
          .toLowerCase()
          .includes("geolocation") ||
        getGeolocationErrorCode(error) !==
          null
      ) {
        setErrorMessage(
          getLocationErrorMessage(error),
        );
      } else if (
        errorText ===
        "MEDIA_DEVICES_UNAVAILABLE"
      ) {
        setErrorMessage(
          "Kamera browser tidak tersedia. Gunakan Safari terbaru melalui HTTPS.",
        );
      } else {
        setErrorMessage(
          getCameraErrorMessage(error),
        );
      }
    }
  };

  const stopScannerByUser = () => {
    stopCapture();
    processingResultRef.current = false;
    setPhase("idle");
    setStatusMessage("");
    setErrorMessage("");
  };

  const resetAttendance = () => {
    stopCapture();
    processingResultRef.current = false;
    setPhase("idle");
    setStatusMessage("");
    setErrorMessage("");
    setAttendanceResult(null);
  };

  const isBusy =
    phase === "preparing" ||
    phase === "scanning" ||
    phase === "submitting";

  return (
    <section
      className="space-y-4 rounded-lg border border-border bg-muted/20 p-4"
      aria-labelledby="staff-attendance-title"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <QrCode
              className="size-4 text-primary"
              aria-hidden="true"
            />
            <h2
              id="staff-attendance-title"
              className="text-sm font-semibold"
            >
              Presensi QR
            </h2>
          </div>

          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Validasi Dynamic QR dan geofence
            dilakukan oleh server BTI.
          </p>
        </div>

        <Badge variant="outline">
          PWA iOS
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={
            attendanceType === "MASUK"
              ? "default"
              : "outline"
          }
          onClick={() => {
            setAttendanceType("MASUK");
            resetAttendance();
          }}
          disabled={isBusy}
          aria-pressed={
            attendanceType === "MASUK"
          }
        >
          Presensi masuk
        </Button>

        <Button
          type="button"
          variant={
            attendanceType === "PULANG"
              ? "default"
              : "outline"
          }
          onClick={() => {
            setAttendanceType("PULANG");
            resetAttendance();
          }}
          disabled={isBusy}
          aria-pressed={
            attendanceType === "PULANG"
          }
        >
          Presensi pulang
        </Button>
      </div>

      <div
        className={`relative overflow-hidden rounded-lg border bg-black ${
          phase === "scanning"
            ? "block"
            : "hidden"
        }`}
      >
        <video
          ref={videoRef}
          className="aspect-[3/4] w-full object-cover"
          muted
          playsInline
          aria-label="Pratinjau kamera pemindai QR"
        />

        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center"
          aria-hidden="true"
        >
          <div className="relative aspect-square w-2/3 max-w-64 rounded-2xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]">
            <ScanLine className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-white/80" />
          </div>
        </div>
      </div>

      <canvas
        ref={canvasRef}
        className="hidden"
        aria-hidden="true"
      />

      {locationSnapshot ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <LocateFixed
                className="size-3.5"
                aria-hidden="true"
              />
              <span className="text-[11px]">
                Akurasi lokasi
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold">
              {formatAccuracy(
                locationSnapshot.accuracyMeters,
              )}
            </p>
          </div>

          <div className="rounded-md border border-border bg-background p-3">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock3
                className="size-3.5"
                aria-hidden="true"
              />
              <span className="text-[11px]">
                Lokasi diperbarui
              </span>
            </div>
            <p className="mt-1 text-sm font-semibold">
              Baru diperbarui
            </p>
          </div>
        </div>
      ) : null}

      {statusMessage ? (
        <div
          className="flex items-start gap-2 rounded-md border border-info/20 bg-info-muted p-3 text-xs leading-5 text-info-muted-foreground"
          role="status"
          aria-live="polite"
        >
          {phase === "preparing" ||
          phase === "submitting" ? (
            <LoaderCircle
              className="mt-0.5 size-4 shrink-0 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <MapPin
              className="mt-0.5 size-4 shrink-0"
              aria-hidden="true"
            />
          )}
          <span>{statusMessage}</span>
        </div>
      ) : null}

      {errorMessage ? (
        <div
          className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs leading-5 text-destructive"
          role="alert"
          aria-live="assertive"
        >
          <CircleAlert
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <span>{errorMessage}</span>
        </div>
      ) : null}

      {attendanceResult ? (
        <div
          className={`rounded-md border p-3 ${
            attendanceResult.accepted
              ? "border-success/20 bg-success-muted text-success-muted-foreground"
              : "border-destructive/30 bg-destructive/5 text-destructive"
          }`}
          role="status"
        >
          <div className="flex items-start gap-2">
            {attendanceResult.accepted ? (
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <CircleAlert
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
            )}

            <div className="min-w-0">
              <p className="text-sm font-semibold">
                {attendanceResult.accepted
                  ? `${attendanceResult.attendanceType} diterima`
                  : `${attendanceResult.attendanceType} ditolak`}
              </p>
              <p className="mt-1 text-xs leading-5">
                {attendanceResult.message}
              </p>
            </div>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-background/70 p-2">
              <dt className="text-muted-foreground">
                Akurasi GPS
              </dt>
              <dd className="mt-1 font-medium text-foreground">
                {formatAccuracy(
                  attendanceResult.accuracyMeters,
                )}
              </dd>
            </div>

            <div className="rounded bg-background/70 p-2">
              <dt className="text-muted-foreground">
                Jarak kantor
              </dt>
              <dd className="mt-1 font-medium text-foreground">
                {attendanceResult.distanceMeters ===
                null
                  ? "Lihat keterangan"
                  : formatDistance(
                      attendanceResult.distanceMeters,
                    )}
              </dd>
            </div>

            {attendanceResult.accepted ? (
              <div className="col-span-2 rounded bg-background/70 p-2">
                <dt className="text-muted-foreground">
                  Waktu presensi
                </dt>
                <dd className="mt-1 font-medium text-foreground">
                  {formatAttendanceTime(
                    attendanceResult.attendanceTime,
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
      ) : null}

      {phase === "scanning" ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={stopScannerByUser}
        >
          <CameraOff
            className="size-4"
            aria-hidden="true"
          />
          Batalkan pemindaian
        </Button>
      ) : phase === "preparing" ||
        phase === "submitting" ? (
        <Button
          type="button"
          className="w-full"
          disabled
        >
          <LoaderCircle
            className="size-4 animate-spin"
            aria-hidden="true"
          />
          {phase === "preparing"
            ? "Menyiapkan kamera..."
            : "Memvalidasi presensi..."}
        </Button>
      ) : (
        <Button
          type="button"
          className="w-full"
          onClick={() =>
            void startScanner()
          }
        >
          {phase === "accepted" ||
          phase === "rejected" ||
          phase === "error" ? (
            <RefreshCw
              className="size-4"
              aria-hidden="true"
            />
          ) : (
            <Camera
              className="size-4"
              aria-hidden="true"
            />
          )}
          {phase === "accepted" ||
          phase === "rejected" ||
          phase === "error"
            ? "Pindai ulang"
            : "Aktifkan lokasi dan pindai QR"}
        </Button>
      )}

      <p className="text-[11px] leading-4 text-muted-foreground">
        PWA hanya digunakan untuk presensi. Fitur
        realtime tracking dan navigasi tersedia pada
        aplikasi Android Native.
      </p>
    </section>
  );
}
