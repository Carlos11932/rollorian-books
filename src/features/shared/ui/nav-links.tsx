'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';

const navItems = [
  { href: '/', key: 'home', icon: 'home' },
  { href: '/search', key: 'search', icon: 'search' },
  { href: '/library', key: 'library', icon: 'local_library' },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="flex-1 flex flex-col gap-2">
      {navItems.map(({ href, key, icon }) => {
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
            {t(key)}
          </Link>
        );
      })}
    </nav>
  );
}
