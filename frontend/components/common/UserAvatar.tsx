"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type UserAvatarProps = {
  username?: string | null;
  displayName?: string | null;
  avatarURL?: string | null;
  className?: string;
};

function avatarColor(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return `hsl(${hash % 360} 58% 42%)`;
}

export function UserAvatar({ username, displayName, avatarURL, className }: UserAvatarProps) {
  const [failed, setFailed] = useState(false);
  const label = displayName?.trim() || username?.trim() || "User";
  const backgroundColor = useMemo(() => avatarColor(username?.trim() || label), [label, username]);

  useEffect(() => setFailed(false), [avatarURL]);

  if (avatarURL && !failed) {
    return (
      <img
        src={avatarURL}
        alt={`${label} avatar`}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-label={`${label} avatar`}
      style={{ backgroundColor }}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-textPrimary", className)}
    >
      {label.slice(0, 1).toUpperCase()}
    </span>
  );
}
