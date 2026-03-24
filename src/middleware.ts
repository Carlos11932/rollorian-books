import createMiddleware from 'next-intl/middleware'
import { locales, defaultLocale } from '@/lib/i18n/types'

export default createMiddleware({
  locales,
  defaultLocale,
  localePrefix: 'never',
  localeDetection: false,
})

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
