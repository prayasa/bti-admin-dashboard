"use client";

import {
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  CheckCircle2,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
  Smartphone,
} from "lucide-react";

import { StaffAttendancePanel } from "@/components/staff/staff-attendance-panel";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/src/utils/supabase";

const DEVICE_STORAGE_KEY =
  "bti_staff_pwa_browser_device_id";

const SESSION_STORAGE_KEY =
  "bti_staff_pwa_session";

type ScreenState =
  | "loading"
  | "signed_out"
  | "signed_in";

interface StaffWebSession {
  technicianId: string;
  technicianName: string;
  nik: string;
  browserDeviceId: string;
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

function createBrowserDeviceId() {
  if (
    typeof globalThis.crypto?.randomUUID ===
    "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  const randomBytes = new Uint8Array(24);

  globalThis.crypto.getRandomValues(randomBytes);

  return Array.from(randomBytes)
    .map((value) =>
      value.toString(16).padStart(2, "0"),
    )
    .join("");
}

function getOrCreateBrowserDeviceId() {
  const storedDeviceId = normalizeText(
    window.localStorage.getItem(
      DEVICE_STORAGE_KEY,
    ),
  );

  if (
    storedDeviceId.length >= 16 &&
    storedDeviceId.length <= 200
  ) {
    return storedDeviceId;
  }

  const newDeviceId = createBrowserDeviceId();

  window.localStorage.setItem(
    DEVICE_STORAGE_KEY,
    newDeviceId,
  );

  return newDeviceId;
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

function parseStaffSession(
  data: unknown,
  browserDeviceId: string,
): StaffWebSession | null {
  const record = parseRpcRecord(data);

  if (!record) {
    return null;
  }

  const technicianId = normalizeText(record.id);
  const technicianName = normalizeText(
    record.nama_lengkap,
  );
  const nik = normalizeText(record.nik);
  const returnedDeviceId = normalizeText(
    record.browser_device_id,
  );

  if (
    !technicianId ||
    !technicianName ||
    !nik ||
    record.device_verified === false
  ) {
    return null;
  }

  return {
    technicianId,
    technicianName,
    nik,
    browserDeviceId:
      returnedDeviceId || browserDeviceId,
  };
}

function readStoredSession(): StaffWebSession | null {
  try {
    const rawSession =
      window.localStorage.getItem(
        SESSION_STORAGE_KEY,
      );

    if (!rawSession) {
      return null;
    }

    const parsedSession: unknown =
      JSON.parse(rawSession);

    if (!isRecord(parsedSession)) {
      return null;
    }

    const technicianId = normalizeText(
      parsedSession.technicianId,
    );
    const technicianName = normalizeText(
      parsedSession.technicianName,
    );
    const nik = normalizeText(
      parsedSession.nik,
    );
    const browserDeviceId = normalizeText(
      parsedSession.browserDeviceId,
    );

    if (
      !technicianId ||
      !technicianName ||
      !nik ||
      browserDeviceId.length < 16 ||
      browserDeviceId.length > 200
    ) {
      return null;
    }

    return {
      technicianId,
      technicianName,
      nik,
      browserDeviceId,
    };
  } catch {
    return null;
  }
}

function saveSession(session: StaffWebSession) {
  window.localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify(session),
  );
}

function clearSession() {
  window.localStorage.removeItem(
    SESSION_STORAGE_KEY,
  );
}

function formatNikInput(value: string) {
  const digits = value
    .replace(/[^0-9]/g, "")
    .slice(0, 6);

  if (digits.length <= 4) {
    return `BTI-${digits}`;
  }

  return `BTI-${digits.slice(
    0,
    4,
  )}-${digits.slice(4)}`;
}

function getLoginErrorMessage(error: unknown) {
  const errorMessage = getErrorMessage(error);

  let serializedError = "";

  try {
    serializedError = JSON.stringify(error);
  } catch {
    serializedError = "";
  }

  const normalizedMessage =
    `${errorMessage} ${serializedError}`
      .toLowerCase();

  const errorCode = isRecord(error)
    ? normalizeText(error.code).toUpperCase()
    : "";

  if (
    normalizedMessage.includes(
      "identitas browser",
    )
  ) {
    return "Identitas browser tidak valid. Hapus data situs lalu coba kembali.";
  }

  if (
    normalizedMessage.includes(
      "aplikasi android native",
    ) ||
    normalizedMessage.includes(
      "terdaftar untuk aplikasi android",
    )
  ) {
    return "Akun ini telah terikat pada aplikasi Android Native. Gunakan aplikasi Android atau hubungi administrator untuk mereset perangkat.";
  }

  if (
    normalizedMessage.includes(
      "terlalu banyak",
    )
  ) {
    return "Terlalu banyak percobaan. Tunggu beberapa saat lalu coba kembali.";
  }

  if (
    normalizedMessage.includes(
      "nik atau password salah",
    ) ||
    errorCode === "P0001"
  ) {
    return "NIK atau password salah.";
  }

  /*
   * staff_web_login hanya mengembalikan error RPC ketika
   * kredensial atau identitas browser ditolak server.
   * Gangguan jaringan masuk ke blok catch terpisah.
   */
  return "NIK atau password salah.";
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

function getInitials(name: string) {
  const nameParts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (nameParts.length === 0) {
    return "BT";
  }

  if (nameParts.length === 1) {
    return nameParts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    nameParts[0].charAt(0) +
    nameParts[nameParts.length - 1].charAt(0)
  ).toUpperCase();
}

export function StaffPwaApp() {
  const [screenState, setScreenState] =
    useState<ScreenState>("loading");

  const [session, setSession] =
    useState<StaffWebSession | null>(null);

  const [nik, setNik] = useState("BTI-");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [statusMessage, setStatusMessage] =
    useState("");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  useEffect(() => {
    let active = true;

    const restoreSession = async () => {
      await Promise.resolve();

      const storedSession = readStoredSession();

      if (!storedSession) {
        clearSession();

        if (active) {
          setScreenState("signed_out");
        }

        return;
      }

      const { data, error } = await supabase.rpc(
        "staff_web_get_session",
        {
          p_technician_id:
            storedSession.technicianId,
          p_browser_device_id:
            storedSession.browserDeviceId,
        },
      );

      if (!active) {
        return;
      }

      if (error) {
        clearSession();
        setSession(null);
        setErrorMessage(
          "Sesi PWA sudah tidak aktif. Silakan login kembali.",
        );
        setScreenState("signed_out");
        return;
      }

      const validatedSession =
        parseStaffSession(
          data,
          storedSession.browserDeviceId,
        );

      if (!validatedSession) {
        clearSession();
        setSession(null);
        setErrorMessage(
          "Respons sesi tidak valid. Silakan login kembali.",
        );
        setScreenState("signed_out");
        return;
      }

      saveSession(validatedSession);
      setSession(validatedSession);
      setNik(validatedSession.nik);
      setScreenState("signed_in");
    };

    void restoreSession();

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedNik =
      nik.trim().toUpperCase();

    if (
      !/^BTI-[0-9]{4}-[0-9]{2}$/.test(
        normalizedNik,
      )
    ) {
      setErrorMessage(
        "Gunakan format NIK BTI-YYYY-MM.",
      );
      return;
    }

    if (!password) {
      setErrorMessage(
        "Password wajib diisi.",
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    try {
      const browserDeviceId =
        getOrCreateBrowserDeviceId();

      const { data, error } =
        await supabase.rpc(
          "staff_web_login",
          {
            p_nik: normalizedNik,
            p_password: password,
            p_browser_device_id:
              browserDeviceId,
          },
        );

      if (error) {
        console.warn(
          "RPC staff_web_login ditolak:",
          getSafeErrorDiagnostic(error),
        );

        setErrorMessage(
          getLoginErrorMessage(error),
        );
        return;
      }

      const authenticatedSession =
        parseStaffSession(
          data,
          browserDeviceId,
        );

      if (!authenticatedSession) {
        throw new Error(
          "Respons login PWA tidak valid.",
        );
      }

      saveSession(authenticatedSession);
      setSession(authenticatedSession);
      setNik(authenticatedSession.nik);
      setPassword("");
      setStatusMessage(
        "Login PWA berhasil.",
      );
      setScreenState("signed_in");
    } catch (error) {
      console.error(
        "Login PWA mengalami gangguan:",
        getSafeErrorDiagnostic(error),
      );

      setErrorMessage(
        "Login belum dapat diproses. Periksa koneksi lalu coba kembali.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = async () => {
    if (!session || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setStatusMessage("");

    const { error } = await supabase.rpc(
      "staff_web_logout",
      {
        p_technician_id:
          session.technicianId,
        p_browser_device_id:
          session.browserDeviceId,
      },
    );

    clearSession();
    setSession(null);
    setPassword("");
    setScreenState("signed_out");
    setIsSubmitting(false);

    if (error) {
      setErrorMessage(
        "Sesi lokal telah dihapus, tetapi server belum dapat dihubungi.",
      );
      return;
    }

    setStatusMessage(
      "Anda telah keluar dari BTI Staff.",
    );
  };

  const handleSessionInvalid = (
    message: string,
  ) => {
    clearSession();
    setSession(null);
    setPassword("");
    setStatusMessage("");
    setErrorMessage(message);
    setScreenState("signed_out");
  };

  if (screenState === "loading") {
    return (
      <StaffPageContainer>
        <Card>
          <CardContent className="flex min-h-64 flex-col items-center justify-center gap-3">
            <LoaderCircle
              className="size-7 animate-spin text-primary"
              aria-hidden="true"
            />
            <p className="text-sm font-medium">
              Memeriksa sesi perangkat
            </p>
            <p className="text-center text-xs text-muted-foreground">
              BTI Staff sedang memverifikasi akses.
            </p>
          </CardContent>
        </Card>
      </StaffPageContainer>
    );
  }

  if (
    screenState === "signed_in" &&
    session
  ) {
    return (
      <StaffPageContainer>
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {getInitials(
                    session.technicianName,
                  )}
                </div>

                <div className="min-w-0">
                  <CardTitle className="truncate text-base">
                    {session.technicianName}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {session.nik}
                  </CardDescription>
                </div>
              </div>

              <Badge variant="success">
                Terverifikasi
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success-muted p-3 text-success-muted-foreground">
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium">
                  Sesi PWA aktif
                </p>
                <p className="mt-1 text-xs leading-5">
                  Perangkat ini tetap login hingga Anda
                  memilih logout.
                </p>
              </div>
            </div>

            {statusMessage ? (
              <div
                className="rounded-lg border border-info/20 bg-info-muted px-3 py-2 text-xs text-info-muted-foreground"
                role="status"
              >
                {statusMessage}
              </div>
            ) : null}

            <StaffAttendancePanel
              technicianId={session.technicianId}
              browserDeviceId={
                session.browserDeviceId
              }
              onSessionInvalid={
                handleSessionInvalid
              }
            />

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() =>
                void handleLogout()
              }
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogOut
                  className="size-4"
                  aria-hidden="true"
                />
              )}

              {isSubmitting
                ? "Mengakhiri sesi..."
                : "Logout"}
            </Button>
          </CardContent>
        </Card>
      </StaffPageContainer>
    );
  }

  return (
    <StaffPageContainer>
      <Card>
        <CardHeader>
          <div className="mb-2 flex size-11 items-center justify-center rounded-xl border border-border bg-muted">
            <LockKeyhole
              className="size-5 text-primary"
              aria-hidden="true"
            />
          </div>

          <CardTitle>
            Login teknisi
          </CardTitle>

          <CardDescription className="leading-6">
            Gunakan NIK dan password teknisi BTI.
            Login ini khusus presensi melalui perangkat
            iOS atau browser mobile.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form
            onSubmit={handleLogin}
            className="space-y-5"
            noValidate
          >
            <div className="space-y-2">
              <Label htmlFor="staff-nik">
                NIK teknisi
              </Label>

              <Input
                id="staff-nik"
                type="text"
                value={nik}
                onChange={(event) => {
                  setNik(
                    formatNikInput(
                      event.target.value,
                    ),
                  );
                  setErrorMessage("");
                }}
                placeholder="BTI-2026-08"
                autoComplete="username"
                inputMode="numeric"
                disabled={isSubmitting}
                required
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-password">
                Password
              </Label>

              <div className="relative">
                <Input
                  id="staff-password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  value={password}
                  onChange={(event) => {
                    setPassword(
                      event.target.value,
                    );
                    setErrorMessage("");
                  }}
                  placeholder="Masukkan password"
                  autoComplete="current-password"
                  className="pr-11"
                  disabled={isSubmitting}
                  required
                />

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 size-8 -translate-y-1/2"
                  onClick={() =>
                    setShowPassword(
                      (currentValue) =>
                        !currentValue,
                    )
                  }
                  disabled={isSubmitting}
                  aria-label={
                    showPassword
                      ? "Sembunyikan password"
                      : "Tampilkan password"
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      className="size-4"
                      aria-hidden="true"
                    />
                  ) : (
                    <Eye
                      className="size-4"
                      aria-hidden="true"
                    />
                  )}
                </Button>
              </div>
            </div>

            {errorMessage ? (
              <div
                className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm leading-5 text-destructive"
                role="alert"
                aria-live="polite"
              >
                {errorMessage}
              </div>
            ) : null}

            {statusMessage ? (
              <div
                className="rounded-lg border border-info/20 bg-info-muted px-3 py-2 text-sm text-info-muted-foreground"
                role="status"
              >
                {statusMessage}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <LogIn
                  className="size-4"
                  aria-hidden="true"
                />
              )}

              {isSubmitting
                ? "Memverifikasi..."
                : "Masuk ke BTI Staff"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <MapPin
            className="size-4 text-primary"
            aria-hidden="true"
          />
          <p className="mt-2 text-xs font-medium">
            Geofence kantor
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Lokasi diperiksa server.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-3">
          <ShieldCheck
            className="size-4 text-primary"
            aria-hidden="true"
          />
          <p className="mt-2 text-xs font-medium">
            Perangkat terdaftar
          </p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Sesi browser diverifikasi.
          </p>
        </div>
      </div>
    </StaffPageContainer>
  );
}

interface StaffPageContainerProps {
  children: ReactNode;
}

function StaffPageContainer({
  children,
}: StaffPageContainerProps) {
  return (
    <main className="min-h-svh bg-muted/30 px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Smartphone
                className="size-5"
                aria-hidden="true"
              />
            </div>

            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                BTI Staff
              </p>
              <p className="truncate text-xs text-muted-foreground">
                Presensi teknisi
              </p>
            </div>
          </div>

          <Badge variant="outline">
            Web iOS
          </Badge>
        </header>

        {children}

        <p className="text-center text-[11px] text-muted-foreground">
          CV Bengkel Teknologi Indonesia
        </p>
      </div>
    </main>
  );
}
