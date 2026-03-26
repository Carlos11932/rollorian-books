'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import { LocaleSwitcher } from './locale-switcher';

export function SiteHeader() {
  const pathname = usePathname();
  const t = useTranslations('nav');

  const navItems = [
    { href: '/', label: t('home') },
    { href: '/search', label: t('search') },
    { href: '/library', label: t('library') },
  ];

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#001711]/80 backdrop-blur-xl bg-gradient-to-b from-[#001711] to-transparent">
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

        {/* Right: locale switcher + search icon + profile avatar */}
        <div className="flex items-center gap-6">
          <LocaleSwitcher />
          <button
            aria-label={t('searchAriaLabel')}
            type="button"
            className="hover:bg-surface-variant/50 p-2 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-primary" style={{ fontSize: "22px" }}>
              search
            </span>
          </button>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-primary/20 bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-xl leading-none">
              account_circle
            </span>
          </div>
        </div>
      </div>
    </nav>
  );
}
