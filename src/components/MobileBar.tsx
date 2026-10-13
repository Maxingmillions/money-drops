import Link from "next/link";

/** Phone-only top bar: back/close button and a title, sitting above a map instead of floating on it. */
export function MobileBar({ href, title, icon }: { href: string; title: string; icon: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+10px)] lg:hidden">
      <Link href={href} className="icon-btn shrink-0">
        {icon}
      </Link>
      <h1 className="min-w-0 flex-1 truncate text-center text-[16px] font-bold">{title}</h1>
      <div className="w-10 shrink-0" />
    </div>
  );
}
