import Link from "next/link";

/** The open-book mark from the design, drawn inline rather than as an icon font. */
export function BookMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 6.5C10.6 5.2 8.6 4.6 6.4 4.6c-.9 0-1.7.1-2.4.3v13c.7-.2 1.5-.3 2.4-.3 2.2 0 4.2.6 5.6 1.9" />
      <path d="M12 6.5c1.4-1.3 3.4-1.9 5.6-1.9.9 0 1.7.1 2.4.3v13c-.7-.2-1.5-.3-2.4-.3-2.2 0-4.2.6-5.6 1.9" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

export function Wordmark({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 text-primary transition hover:opacity-80"
    >
      <BookMark className="h-5 w-5" />
      <span className="font-display text-lg font-bold tracking-tight">
        The Memoir Project
      </span>
    </Link>
  );
}

export function ArrowRight({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
