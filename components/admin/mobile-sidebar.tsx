"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { AdminSidebar } from "@/components/admin/admin-sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileSidebar() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label="Buka navigasi utama"
        >
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-64 p-0 [&>button]:z-20"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Navigasi admin</SheetTitle>
          <SheetDescription>
            Menu navigasi utama dashboard BTI Operations.
          </SheetDescription>
        </SheetHeader>

        <AdminSidebar
          className="w-full border-r-0"
          onNavigate={() => setOpen(false)}
        />
      </SheetContent>
    </Sheet>
  );
}