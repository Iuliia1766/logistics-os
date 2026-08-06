'use client';

import { useEffect } from 'react';
import { Icon } from './Icons';

export function Toast({
  message, onDismiss, ms = 4200,
}: { message: string | null; onDismiss: () => void; ms?: number }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, ms);
    return () => clearTimeout(t);
  }, [message, ms, onDismiss]);

  if (!message) return null;
  return (
    <div className="toast" role="status">
      <Icon name="check" size={16} />
      <span>{message}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">
        <Icon name="x" size={14} />
      </button>
    </div>
  );
}
