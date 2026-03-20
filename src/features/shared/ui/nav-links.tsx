'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';

const navItems = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/library', label: 'Library', icon: 'local_library' },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex-1 flex flex-col gap-2">
      {navItems.map(({ href, label, icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 py-3 px-6 font-body text-sm font-medium transition-all duration-200',
              isActive
                ? 'bg-surface-variant text-primary rounded-r-full translate-x-1'
                : 'text-tertiary hover:text-primary hover:bg-surface-container-low'
            )}
          >
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
