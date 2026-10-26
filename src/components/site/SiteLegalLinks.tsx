import Link from "next/link";

type SiteLegalLinksProps = {
  className?: string;
};

/** Compact privacy + terms links for footers and forms. */
export const SiteLegalLinks = ({ className = "" }: SiteLegalLinksProps) => (
  <span className={className}>
    <Link
      href="/privacy"
      className="text-clay underline-offset-3 transition-colors hover:underline"
    >
      Политика конфиденциальности
    </Link>
    <span className="mx-1.5 text-ink/30" aria-hidden="true">
      ·
    </span>
    <Link
      href="/terms"
      className="text-clay underline-offset-3 transition-colors hover:underline"
    >
      Пользовательское соглашение
    </Link>
  </span>
);
