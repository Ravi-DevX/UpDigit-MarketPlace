"use client";

import { FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";

interface SearchBarProps {
  placeholder: string;
  defaultValue?: string;
}

export function SearchBar({ placeholder, defaultValue = "" }: SearchBarProps) {
  const router = useRouter();

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const searchValue = (new FormData(form).get("q")?.toString() ?? "").trim();
    if (!searchValue) {
      router.push("/search");
      return;
    }
    router.push(`/search?q=${encodeURIComponent(searchValue)}`);
  };

  return (
    <form onSubmit={submit} className="relative w-full max-w-3xl" action="#">
      <input
        aria-label="Search marketplace"
        name="q"
        defaultValue={defaultValue}
        className="w-full rounded-full border border-border bg-surface px-4 py-3 pr-11 text-sm text-textPrimary outline-none backdrop-blur transition placeholder:text-textSecondary focus:border-primary/60 focus:bg-black/30"
        placeholder={placeholder}
      />
      <button
        type="submit"
        aria-label="Search"
        className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-primary/90 text-primary-foreground transition hover:bg-primary"
      >
        <Search className="h-4 w-4" />
      </button>
      <Link
        href="/search"
        className="sr-only"
      >
        search
      </Link>
    </form>
  );
}
