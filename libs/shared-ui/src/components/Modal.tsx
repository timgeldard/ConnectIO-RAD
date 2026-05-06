import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Shared Modal component.
 * Uses HTML5 <dialog> element and React Portals.
 */
export function Modal({ isOpen, onClose, title, children, footer, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  if (!isOpen) return null;

  const width = size === 'sm' ? 400 : size === 'lg' ? 800 : 560;

  return createPortal(
    <dialog
      ref={dialogRef}
      style={{
        width: `min(${width}px, 95vw)`,
        padding: 0,
        border: 'none',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-1)',
        color: 'var(--text-1)',
        boxShadow: 'var(--shadow-lg)',
      }}
      onClick={(e) => {
        if (e.target === dialogRef.current) onClose();
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--line-1)',
        }}>
          <h3 style={{ margin: 0, fontSize: 'var(--fs-18)', fontWeight: 600 }}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              padding: 4,
              cursor: 'pointer',
              color: 'var(--text-3)',
            }}
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div style={{
            padding: '16px 20px',
            borderTop: '1px solid var(--line-1)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
            background: 'var(--surface-sunken)',
          }}>
            {footer}
          </div>
        )}
      </div>
    </dialog>,
    document.body
  );
}
