"use client";

import { useState, type FormEvent } from "react";
import {
  LoaderCircle,
  MapPinned,
  Save,
  Send,
  X,
} from "lucide-react";

import {
  LocationPicker,
  type LocationValue,
} from "@/components/penugasan/location-picker";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export interface AssignmentTechnician {
  id: string;
  name: string;
}

export interface EditableAssignment {
  id: string;
  technicianId: string;
  clientName: string;
  clientAddress: string;
  latitude: number;
  longitude: number;
}

export interface AssignmentPayload {
  technicianId: string;
  clientName: string;
  clientAddress: string;
  latitude: number;
  longitude: number;
}

interface AssignmentFormProps {
  technicians: AssignmentTechnician[];
  assignment?: EditableAssignment | null;
  isSaving: boolean;
  onSubmit: (payload: AssignmentPayload) => Promise<void>;
  onCancel: () => void;
}

export function AssignmentForm({
  technicians,
  assignment,
  isSaving,
  onSubmit,
  onCancel,
}: AssignmentFormProps) {
  const [technicianId, setTechnicianId] = useState(
    assignment?.technicianId ?? "",
  );
  const [clientName, setClientName] = useState(
    assignment?.clientName ?? "",
  );
  const [location, setLocation] = useState<LocationValue>({
    address: assignment?.clientAddress ?? "",
    latitude: assignment?.latitude ?? null,
    longitude: assignment?.longitude ?? null,
  });
  const [validationMessage, setValidationMessage] = useState("");

  const isEditing = Boolean(assignment);
  const hasCoordinates =
    location.latitude !== null && location.longitude !== null;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedClientName = clientName.trim();
    const normalizedAddress = location.address.trim();

    if (!technicianId) {
      setValidationMessage("Pilih teknisi yang akan menerima tugas.");
      return;
    }

    if (!normalizedClientName) {
      setValidationMessage("Nama klien wajib diisi.");
      return;
    }

    if (!normalizedAddress) {
      setValidationMessage("Alamat klien wajib diisi.");
      return;
    }

    if (
      location.latitude === null ||
      location.longitude === null
    ) {
      setValidationMessage(
        "Pilih titik lokasi klien melalui pencarian atau peta.",
      );
      return;
    }

    setValidationMessage("");

    await onSubmit({
      technicianId,
      clientName: normalizedClientName,
      clientAddress: normalizedAddress,
      latitude: location.latitude,
      longitude: location.longitude,
    });
  };

  return (
    <Card>
      <CardHeader className="border-b border-border">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>
              {isEditing
                ? "Edit tiket penugasan"
                : "Buat tiket penugasan"}
            </CardTitle>

            <CardDescription className="mt-1">
              Tentukan teknisi, data klien, dan koordinat pekerjaan
              lapangan.
            </CardDescription>
          </div>

          {isEditing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onCancel}
              disabled={isSaving}
            >
              <X className="size-4" aria-hidden="true" />
              Batalkan edit
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="pt-5">
        <form
          onSubmit={handleSubmit}
          className="grid gap-6 xl:grid-cols-12"
        >
          <div className="space-y-5 xl:col-span-4">
            <div className="space-y-2">
              <Label htmlFor="assignment-technician">
                Teknisi lapangan
              </Label>

              <Select
                value={technicianId}
                onValueChange={(value) => {
                  setTechnicianId(value);
                  setValidationMessage("");
                }}
                disabled={isSaving}
              >
                <SelectTrigger
                  id="assignment-technician"
                  className="w-full"
                  aria-label="Pilih teknisi lapangan"
                >
                  <SelectValue placeholder="Pilih teknisi" />
                </SelectTrigger>

                <SelectContent>
                  {technicians.length > 0 ? (
                    technicians.map((technician) => (
                      <SelectItem
                        key={technician.id}
                        value={technician.id}
                      >
                        {technician.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="unavailable" disabled>
                      Belum ada teknisi aktif
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-client">
                Nama klien
              </Label>

              <Input
                id="assignment-client"
                value={clientName}
                onChange={(event) => {
                  setClientName(event.target.value);
                  setValidationMessage("");
                }}
                placeholder="Contoh: PT Khatulistiwa Digital"
                autoComplete="organization"
                disabled={isSaving}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignment-address">
                Alamat lengkap
              </Label>

              <Textarea
                id="assignment-address"
                value={location.address}
                onChange={(event) => {
                  setLocation((current) => ({
                    ...current,
                    address: event.target.value,
                  }));
                  setValidationMessage("");
                }}
                placeholder="Alamat hasil peta dapat disempurnakan secara manual."
                rows={5}
                disabled={isSaving}
                required
              />

              <p className="text-xs leading-5 text-muted-foreground">
                Detail seperti nomor bangunan, gang, dan patokan dapat
                ditambahkan setelah memilih titik peta.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="assignment-latitude">
                  Latitude
                </Label>

                <Input
                  id="assignment-latitude"
                  value={
                    location.latitude !== null
                      ? location.latitude.toFixed(6)
                      : ""
                  }
                  placeholder="Otomatis"
                  readOnly
                  className="font-mono text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="assignment-longitude">
                  Longitude
                </Label>

                <Input
                  id="assignment-longitude"
                  value={
                    location.longitude !== null
                      ? location.longitude.toFixed(6)
                      : ""
                  }
                  placeholder="Otomatis"
                  readOnly
                  className="font-mono text-xs"
                />
              </div>
            </div>

            {validationMessage ? (
              <p
                className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
                role="alert"
              >
                {validationMessage}
              </p>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              disabled={
                isSaving ||
                technicians.length === 0 ||
                !hasCoordinates
              }
            >
              {isSaving ? (
                <LoaderCircle
                  className="size-4 animate-spin"
                  aria-hidden="true"
                />
              ) : isEditing ? (
                <Save className="size-4" aria-hidden="true" />
              ) : (
                <Send className="size-4" aria-hidden="true" />
              )}

              {isSaving
                ? "Menyimpan..."
                : isEditing
                  ? "Simpan perubahan"
                  : "Terbitkan tiket"}
            </Button>
          </div>

          <div className="space-y-3 xl:col-span-8">
            <div className="flex items-center gap-2">
              <MapPinned
                className="size-4 text-primary"
                aria-hidden="true"
              />

              <Label>Lokasi pekerjaan</Label>
            </div>

            <LocationPicker
              value={location}
              onChange={(nextLocation) => {
                setLocation(nextLocation);
                setValidationMessage("");
              }}
            />

            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5 text-xs leading-5 text-muted-foreground">
              Gunakan pencarian untuk lokasi umum. Untuk alamat gang
              atau titik spesifik, klik langsung pada peta lalu
              perbaiki detail alamat melalui kolom di sebelah kiri.
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}