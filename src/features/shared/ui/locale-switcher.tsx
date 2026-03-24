'use client'

import { useRouter } from 'next/navigation'
import { useLocale } from 'next-intl'
import { type Locale } from '@/lib/i18n/types'

export function LocaleSwitcher() {
  const locale = useLocale() as Locale
  const router = useRouter()

  function switchLocale() {
    const next: Locale = locale === 'es' ? 'en' : 'es'
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`
    router.refresh()
  }

  return (
    <button
      onClick={switchLocale}
      aria-label={locale === 'es' ? 'Switch to English' : 'Cambiar a español'}
      className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-surface-container-high transition-colors"
    >
      <span className="text-lg leading-none" aria-hidden="true">
        {locale === 'es' ? '🇪🇸' : '🇬🇧'}
      </span>
    </button>
  )
}
