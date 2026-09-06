"use client";

import {
  CircleAlert,
  LoaderCircle,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UsersRound,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import {
  TechnicianForm,
  type EditableTechnician,
  type TechnicianFormPayload,
} from "@/components/teknisi/technician-form";
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/src/utils/supabase";

const WIB_TIME_ZONE = "Asia/Jakarta";

type TechnicianAccessPlatform =
  | "ANDROID_NATIVE"
  | "WEB_PWA"
  | "UNBOUND";

type Technician = {
  id: string;
  nama_lengkap: string;
  nik: string;
  android_device_id: string | null;
  created_at: string | null;
  access_platform: TechnicianAccessPlatform;
  pwa_last_login_at: string | null;
  pwa_last_seen_at: string | null;
};

type TechnicianDatabaseRow = {
  id: string | number;
  nama_lengkap: string;
  nik: string;
  android_device_id: string | null;
  created_at: string | null;
  access_platform: string | null;
  pwa_last_login_at: string | null;
  pwa_last_seen_at: string | null;
};

function normalizeOptionalText(
  value: unknown,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();

  return normalized ? normalized : null;
}

function normalizeAccessPlatform(
  value: unknown,
): TechnicianAccessPlatform {
  if (value === "ANDROID_NATIVE") {
    return "ANDROID_NATIVE";
  }

  if (value === "WEB_PWA") {
    return "WEB_PWA";
  }

  return "UNBOUND";
}

function getInitials(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) =>
      word.charAt(0).toUpperCase(),
    )
    .join("");

  return initials || "TK";
}

function formatDate(
  isoDate: string | null,
): string {
  if (!isoDate) {
    return "-";
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(
  isoDate: string | null,
): string {
  if (!isoDate) {
    return "-";
  }

  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB_TIME_ZONE,
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getPlatformLabel(
  platform: TechnicianAccessPlatform,
): string {
  if (platform === "ANDROID_NATIVE") {
    return "Android terikat";
  }

  if (platform === "WEB_PWA") {
    return "PWA aktif";
  }

  return "Belum terhubung";
}

export default function TechniciansPage() {
  const [technicians, setTechnicians] =
    useState<Technician[]>([]);

  const [
    editingTechnician,
    setEditingTechnician,
  ] = useState<EditableTechnician | null>(
    null,
  );

  const [deleteTarget, setDeleteTarget] =
    useState<Technician | null>(null);

  const [searchQuery, setSearchQuery] =
    useState("");

  const [isFetching, setIsFetching] =
    useState(true);

  const [isSaving, setIsSaving] =
    useState(false);

  const [isDeleting, setIsDeleting] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string | null>(null);

  const fetchTechnicians = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsFetching(true);
      }

      setErrorMessage(null);

      try {
        const { data, error } =
          await supabase.rpc(
            "admin_get_technicians_with_device_status",
          );

        if (error) {
          throw error;
        }

        const normalizedTechnicians = (
          (data ?? []) as unknown as TechnicianDatabaseRow[]
        ).map((technician) => ({
          id: String(technician.id),

          nama_lengkap:
            normalizeOptionalText(
              technician.nama_lengkap,
            ) ?? "Teknisi",

          nik:
            normalizeOptionalText(
              technician.nik,
            ) ?? "-",

          android_device_id:
            normalizeOptionalText(
              technician.android_device_id,
            ),

          created_at:
            normalizeOptionalText(
              technician.created_at,
            ),

          access_platform:
            normalizeAccessPlatform(
              technician.access_platform,
            ),

          pwa_last_login_at:
            normalizeOptionalText(
              technician.pwa_last_login_at,
            ),

          pwa_last_seen_at:
            normalizeOptionalText(
              technician.pwa_last_seen_at,
            ),
        }));

        setTechnicians(
          normalizedTechnicians,
        );
      } catch (error) {
        console.error(
          "Gagal memuat status perangkat teknisi:",
          error,
        );

        setErrorMessage(
          "Data teknisi dan status perangkat tidak dapat dimuat. Periksa sesi administrator lalu coba kembali.",
        );
      } finally {
        if (showLoading) {
          setIsFetching(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchTechnicians();
  }, [fetchTechnicians]);

  const filteredTechnicians = useMemo(
    () => {
      const normalizedQuery = searchQuery
        .trim()
        .toLocaleLowerCase("id-ID");

      if (!normalizedQuery) {
        return technicians;
      }

      return technicians.filter(
        (technician) =>
          technician.nama_lengkap
            .toLocaleLowerCase("id-ID")
            .includes(normalizedQuery) ||
          technician.nik
            .toLocaleLowerCase("id-ID")
            .includes(normalizedQuery) ||
          getPlatformLabel(
            technician.access_platform,
          )
            .toLocaleLowerCase("id-ID")
            .includes(normalizedQuery),
      );
    },
    [searchQuery, technicians],
  );

  const connectedTechnicians =
    technicians.filter(
      (technician) =>
        technician.access_platform !==
        "UNBOUND",
    ).length;

  const androidTechnicians =
    technicians.filter(
      (technician) =>
        technician.access_platform ===
        "ANDROID_NATIVE",
    ).length;

  const pwaTechnicians =
    technicians.filter(
      (technician) =>
        technician.access_platform ===
        "WEB_PWA",
    ).length;

  const handleSaveTechnician = async (
    payload: TechnicianFormPayload,
  ): Promise<boolean> => {
    setIsSaving(true);

    try {
      if (payload.id) {
        const updatePayload: {
          nama_lengkap: string;
          nik: string;
          password?: string;
        } = {
          nama_lengkap:
            payload.nama_lengkap,
          nik: payload.nik,
        };

        if (payload.password) {
          updatePayload.password =
            payload.password;
        }

        const { error } = await supabase
          .from("teknisi")
          .update(updatePayload)
          .eq("id", payload.id);

        if (error) {
          throw error;
        }

        toast.success(
          "Data teknisi diperbarui.",
        );
      } else {
        if (!payload.password) {
          toast.error(
            "Password teknisi wajib diisi.",
          );

          return false;
        }

        const { error } = await supabase
          .from("teknisi")
          .insert([
            {
              nama_lengkap:
                payload.nama_lengkap,
              nik: payload.nik,
              password:
                payload.password,
            },
          ]);

        if (error) {
          throw error;
        }

        toast.success(
          "Teknisi berhasil didaftarkan.",
        );
      }

      setEditingTechnician(null);
      await fetchTechnicians(false);

      return true;
    } catch (error) {
      console.error(
        "Gagal menyimpan teknisi:",
        error,
      );

      toast.error(
        "Data teknisi gagal disimpan.",
        {
          description:
            "Pastikan NIK belum digunakan dan koneksi database tersedia.",
        },
      );

      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (
    technician: Technician,
  ) => {
    setEditingTechnician({
      id: technician.id,
      nama_lengkap:
        technician.nama_lengkap,
      nik: technician.nik,
    });

    window.requestAnimationFrame(() => {
      document
        .getElementById("technician-form")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
    });
  };

  const handleDelete =
    async (): Promise<void> => {
      if (!deleteTarget) {
        return;
      }

      setIsDeleting(true);

      try {
        const { error } = await supabase
          .from("teknisi")
          .delete()
          .eq("id", deleteTarget.id);

        if (error) {
          throw error;
        }

        setTechnicians(
          (currentTechnicians) =>
            currentTechnicians.filter(
              (technician) =>
                technician.id !==
                deleteTarget.id,
            ),
        );

        if (
          editingTechnician?.id ===
          deleteTarget.id
        ) {
          setEditingTechnician(null);
        }

        toast.success(
          "Teknisi berhasil dihapus.",
        );

        setDeleteTarget(null);
      } catch (error) {
        console.error(
          "Gagal menghapus teknisi:",
          error,
        );

        toast.error(
          "Teknisi gagal dihapus.",
          {
            description:
              "Teknisi mungkin masih memiliki data presensi atau penugasan yang terhubung.",
          },
        );
      } finally {
        setIsDeleting(false);
      }
    };

  return (
    <div className="page-container space-y-5">
      <PageHeader
        title="Manajemen Teknisi"
        description="Kelola identitas, kredensial, dan status akses perangkat teknisi lapangan."
        actions={
          <>
            <Badge variant="success">
              <UsersRound aria-hidden="true" />
              {connectedTechnicians} akun
              terhubung
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                void fetchTechnicians()
              }
              disabled={isFetching}
            >
              <RefreshCw
                className={
                  isFetching
                    ? "animate-spin"
                    : undefined
                }
                aria-hidden="true"
              />
              Segarkan
            </Button>
          </>
        }
      />

      {errorMessage ? (
        <div
          role="alert"
          className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3"
        >
          <CircleAlert
            className="size-4 shrink-0 text-destructive"
            aria-hidden="true"
          />

          <p className="text-sm text-destructive">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>
              Total teknisi
            </CardDescription>

            <CardTitle className="text-2xl">
              {technicians.length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>
              Android terikat
            </CardDescription>

            <CardTitle className="text-2xl">
              {androidTechnicians}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription>
              PWA aktif
            </CardDescription>

            <CardTitle className="text-2xl">
              {pwaTechnicians}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-20">
          <TechnicianForm
            key={
              editingTechnician?.id ??
              "new-technician"
            }
            technician={
              editingTechnician
            }
            isSaving={isSaving}
            onSubmit={
              handleSaveTechnician
            }
            onCancel={() =>
              setEditingTechnician(null)
            }
          />
        </div>

        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>
              Teknisi terdaftar
            </CardTitle>

            <CardDescription>
              Daftar teknisi beserta platform
              perangkat yang sedang terhubung.
            </CardDescription>

            <CardAction>
              <Badge variant="neutral">
                {technicians.length} data
              </Badge>
            </CardAction>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="relative max-w-sm">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />

              <Input
                type="search"
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                className="pl-8"
                placeholder="Cari nama, NIK, atau platform..."
                aria-label="Cari teknisi"
              />
            </div>

            <div className="overflow-hidden rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      Teknisi
                    </TableHead>

                    <TableHead>
                      NIK
                    </TableHead>

                    <TableHead>
                      Akses perangkat
                    </TableHead>

                    <TableHead>
                      Terdaftar
                    </TableHead>

                    <TableHead className="w-28 text-right">
                      Aksi
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {isFetching ? (
                    Array.from({
                      length: 6,
                    }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="size-8 rounded-full" />
                            <Skeleton className="h-4 w-28" />
                          </div>
                        </TableCell>

                        <TableCell>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>

                        <TableCell>
                          <Skeleton className="h-5 w-24 rounded-full" />
                        </TableCell>

                        <TableCell>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>

                        <TableCell>
                          <Skeleton className="ml-auto h-8 w-18" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : filteredTechnicians.length ===
                    0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={5}
                        className="h-32 text-center text-sm text-muted-foreground"
                      >
                        {searchQuery
                          ? "Tidak ada teknisi yang sesuai dengan pencarian."
                          : "Belum ada teknisi terdaftar."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredTechnicians.map(
                      (technician) => (
                        <TableRow
                          key={technician.id}
                        >
                          <TableCell>
                            <div className="flex min-w-0 items-center gap-3">
                              <Avatar className="size-8">
                                <AvatarFallback>
                                  {getInitials(
                                    technician.nama_lengkap,
                                  )}
                                </AvatarFallback>
                              </Avatar>

                              <span className="max-w-44 truncate text-sm font-medium text-foreground">
                                {
                                  technician.nama_lengkap
                                }
                              </span>
                            </div>
                          </TableCell>

                          <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                            {technician.nik}
                          </TableCell>

                          <TableCell>
                            <div className="space-y-1">
                              <Badge
                                variant={
                                  technician.access_platform ===
                                  "UNBOUND"
                                    ? "warning"
                                    : "success"
                                }
                              >
                                {getPlatformLabel(
                                  technician.access_platform,
                                )}
                              </Badge>

                              {technician.access_platform ===
                                "WEB_PWA" &&
                              technician.pwa_last_seen_at ? (
                                <p className="text-[11px] text-muted-foreground">
                                  Aktivitas{" "}
                                  {formatDateTime(
                                    technician.pwa_last_seen_at,
                                  )}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>

                          <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                            {formatDate(
                              technician.created_at,
                            )}
                          </TableCell>

                          <TableCell>
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() =>
                                  handleEdit(
                                    technician,
                                  )
                                }
                                aria-label={`Edit ${technician.nama_lengkap}`}
                                title="Edit teknisi"
                              >
                                <Pencil aria-hidden="true" />
                              </Button>

                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                onClick={() =>
                                  setDeleteTarget(
                                    technician,
                                  )
                                }
                                aria-label={`Hapus ${technician.nama_lengkap}`}
                                title="Hapus teknisi"
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ),
                    )
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setDeleteTarget(null);
          }
        }}
      >
        <DialogContent
          showCloseButton={!isDeleting}
          className="max-w-md"
        >
          <DialogHeader>
            <div className="mb-2 flex size-9 items-center justify-center rounded-md bg-destructive/10 text-destructive">
              <Trash2
                className="size-4"
                aria-hidden="true"
              />
            </div>

            <DialogTitle>
              Hapus teknisi?
            </DialogTitle>

            <DialogDescription>
              Data{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.nama_lengkap}
              </span>{" "}
              akan dihapus permanen. Operasi dapat
              gagal jika teknisi masih memiliki
              presensi atau penugasan yang
              terhubung.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setDeleteTarget(null)
              }
              disabled={isDeleting}
            >
              Batal
            </Button>

            <Button
              variant="destructive"
              onClick={() =>
                void handleDelete()
              }
              disabled={isDeleting}
            >
              {isDeleting ? (
                <LoaderCircle
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 aria-hidden="true" />
              )}

              {isDeleting
                ? "Menghapus..."
                : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}