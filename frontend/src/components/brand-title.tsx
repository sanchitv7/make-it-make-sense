import Link from "next/link";

const brandTitleClassName =
  "leading-none font-[family:var(--font-display)] font-black tracking-tighter whitespace-nowrap text-[var(--text-primary)] select-none transition-opacity hover:opacity-70";

interface BrandTitleProps {
  href?: string;
  onClick?: () => void;
}

export function BrandTitle({ href = "/", onClick }: BrandTitleProps) {
  const content = (
    <>
      <span className="hidden sm:inline">MAKE IT MAKE SENSE</span>
      <span className="sm:hidden">M·I·M·S</span>
    </>
  );

  const style = { fontSize: "clamp(1.8rem, 4.5vw, 3rem)", borderRadius: 0 };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${brandTitleClassName} cursor-pointer`}
        style={style}
        aria-label="Make It Make Sense"
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={href}
      className={brandTitleClassName}
      style={style}
      aria-label="Make It Make Sense — Home"
    >
      {content}
    </Link>
  );
}
