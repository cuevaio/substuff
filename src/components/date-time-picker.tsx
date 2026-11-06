"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown } from "@/components/icons";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function localDateTime(date: Date) {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export function DateTimePicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const parsed = new Date(value);
  const date = Number.isFinite(parsed.getTime()) ? parsed : undefined;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const last = new Date(Date.now() + 90 * 86400000);
  return (
    <div className="date-time-picker">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="date-trigger"
            aria-label="Choose date"
            disabled={disabled}
          >
            <CalendarDays size={16} />
            <span>
              {date
                ? date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                : "Choose date"}
            </span>
            <ChevronDown size={14} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          aria-label="Choose publishing date"
          align="start"
          className="w-auto p-0"
          style={{ zIndex: 70 }}
        >
          <Calendar
            mode="single"
            selected={date}
            defaultMonth={date}
            disabled={[{ before: today }, { after: last }]}
            onSelect={(selected) => {
              if (!selected) return;
              if (date)
                selected.setHours(date.getHours(), date.getMinutes(), 0, 0);
              else selected.setHours(10, 0, 0, 0);
              onChange(localDateTime(selected));
              setOpen(false);
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
      <Input
        className="h-10 w-[120px] shrink-0"
        type="time"
        aria-label="Publishing time"
        value={value.slice(11, 16)}
        disabled={disabled}
        required
        onChange={(event) =>
          onChange(`${value.slice(0, 10)}T${event.target.value}`)
        }
      />
    </div>
  );
}
