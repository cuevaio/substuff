"use client";

import { X } from "lucide-react";
import { useRef } from "react";
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
  const opener = useRef<HTMLElement | null>(
    typeof document !== "undefined"
      ? (document.activeElement as HTMLElement)
      : null,
  );
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
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          opener.current?.focus();
        }}
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
