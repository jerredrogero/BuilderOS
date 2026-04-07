"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

interface ConfirmDeleteButtonProps {
  action: () => void;
  label?: string;
  description?: string;
  variant?: "destructive" | "ghost";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
  className?: string;
}

export function ConfirmDeleteButton({
  action,
  label = "Delete",
  description = "Are you sure? This action cannot be undone.",
  variant = "destructive",
  size = "default",
  className,
}: ConfirmDeleteButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant={variant} size={size} className={className}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Deletion</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <form action={action}>
            <Button type="submit" variant="destructive" onClick={() => setOpen(false)}>
              Delete
            </Button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
