'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/cn';
import type { UserRole } from '@/lib/types/user';

const navItems = [
  { href: '/', key: 'home', icon: 'home' },
  { href: '/search', key: 'search', icon: 'search' },
  { href: '/library', key: 'library', icon: 'local_library' },
  { href: '/lists', key: 'lists', icon: 'playlist_add' },
  { href: '/stats', key: 'stats', icon: 'bar_chart' },
  { href: '/groups', key: 'groups', icon: 'group' },
  { href: '/people', key: 'people', icon: 'person_search' },
] as const;

interface NavLinksProps {
  role?: UserRole;
  pendingGroupInvitations?: number;
}

export function NavLinks({ role, pendingGroupInvitations = 0 }: NavLinksProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');

  return (
    <nav className="flex-1 flex flex-col gap-2">
      {navItems.map(({ href, key, icon }) => {
        const isActive = pathname === href;
        const isGroups = href === '/groups';
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
            <span className="relative inline-block">
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
              {isGroups && pendingGroupInvitations > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 flex items-center justify-center bg-error text-on-error text-[10px] font-bold rounded-full px-1 leading-none">
                  {pendingGroupInvitations > 99 ? '99+' : pendingGroupInvitations}
                </span>
              )}
            </span>
            {t(key)}
          </Link>
        );
      })}

      {role === 'SUPERADMIN' && (
        <Link
          href="/admin"
          className={cn(
            'flex items-center gap-3 py-3 px-6 font-body text-sm font-medium transition-all duration-200',
            pathname === '/admin'
              ? 'bg-surface-variant text-primary rounded-r-full translate-x-1'
              : 'text-tertiary hover:text-primary hover:bg-surface-container-low'
          )}
        >
          <span className="material-symbols-outlined text-[20px]">admin_panel_settings</span>
          {t('admin')}
        </Link>
      )}
    </nav>
  );
}
