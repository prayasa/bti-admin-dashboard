"use client";

import {
  LoaderCircle,
  Save,
  UserPlus,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useState,
} from "react";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type EditableTechnician = {
  id: string;
  nama_lengkap: string;
  nik: string;
};

export type TechnicianFormPayload = {
  id?: string;
  nama_lengkap: string;
  nik: string;
  password?: string;
};

type TechnicianFormProps = {
  technician: EditableTechnician | null;
  isSaving: boolean;
  onSubmit: (
    payload: TechnicianFormPayload,
  ) => Promise<boolean>;
  onCancel: () => void;
};

export function TechnicianForm({
  technician,
  isSaving,
  onSubmit,
  onCancel,
}: TechnicianFormProps) {
  const isEditing = Boolean(technician);

  const [fullName, setFullName] = useState(
    technician?.nama_lengkap ?? "",
  );

  const [nik, setNik] = useState(
    technician?.nik ?? "",
  );

  const [password, setPassword] =
    useState("");

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const normalizedName = fullName.trim();
    const normalizedNik = nik.trim();
    const normalizedPassword =
      password.trim();

    if (
      !normalizedName ||
      !normalizedNik ||
      (!isEditing && !normalizedPassword)
    ) {
      return;
    }

    const success = await onSubmit({
      id: technician?.id,
      nama_lengkap: normalizedName,
      nik: normalizedNik,
      password:
        normalizedPassword || undefined,
    });

    if (success && !isEditing) {
      setFullName("");
      setNik("");
      setPassword("");
    }
  };

  return (
    <Card
      id="technician-form"
      className="scroll-mt-20"
    >
      <CardHeader>
        <CardTitle>
          {isEditing
            ? "Edit teknisi"
            : "Tambah teknisi"}
        </CardTitle>

        <CardDescription>
          {isEditing
            ? "Perbarui identitas atau kredensial teknisi."
            : "Daftarkan teknisi lapangan baru ke dalam sistem."}
        </CardDescription>

        <CardAction>
          <Badge
            variant={
              isEditing ? "info" : "neutral"
            }
          >
            {isEditing ? "Mode edit" : "Data baru"}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent>
        <form
          onSubmit={(event) =>
            void handleSubmit(event)
          }
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="technician-name">
              Nama lengkap
            </Label>

            <Input
              id="technician-name"
              name="nama_lengkap"
              type="text"
              value={fullName}
              onChange={(event) =>
                setFullName(event.target.value)
              }
              placeholder="Contoh: Budi Santoso"
              autoComplete="name"
              required
              autoFocus
              disabled={isSaving}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="technician-nik">
              NIK teknisi
            </Label>

            <Input
              id="technician-nik"
              name="nik"
              type="text"
              value={nik}
              onChange={(event) =>
                setNik(event.target.value)
              }
              placeholder="Contoh: BTI-2026-001"
              autoComplete="off"
              required
              disabled={isSaving}
            />

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              NIK digunakan sebagai identitas login
              teknisi.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="technician-password">
              {isEditing
                ? "Password baru"
                : "Password akses"}
            </Label>

            <Input
              id="technician-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) =>
                setPassword(event.target.value)
              }
              placeholder={
                isEditing
                  ? "Kosongkan jika tidak diubah"
                  : "Masukkan password awal"
              }
              autoComplete="new-password"
              minLength={6}
              required={!isEditing}
              disabled={isSaving}
            />

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {isEditing
                ? "Password lama tetap digunakan jika kolom ini dikosongkan."
                : "Gunakan minimal 6 karakter dan hindari password yang mudah ditebak."}
            </p>
          </div>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
            {isEditing ? (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSaving}
              >
                <X aria-hidden="true" />
                Batal
              </Button>
            ) : null}

            <Button
              type="submit"
              disabled={isSaving}
            >
              {isSaving ? (
                <LoaderCircle
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : isEditing ? (
                <Save aria-hidden="true" />
              ) : (
                <UserPlus aria-hidden="true" />
              )}

              {isSaving
                ? "Menyimpan..."
                : isEditing
                  ? "Simpan perubahan"
                  : "Daftarkan teknisi"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}