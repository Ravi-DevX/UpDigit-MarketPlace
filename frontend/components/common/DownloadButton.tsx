interface DownloadButtonProps {
  href?: string;
  children: React.ReactNode;
}

export function DownloadButton({ href, children }: DownloadButtonProps) {
  if (!href) {
    return (
      <button
        type="button"
        className="rounded bg-surface px-3 py-2 text-sm text-textSecondary disabled:cursor-not-allowed disabled:opacity-50"
        disabled
      >
        {children}
      </button>
    );
  }

  return (
    <a
      href={href}
      className="inline-block rounded bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary-hover"
      rel="noreferrer"
    >
      {children}
    </a>
  );
}
