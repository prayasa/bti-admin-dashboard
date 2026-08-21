"use client";

import { useState } from "react";
import {
  LoaderCircle,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DeleteAttendanceDialogProps = {
  open: boolean;
  technicianName: string;
  attendanceTime: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<boolean>;
};

export function DeleteAttendanceDialog({
  open,
  technicianName,
  attendanceTime,
  onOpenChange,
  onConfirm,
}: DeleteAttendanceDialogProps) {
  const [isDeleting, setIsDeleting] =
    useState(false);

  const handleOpenChange = (
    nextOpen: boolean,
  ) => {
    if (!isDeleting) {
      onOpenChange(nextOpen);
    }
  };

  const handleConfirm = async () => {
    setIsDeleting(true);

    try {
      const success = await onConfirm();

      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={handleOpenChange}
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
            Hapus data presensi?
          </DialogTitle>

          <DialogDescription>
            Presensi milik{" "}
            <span className="font-medium text-foreground">
              {technicianName}
            </span>{" "}
            pada{" "}
            <span className="font-medium text-foreground">
              {attendanceTime}
            </span>{" "}
            akan dihapus permanen. Tindakan ini
            tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isDeleting}
          >
            Batal
          </Button>

          <Button
            variant="destructive"
            onClick={() =>
              void handleConfirm()
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
  );
}