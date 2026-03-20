'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { SiteHeader } from './site-header';
import { NavLinks } from './nav-links';

const mobileNavItems = [
  { href: '/', label: 'Home', icon: 'home' },
  { href: '/search', label: 'Search', icon: 'search' },
  { href: '/library', label: 'Library', icon: 'local_library' },
  { href: '/profile', label: 'Profile', icon: 'account_circle' },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  return (
    <>
      {/* Fixed top nav */}
      <SiteHeader />

      {/* Fixed sidebar — desktop only */}
      <aside className="fixed left-0 top-0 h-full w-64 hidden lg:flex flex-col py-8 z-40 bg-surface-container-lowest shadow-[40px_0_40px_rgba(0,17,12,0.4)]">
        {/* Sidebar header */}
        <div className="px-6 mb-12">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-primary-container rounded-lg flex items-center justify-center">
              <span className="material-symbols-outlined text-primary">auto_stories</span>
            </div>
            <div>
              <h2 className="text-lg font-black text-primary font-headline tracking-tighter">
                The Archive
              </h2>
              <p className="text-[10px] uppercase tracking-widest text-tertiary/60">
                Private Collection
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar nav links */}
        <NavLinks />

        {/* Sidebar footer */}
        <div className="px-6 flex flex-col gap-4">
          <button className="bg-gradient-to-br from-primary to-primary-container text-on-primary py-3 px-4 rounded-xl font-bold text-sm w-full">
            Add New Volume
          </button>
          <div className="pt-4 flex flex-col gap-2 border-t border-outline-variant/10">
            <Link
              href="/settings"
              className="flex items-center gap-3 text-tertiary py-2 hover:text-primary text-sm transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">settings</span>
              Settings
            </Link>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:pl-64 pt-16 min-h-screen">{children}</main>

      {/* Mobile bottom nav */}
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

      {/* FAB — home page only */}
      {isHome && (
        <button
          aria-label="Add new item"
          className="fixed bottom-24 right-8 lg:bottom-12 lg:right-12 w-16 h-16 bg-secondary text-on-secondary rounded-full flex items-center justify-center shadow-lg z-40 transition-transform hover:scale-105"
        >
          <span className="material-symbols-outlined text-[28px]">auto_fix_high</span>
        </button>
      )}
    </>
  );
}
