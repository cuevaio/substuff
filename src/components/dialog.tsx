"use client";

import { X } from "lucide-react";
import {
  DialogContent,
  DialogTitle,
  Dialog as Root,
} from "@/components/ui/dialog";

export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className={wide ? "dialog-wide" : undefined}
        aria-describedby={undefined}
      >
        <header className="dialog-header">
          <DialogTitle>{title}</DialogTitle>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={19} />
          </button>
        </header>
        {children}
      </DialogContent>
    </Root>
  );
}
