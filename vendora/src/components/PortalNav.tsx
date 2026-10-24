import Link from 'next/link';

export interface PortalLink {
  href: string;
  label: string;
}

/** Secondary navigation inside a portal. Scrolls horizontally on small screens. */
export function PortalNav({ title, links }: { title: string; links: PortalLink[] }) {
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 sm:px-6">
        <p className="hidden shrink-0 text-sm font-bold text-brand-700 md:block">{title}</p>
        <nav aria-label={title} className="-mx-2 flex flex-1 items-center gap-1 overflow-x-auto px-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="min-h-12 shrink-0 border-b-2 border-transparent px-3 py-3 text-sm font-semibold text-slate-600 hover:border-brand-300 hover:text-brand-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
