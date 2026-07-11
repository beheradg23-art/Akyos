import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { motion as motionTokens } from '../styles/motion';

// ---------------------------------------------------------------------------
// One shared toast/snackbar surface for the whole app.
//
// Every card (password change, cloud sync, backup/restore, passcode change,
// ...) used to render its own inline "Saved ✓ / Sync failed" strip, each
// styled slightly differently and each disappearing on its own timer. This
// replaces all of that with a single bottom-center stack that anything in
// the app can push into — no context provider, no prop drilling.
//
// Mount <Toaster /> once, near the root of the app (right next to the other
// top-level overlays in App.tsx). Then from anywhere:
//
//   import { toast } from '../lib/toast';
//   toast.success('Password updated.');
//   toast.error('Could not update your password.');
//   toast.info('Syncing your data from the cloud…');
//
// Implementation note: this is a tiny module-level pub/sub (not React
// context) specifically so it can be called from deep inside the tree —
// event handlers, async callbacks, even non-component code — without every
// intermediate component needing to accept and forward a "showToast" prop.
// ---------------------------------------------------------------------------

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
  duration: number;
}

type Listener = (toasts: ToastItem[]) => void;

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<Listener>();

const emit = () => listeners.forEach((l) => l(toasts));

const push = (kind: ToastKind, message: string, duration = 3200) => {
  const id = nextId++;
  toasts = [...toasts, { id, kind, message, duration }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismiss(id), duration);
  }
  return id;
};

const dismiss = (id: number) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

export const toast = {
  success: (message: string, duration?: number) => push('success', message, duration),
  error: (message: string, duration?: number) => push('error', message, duration),
  info: (message: string, duration?: number) => push('info', message, duration),
  dismiss,
};

const KIND_STYLES: Record<ToastKind, { icon: React.ElementType; classes: string }> = {
  success: {
    icon: CheckCircle2,
    classes: 'border-violet-800/40 bg-neutral-900/95 text-violet-200 [&_svg]:text-violet-400',
  },
  error: {
    icon: XCircle,
    classes: 'border-rose-800/40 bg-neutral-900/95 text-rose-200 [&_svg]:text-rose-400',
  },
  info: {
    icon: Info,
    classes: 'border-neutral-700/60 bg-neutral-900/95 text-neutral-200 [&_svg]:text-neutral-400',
  },
};

function ToastRow({ item }: { item: ToastItem }) {
  const [leaving, setLeaving] = useState(false);
  const { icon: Icon, classes } = KIND_STYLES[item.kind];

  const handleDismiss = () => {
    setLeaving(true);
    setTimeout(() => dismiss(item.id), 180);
  };

  return (
    <div
      role="status"
      className={`pointer-events-auto flex w-full max-w-sm items-center gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg shadow-black/30 backdrop-blur-sm transition-all ${classes}`}
      style={{
        transition: `all ${motionTokens.fast}`,
        opacity: leaving ? 0 : 1,
        transform: leaving ? 'translateY(6px) scale(0.98)' : 'translateY(0) scale(1)',
      }}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
      <p className="flex-1 text-[12.5px] font-medium leading-snug">{item.message}</p>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-300"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}

/**
 * Mount once near the root of the app. Renders the live toast stack,
 * bottom-center, above everything else.
 */
export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(toasts);

  useEffect(() => {
    listeners.add(setItems);
    return () => {
      listeners.delete(setItems);
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[1000] flex flex-col items-center gap-2 px-4 sm:bottom-6">
      {items.map((item) => (
        <ToastRow key={item.id} item={item} />
      ))}
    </div>
  );
}