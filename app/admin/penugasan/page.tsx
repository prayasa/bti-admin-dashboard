"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  CircleAlert,
  Clock3,
  LoaderCircle,
  MapPin,
  Pencil,
  RefreshCw,
  Search,
  Tickets,
  Trash2,
  UserRoundCheck,
} from "lucide-react";
import { toast } from "sonner";

import {
  AssignmentForm,
  type AssignmentPayload,
  type AssignmentTechnician,
  type EditableAssignment,
} from "@/components/penugasan/assignment-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface TechnicianDatabaseRow {
  id: string;
  nama_lengkap: string;
}

interface TechnicianRelation {
  nama_lengkap: string;
}

interface AssignmentDatabaseRow {
  id_tugas: string;
  id_teknisi: string;
  nama_klien: string;
  alamat_klien: string;
  latitude_klien: number | string;
  longitude_klien: number | string;
  status: string | null;
  created_at: string | null;
  teknisi: TechnicianRelation | TechnicianRelation[] | null;
}

interface Assignment extends EditableAssignment {
  technicianName: string;
  status: string;
  createdAt: string | null;
}

type StatusFilter =
  | "all"
  | "Pending"
  | "On Process"
  | "Success";

function getTechnicianName(
  relation: AssignmentDatabaseRow["teknisi"],
) {
  if (Array.isArray(relation)) {
    return relation[0]?.nama_lengkap ?? "Teknisi tidak tersedia";
  }

  return relation?.nama_lengkap ?? "Teknisi tidak tersedia";
}

function formatDateTime(value: string | null) {
  if (!value) {
    return "Waktu tidak tersedia";
  }

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

function getStatusLabel(status: string) {
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

function getStatusClassName(status: string) {
  switch (status) {
    case "Pending":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300";
    case "On Process":
      return "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-300";
    case "Success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

export default function AssignmentManagementPage() {
  const [assignments, setAssignments] = useState<Assignment[]>(
    [],
  );
  const [technicians, setTechnicians] = useState<
    AssignmentTechnician[]
  >([]);
  const [editingAssignment, setEditingAssignment] =
    useState<Assignment | null>(null);
  const [assignmentToDelete, setAssignmentToDelete] =
    useState<Assignment | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<StatusFilter>("all");
  const [isFetching, setIsFetching] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formRevision, setFormRevision] = useState(0);

  const fetchData = useCallback(
    async (showLoading = true) => {
      if (showLoading) {
        setIsFetching(true);
      }

      const [techniciansResult, assignmentsResult] =
        await Promise.all([
          supabase
            .from("teknisi")
            .select("id, nama_lengkap")
            .order("nama_lengkap", { ascending: true }),
          supabase
            .from("tiket_tugas")
            .select(
              `
                id_tugas,
                id_teknisi,
                nama_klien,
                alamat_klien,
                latitude_klien,
                longitude_klien,
                status,
                created_at,
                teknisi (nama_lengkap)
              `,
            )
            .order("created_at", { ascending: false }),
        ]);

      if (techniciansResult.error) {
        console.error(
          "Gagal mengambil teknisi:",
          techniciansResult.error,
        );
        toast.error("Daftar teknisi gagal dimuat.");
      } else {
        const rows =
          (techniciansResult.data as
            | TechnicianDatabaseRow[]
            | null) ?? [];

        setTechnicians(
          rows.map((technician) => ({
            id: technician.id,
            name: technician.nama_lengkap,
          })),
        );
      }

      if (assignmentsResult.error) {
        console.error(
          "Gagal mengambil penugasan:",
          assignmentsResult.error,
        );
        toast.error("Daftar penugasan gagal dimuat.");
      } else {
        const rows =
          (assignmentsResult.data as
            | AssignmentDatabaseRow[]
            | null) ?? [];

        setAssignments(
          rows.map((assignment) => ({
            id: assignment.id_tugas,
            technicianId: assignment.id_teknisi,
            technicianName: getTechnicianName(
              assignment.teknisi,
            ),
            clientName: assignment.nama_klien,
            clientAddress: assignment.alamat_klien,
            latitude: Number(assignment.latitude_klien),
            longitude: Number(assignment.longitude_klien),
            status: assignment.status ?? "Pending",
            createdAt: assignment.created_at,
          })),
        );
      }

      setIsFetching(false);
    },
    [],
  );

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const filteredAssignments = useMemo(() => {
    const normalizedQuery = searchQuery
      .trim()
      .toLocaleLowerCase("id-ID");

    return assignments.filter((assignment) => {
      const matchesStatus =
        statusFilter === "all" ||
        assignment.status === statusFilter;

      const matchesSearch =
        !normalizedQuery ||
        assignment.clientName
          .toLocaleLowerCase("id-ID")
          .includes(normalizedQuery) ||
        assignment.clientAddress
          .toLocaleLowerCase("id-ID")
          .includes(normalizedQuery) ||
        assignment.technicianName
          .toLocaleLowerCase("id-ID")
          .includes(normalizedQuery);

      return matchesStatus && matchesSearch;
    });
  }, [assignments, searchQuery, statusFilter]);

  const summary = useMemo(
    () => ({
      total: assignments.length,
      pending: assignments.filter(
        (assignment) => assignment.status === "Pending",
      ).length,
      active: assignments.filter(
        (assignment) => assignment.status === "On Process",
      ).length,
    }),
    [assignments],
  );

  const handleSaveAssignment = async (
    payload: AssignmentPayload,
  ) => {
    if (
      editingAssignment &&
      editingAssignment.status !== "Pending"
    ) {
      toast.error("Tiket tidak dapat diubah.", {
        description:
          "Hanya tiket berstatus Menunggu yang dapat diedit.",
      });

      setEditingAssignment(null);
      setFormRevision((revision) => revision + 1);
      await fetchData(false);
      return;
    }

    setIsSaving(true);

    const databasePayload = {
      id_teknisi: payload.technicianId,
      nama_klien: payload.clientName,
      alamat_klien: payload.clientAddress,
      latitude_klien: payload.latitude,
      longitude_klien: payload.longitude,
    };

    const result = editingAssignment
      ? await supabase
          .from("tiket_tugas")
          .update(databasePayload)
          .eq("id_tugas", editingAssignment.id)
          .eq("status", "Pending")
          .select("id_tugas")
          .maybeSingle()
      : await supabase
          .from("tiket_tugas")
          .insert([databasePayload])
          .select("id_tugas")
          .single();

    if (result.error) {
      console.error("Gagal menyimpan penugasan:", result.error);
      toast.error(
        editingAssignment
          ? "Perubahan tiket gagal disimpan."
          : "Tiket penugasan gagal dibuat.",
        {
          description: result.error.message,
        },
      );

      setIsSaving(false);
      return;
    }

    if (!result.data) {
      toast.error("Tiket tidak lagi dapat diubah.", {
        description:
          "Status tiket telah berubah. Muat ulang data sebelum melanjutkan.",
      });

      setEditingAssignment(null);
      setFormRevision((revision) => revision + 1);
      await fetchData(false);
      setIsSaving(false);
      return;
    }

    toast.success(
      editingAssignment
        ? "Tiket penugasan diperbarui."
        : "Tiket penugasan berhasil diterbitkan.",
    );

    setEditingAssignment(null);
    setFormRevision((revision) => revision + 1);

    await fetchData(false);
    setIsSaving(false);
  };

  const handleEdit = (assignment: Assignment) => {
    if (assignment.status !== "Pending") {
      toast.error("Tiket tidak dapat diubah.", {
        description:
          "Tiket yang sedang diproses atau sudah selesai dikunci untuk menjaga konsistensi penugasan.",
      });
      return;
    }

    setEditingAssignment(assignment);
    setFormRevision((revision) => revision + 1);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const handleCancelEdit = () => {
    setEditingAssignment(null);
    setFormRevision((revision) => revision + 1);
  };

  const handleDelete = async () => {
    if (!assignmentToDelete) {
      return;
    }

    if (assignmentToDelete.status !== "Pending") {
      toast.error("Tiket tidak dapat dihapus.", {
        description:
          "Hanya tiket berstatus Menunggu yang dapat dihapus.",
      });

      setAssignmentToDelete(null);
      await fetchData(false);
      return;
    }

    setIsDeleting(true);

    const { data, error } = await supabase
      .from("tiket_tugas")
      .delete()
      .eq("id_tugas", assignmentToDelete.id)
      .eq("status", "Pending")
      .select("id_tugas")
      .maybeSingle();

    if (error) {
      console.error("Gagal menghapus penugasan:", error);
      toast.error("Tiket penugasan gagal dihapus.", {
        description: error.message,
      });

      setIsDeleting(false);
      return;
    }

    if (!data) {
      toast.error("Tiket tidak lagi dapat dihapus.", {
        description:
          "Status tiket telah berubah. Data akan dimuat ulang.",
      });

      setAssignmentToDelete(null);
      await fetchData(false);
      setIsDeleting(false);
      return;
    }

    if (editingAssignment?.id === assignmentToDelete.id) {
      setEditingAssignment(null);
      setFormRevision((revision) => revision + 1);
    }

    toast.success("Tiket penugasan telah dihapus.");

    setAssignmentToDelete(null);
    await fetchData(false);
    setIsDeleting(false);
  };

  return (
    <div className="page-container space-y-6">
      <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Tickets className="size-4" aria-hidden="true" />
            Operasional lapangan
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Manajemen penugasan
          </h1>

          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            Buat tiket pekerjaan, tentukan teknisi, dan pastikan
            koordinat klien tersimpan dengan akurat.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void fetchData()}
          disabled={isFetching}
        >
          <RefreshCw
            className={
              isFetching
                ? "size-4 animate-spin"
                : "size-4"
            }
            aria-hidden="true"
          />
          Perbarui data
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Total tiket
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.total}
              </p>
            </div>

            <Tickets
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Menunggu
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.pending}
              </p>
            </div>

            <Clock3
              className="size-5 text-amber-600"
              aria-hidden="true"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Sedang diproses
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {summary.active}
              </p>
            </div>

            <UserRoundCheck
              className="size-5 text-blue-600"
              aria-hidden="true"
            />
          </CardContent>
        </Card>
      </div>

      <AssignmentForm
        key={`${editingAssignment?.id ?? "new"}-${formRevision}`}
        technicians={technicians}
        assignment={editingAssignment}
        isSaving={isSaving}
        onSubmit={handleSaveAssignment}
        onCancel={handleCancelEdit}
      />

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <CardTitle>Daftar penugasan</CardTitle>
              <CardDescription className="mt-1">
                {filteredAssignments.length} dari{" "}
                {assignments.length} tiket ditampilkan.
              </CardDescription>
            </div>

            <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
              <div className="relative min-w-0 sm:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />

                <Input
                  value={searchQuery}
                  onChange={(event) =>
                    setSearchQuery(event.target.value)
                  }
                  placeholder="Cari klien, teknisi, atau alamat..."
                  className="pl-9"
                  aria-label="Cari penugasan"
                />
              </div>

              <Select
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as StatusFilter)
                }
              >
                <SelectTrigger
                  className="w-full sm:w-44"
                  aria-label="Filter status tiket"
                >
                  <SelectValue placeholder="Semua status" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="all">
                    Semua status
                  </SelectItem>
                  <SelectItem value="Pending">
                    Menunggu
                  </SelectItem>
                  <SelectItem value="On Process">
                    Diproses
                  </SelectItem>
                  <SelectItem value="Success">
                    Selesai
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="max-h-[720px] overflow-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background">
                <TableRow>
                  <TableHead>Teknisi</TableHead>
                  <TableHead>Klien dan lokasi</TableHead>
                  <TableHead>Koordinat</TableHead>
                  <TableHead>Dibuat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24 text-right">
                    Aksi
                  </TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isFetching ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-4 w-32" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-44" />
                        <Skeleton className="mt-2 h-3 w-64" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-40" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-4 w-28" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-6 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-8 w-20" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : filteredAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="h-56 text-center"
                    >
                      <div className="mx-auto flex max-w-sm flex-col items-center">
                        <CircleAlert
                          className="size-8 text-muted-foreground"
                          aria-hidden="true"
                        />

                        <p className="mt-3 text-sm font-medium text-foreground">
                          Penugasan tidak ditemukan
                        </p>

                        <p className="mt-1 text-sm text-muted-foreground">
                          Ubah kata pencarian atau filter status yang
                          digunakan.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAssignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell className="font-medium">
                        {assignment.technicianName}
                      </TableCell>

                      <TableCell>
                        <div className="max-w-sm">
                          <p className="font-medium text-foreground">
                            {assignment.clientName}
                          </p>

                          <p
                            className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground"
                            title={assignment.clientAddress}
                          >
                            {assignment.clientAddress}
                          </p>
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="inline-flex items-center gap-2 rounded-md border border-border bg-muted/50 px-2 py-1 font-mono text-[11px] text-muted-foreground">
                          <MapPin
                            className="size-3.5"
                            aria-hidden="true"
                          />
                          {assignment.latitude.toFixed(6)},{" "}
                          {assignment.longitude.toFixed(6)}
                        </div>
                      </TableCell>

                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDateTime(assignment.createdAt)}
                      </TableCell>

                      <TableCell>
                        <Badge
                          variant="outline"
                          className={getStatusClassName(
                            assignment.status,
                          )}
                        >
                          {getStatusLabel(assignment.status)}
                        </Badge>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              handleEdit(assignment)
                            }
                            aria-label={`Edit tiket ${assignment.clientName}`}
                            title={
                              assignment.status === "Pending"
                                ? "Edit tiket"
                                : "Tiket yang diproses atau selesai tidak dapat diedit"
                            }
                            disabled={
                              assignment.status !== "Pending"
                            }
                          >
                            <Pencil
                              className="size-4"
                              aria-hidden="true"
                            />
                          </Button>

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() =>
                              setAssignmentToDelete(assignment)
                            }
                            aria-label={`Hapus tiket ${assignment.clientName}`}
                            title={
                              assignment.status === "Pending"
                                ? "Hapus tiket"
                                : "Tiket yang diproses atau selesai tidak dapat dihapus"
                            }
                            disabled={
                              assignment.status !== "Pending"
                            }
                          >
                            <Trash2
                              className="size-4"
                              aria-hidden="true"
                            />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(assignmentToDelete)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) {
            setAssignmentToDelete(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus tiket penugasan?</DialogTitle>

            <DialogDescription>
              Tiket untuk{" "}
              <span className="font-medium text-foreground">
                {assignmentToDelete?.clientName}
              </span>{" "}
              akan dihapus secara permanen. Hanya tiket berstatus
              Menunggu yang dapat dihapus. Tindakan ini tidak dapat
              dibatalkan.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <DialogClose asChild>
              <Button
                type="button"
                variant="outline"
                disabled={isDeleting}
              >
                Batal
              </Button>
            </DialogClose>

            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}

              {isDeleting ? "Menghapus..." : "Hapus tiket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
