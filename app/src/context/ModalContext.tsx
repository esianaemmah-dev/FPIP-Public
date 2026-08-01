// Modal system as React state (Phase 1 requirement: rebuild the demo's
// vanilla-DOM modal as real React state). Body/foot accept ReactNode.

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from 'react';
import { Icon } from '@/components/Icons';

interface ModalOptions {
  eyebrow?: string;
  title?: string;
  body?: ReactNode;
  foot?: ReactNode;
}

interface ModalContextValue {
  openModal: (opts: ModalOptions) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ModalOptions>({});

  const openModal = useCallback((o: ModalOptions) => {
    setOpts(o);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <div
        className={`modal-overlay${open ? ' open' : ''}`}
        onClick={closeModal}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-box" onClick={(e) => e.stopPropagation()}>
          <div className="modal-head">
            <div>
              <div className="modal-eyebrow">{opts.eyebrow ?? 'Record'}</div>
              <h3>{opts.title ?? ''}</h3>
            </div>
            <button type="button" className="modal-close" onClick={closeModal} aria-label="Close">
              <Icon name="close" size={14} />
            </button>
          </div>
          <div className="modal-body">{opts.body}</div>
          {opts.foot ? <div className="modal-foot">{opts.foot}</div> : null}
        </div>
      </div>
    </ModalContext.Provider>
  );
}

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within a ModalProvider');
  return ctx;
}

/** Reusable labelled field for modal bodies, matching the demo's .modal-field. */
export function ModalField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="modal-field">
      <label>{label}</label>
      {children}
    </div>
  );
}
