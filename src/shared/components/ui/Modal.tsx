import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  /** Max width class — defaults to 3xl. */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  /** Sticky footer (usually the navigation buttons). */
  footer?: ReactNode;
  /** Disable closing on backdrop click (e.g. while saving). */
  disableBackdropClose?: boolean;
  /** Override desktop max-height (CSS value, e.g. '80vh'). Mobile stays at 95vh. */
  maxHeight?: string;
  /** Minimum height of the modal body container (CSS value, e.g. '24rem'). */
  minHeight?: string;
  children: ReactNode;
}

const SIZE_CLASSES: Record<NonNullable<ModalProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  '5xl': 'max-w-5xl',
};

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = '3xl',
  footer,
  disableBackdropClose = false,
  maxHeight,
  minHeight,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !disableBackdropClose) onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, disableBackdropClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={disableBackdropClose ? undefined : onClose}
      />
      <div
        className={cn(
          'relative bg-white w-full rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col',
          'max-h-[95vh] sm:max-h-[90vh]',
          SIZE_CLASSES[size]
        )}
        style={{
          ...(maxHeight ? { maxHeight } : null),
          ...(minHeight ? { minHeight } : null),
        }}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between px-5 sm:px-6 py-4 border-b border-gray-100">
            <div className="min-w-0">
              {title && (
                <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                  {title}
                </h2>
              )}
              {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 ml-4 p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              aria-label="Cerrar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">{children}</div>

        {footer && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default Modal;
