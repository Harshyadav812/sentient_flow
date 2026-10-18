import { useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Btn } from '@/components/common/controls';

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Delete',
  destructive = true,
  onConfirm,
  children,
  confirmDisabled,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  children?: ReactNode;
  confirmDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const handleConfirm = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // Caller surfaces the error; keep the dialog open so the user can retry.
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="border-[#2e2e33] bg-surface text-zinc-100 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px] font-semibold">{title}</DialogTitle>
          <DialogDescription className="text-[13px] leading-relaxed text-zinc-400">
            {description}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!confirmDisabled) handleConfirm();
          }}
        >
          {children}
          <div className="mt-5 flex justify-end gap-2">
            <Btn type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Btn>
            <Btn
              type="submit"
              variant={destructive ? 'danger' : 'primary'}
              loading={busy}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </Btn>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
