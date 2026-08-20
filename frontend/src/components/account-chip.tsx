"use client";

import { User } from "lucide-react";
import { accountDisplayName } from "@/lib/account-display-name";

interface AccountChipProps {
  fullName: string;
}

/** Person icon + bold first name for signed-in Account chrome. */
export function AccountChip({ fullName }: AccountChipProps) {
  const label = accountDisplayName(fullName);
  if (!label) return null;

  return (
    <span
      className="inline-flex max-w-[200px] items-center gap-1.5 text-sm font-[family:var(--font-body)] font-bold text-[var(--text-primary)]"
      title={fullName.trim()}
    >
      <User size={16} strokeWidth={2} className="shrink-0" aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}
