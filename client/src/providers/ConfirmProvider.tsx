import { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export interface ConfirmOptions {
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export interface ConfirmContextType {
  /**
   * Promise tabanlı dinamik onay penceresi açar.
   */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | undefined>(undefined);

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

export const ConfirmProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolvePromise, setResolvePromise] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((newOptions: ConfirmOptions): Promise<boolean> => {
    setOptions(newOptions);
    setIsOpen(true);
    return new Promise((resolve) => {
      setResolvePromise(() => resolve); // await edildiği için resolve fonksiyonunu saklıyoruz
    });
  }, []);

  const handleConfirm = () => {
    setIsOpen(false);
    if (resolvePromise) resolvePromise(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    if (resolvePromise) resolvePromise(false);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {options && (
        <ConfirmDialog
          isOpen={isOpen}
          onClose={handleClose}
          onConfirm={handleConfirm}
          title={options.title}
          description={options.description}
          confirmText={options.confirmText || 'Onayla'}
          cancelText={options.cancelText || 'İptal'}
          variant={options.variant || 'default'}
        />
      )}
    </ConfirmContext.Provider>
  );
};
