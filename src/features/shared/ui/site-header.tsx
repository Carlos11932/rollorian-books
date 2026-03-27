'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { UserMenu } from './user-menu';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/search', label: 'Search' },
  { href: '/library', label: 'Library' },
];

interface SiteHeaderUser {
  name: string | null;
  email: string;
  image: string | null;
}

interface SiteHeaderProps {
  user: SiteHeaderUser;
  signOutAction: () => Promise<void>;
}

export function SiteHeader({ user, signOutAction }: SiteHeaderProps) {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 w-full z-50 bg-[#001711]/80 backdrop-blur-xl bg-gradient-to-b from-[#001711] to-transparent">
      <div className="flex justify-between items-center w-full px-8 md:px-16 py-4">
        {/* Left: Logo + desktop nav */}
        <div className="flex items-center gap-12">
          <span className="text-xl font-bold tracking-tighter text-primary font-headline">
            Rollorian Books
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

        {/* Right: search icon + user menu */}
        <div className="flex items-center gap-6">
          <button
            aria-label="Search"
            type="button"
            className="hover:bg-surface-variant/50 p-2 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-primary" style={{ fontSize: "22px" }}>
              search
            </span>
          </button>
          <UserMenu user={user} signOutAction={signOutAction} />
        </div>
      </div>
    </nav>
  );
}
