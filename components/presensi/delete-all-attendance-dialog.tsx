"use client";

import { useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CONFIRMATION = "HAPUS SEMUA";

type DeleteAllAttendanceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (confirmation: string) => Promise<boolean>;
};

export function DeleteAllAttendanceDialog({
  open,
  onOpenChange,
  onConfirm,
}: DeleteAllAttendanceDialogProps) {
  const [confirmation, setConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleOpenChange = (nextOpen: boolean) => {
    if (isDeleting) return;
    setConfirmation("");
    setErrorMessage("");
    onOpenChange(nextOpen);
  };

  const handleConfirm = async () => {
    if (isDeleting || confirmation.trim() !== CONFIRMATION) return;
    setIsDeleting(true);
    setErrorMessage("");
    try {
      if (await onConfirm(confirmation.trim())) {
        setConfirmation("");
        onOpenChange(false);
      } else {
        setErrorMessage("Penghapusan gagal. Periksa notifikasi lalu coba kembali.");
      }
    } catch {
      setErrorMessage("Penghapusan gagal. Silakan coba kembali.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={!isDeleting} className="max-w-md">
        <DialogHeader>
          <DialogTitle>Hapus semua log presensi?</DialogTitle>
          <DialogDescription>
            Seluruh log masuk dan pulang semua teknisi, untuk semua tanggal,
            akan dihapus permanen. Pilihan teknisi dan filter tanggal pada
            halaman tidak membatasi penghapusan ini. Audit presensi tetap
            tersimpan. Penghapusan riwayat dapat mengubah status presensi
            hari ini. Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="delete-all-attendance-confirmation">
            Ketik HAPUS SEMUA untuk melanjutkan
          </Label>
          <Input
            id="delete-all-attendance-confirmation"
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoComplete="off"
            disabled={isDeleting}
            placeholder={CONFIRMATION}
          />
          {errorMessage ? (
            <p role="alert" className="text-sm text-destructive">{errorMessage}</p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isDeleting}
            onClick={() => handleOpenChange(false)}>
            Batal
          </Button>
          <Button variant="destructive"
            disabled={isDeleting || confirmation.trim() !== CONFIRMATION}
            onClick={() => void handleConfirm()}>
            {isDeleting ? (
              <LoaderCircle className="animate-spin" aria-hidden="true" />
            ) : (
              <Trash2 aria-hidden="true" />
            )}
            {isDeleting ? "Menghapus..." : "Hapus semua permanen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
