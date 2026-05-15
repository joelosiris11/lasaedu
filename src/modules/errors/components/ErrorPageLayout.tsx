import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Home, RefreshCw } from 'lucide-react';

interface SecondaryAction {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
}

interface Props {
  code: string;
  title: string;
  description: string;
  icon: ReactNode;
  primaryHref?: string;
  primaryLabel?: string;
  secondary?: SecondaryAction;
}

// Single visual shell for 404 / 403 / 500. Centered card with a soft red
// gradient code, icon wash, and a primary "Volver al inicio" CTA — sized
// mobile-first (full-width buttons ≤ sm, side-by-side ≥ sm).
export default function ErrorPageLayout({
  code,
  title,
  description,
  icon,
  primaryHref = '/dashboard',
  primaryLabel = 'Volver al inicio',
  secondary,
}: Props) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="h-1.5 bg-gradient-to-r from-red-600 via-red-700 to-red-900" />

      <main className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-md">
          <div className="relative bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
            <div
              aria-hidden="true"
              className="absolute -top-16 -right-16 h-40 w-40 rounded-full bg-gradient-to-br from-red-500/15 to-red-900/10 blur-2xl"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-20 -left-20 h-40 w-40 rounded-full bg-gradient-to-tr from-red-500/10 to-red-700/5 blur-2xl"
            />

            <div className="relative p-7 sm:p-10 text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/40">
                <div className="text-red-600">{icon}</div>
              </div>

              <div className="mb-3">
                <span
                  className="block text-6xl sm:text-7xl font-bold tracking-tight leading-none text-transparent bg-clip-text bg-gradient-to-br from-red-600 via-red-700 to-red-900"
                  aria-label={`Error ${code}`}
                >
                  {code}
                </span>
              </div>

              <h1 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">
                {title}
              </h1>
              <p className="text-sm text-gray-600 leading-relaxed mb-7 max-w-sm mx-auto">
                {description}
              </p>

              <div className="flex flex-col sm:flex-row gap-2 sm:justify-center">
                <Link
                  to={primaryHref}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 transition-colors"
                >
                  <Home className="h-4 w-4" aria-hidden="true" />
                  {primaryLabel}
                </Link>
                {secondary && (
                  <button
                    type="button"
                    onClick={secondary.onClick}
                    className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 transition-colors"
                  >
                    {secondary.icon ?? <RefreshCw className="h-4 w-4" aria-hidden="true" />}
                    {secondary.label}
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-gray-400">
            <img
              src="/LaAuroraLogo.png"
              alt=""
              className="h-5 w-5 rounded-sm object-contain opacity-70"
            />
            <span>La Aurora · LasaEdu</span>
          </div>
        </div>
      </main>
    </div>
  );
}
