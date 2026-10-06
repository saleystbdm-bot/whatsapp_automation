import { useEffect, type PropsWithChildren, type ReactNode } from 'react';
import { CloseIcon } from './icons';

interface DrawerProps extends PropsWithChildren {
  title: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
}

export function Drawer({ title, onClose, children, footer }: DrawerProps) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="overlay-backdrop" onClick={onClose}>
      <div
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drawer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-header">
          <div id="drawer-title" className="drawer-title">
            {title}
          </div>
          <button type="button" className="icon-button" aria-label="Close details" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-footer">{footer}</div>}
      </div>
    </div>
  );
}
