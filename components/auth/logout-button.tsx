"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  LoaderCircle,
  LogOut,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { supabase } from "@/src/utils/supabase";

export function LogoutButton() {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] =
    useState(false);

  const handleLogout = async () => {
    setIsLoggingOut(true);

    const { error } = await supabase.auth.signOut({
      scope: "local",
    });

    if (error) {
      toast.error("Gagal keluar dari dashboard.", {
        description: error.message,
      });
      setIsLoggingOut(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => void handleLogout()}
      disabled={isLoggingOut}
    >
      {isLoggingOut ? (
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

      {isLoggingOut ? "Keluar..." : "Keluar"}
    </Button>
  );
}