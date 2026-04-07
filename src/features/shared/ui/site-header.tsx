'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { LocaleSwitcher } from './locale-switcher';
import { UserMenu } from './user-menu';
import type { UserRole } from '@/lib/types/user';

interface SiteHeaderUser {
  name: string | null;
  email: string;
  image: string | null;
}

interface SiteHeaderProps {
  user: SiteHeaderUser;
  signOutAction: () => Promise<void>;
  role?: UserRole;
}

export function SiteHeader({ user, signOutAction, role }: SiteHeaderProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const navItems = [
    { href: '/', label: t('home') },
    { href: '/search', label: t('search') },
    { href: '/library', label: t('library') },
    { href: '/groups', label: t('groups') },
    ...(role === 'SUPERADMIN' ? [{ href: '/admin', label: t('admin') }] : []),
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-xl bg-gradient-to-b from-surface to-transparent">
      <div className="flex justify-between items-center w-full px-8 md:px-16 py-4">
        {/* Left: Logo + desktop nav */}
        <div className="flex items-center gap-12">
          <span className="text-xl font-bold tracking-tighter text-primary font-headline">
            {t('brand')}
          </span>
          <div className="hidden md:flex gap-8 items-center">
            {navItems.map(({ href, label }) => {
              const isActive = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'text-sm font-medium transition-colors',
                    isActive
                      ? 'text-primary border-b-2 border-secondary pb-1'
                      : 'text-tertiary hover:text-primary'
                  )}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right: locale switcher + search icon + user menu */}
        <div className="flex items-center gap-6">
          <LocaleSwitcher />
          <button
            aria-label={t('searchAriaLabel')}
            type="button"
            className="hover:bg-surface-variant/50 p-2 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-primary">
              search
            </span>
          </button>
          <UserMenu user={user} signOutAction={signOutAction} role={role} />
        </div>
      </div>
    </nav>
  );
}
