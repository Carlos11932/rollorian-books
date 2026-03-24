'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const mobileNavItems = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/library', label: 'Library', icon: 'local_library' },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface/90 backdrop-blur-2xl md:hidden z-50 flex justify-around items-center py-4 px-6 border-t border-outline-variant/10">
      {mobileNavItems.map(({ href, label, icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 transition-colors',
              isActive ? 'text-primary' : 'text-tertiary'
            )}
          >
            <span className="material-symbols-outlined text-[24px]">{icon}</span>
            {isActive && (
              <span className="w-1 h-1 bg-secondary rounded-full" aria-hidden="true" />
            )}
            <span className="sr-only">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
