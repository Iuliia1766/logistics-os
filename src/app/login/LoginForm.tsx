'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from '@/components/Icons';
import { signIn, type FormState } from '@/app/actions/auth';
import type { UserRole } from '@/lib/types';

function Submit({ role }: { role: UserRole }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? 'Signing in…' : `Sign in as ${role === 'driver' ? 'Carrier' : 'Shipper'}`}
    </button>
  );
}

export function LoginForm({ initialRole }: { initialRole: UserRole }) {
  const [role, setRole] = useState<UserRole>(initialRole);
  const [state, action] = useActionState<FormState, FormData>(signIn, {});

  return (
    <>
      <div className="role-pick">
        <button type="button" className={'role-card' + (role === 'driver' ? ' on' : '')}
          aria-pressed={role === 'driver'} onClick={() => setRole('driver')}>
          <span className="rc-ico"><Icon name="truck" size={20} /></span>
          <span className="rc-t">Carrier</span>
          <span className="rc-d">Search loads, see $/mi and deadhead, book and run</span>
        </button>
        <button type="button" className={'role-card' + (role === 'shipper' ? ' on' : '')}
          aria-pressed={role === 'shipper'} onClick={() => setRole('shipper')}>
          <span className="rc-ico"><Icon name="building" size={20} /></span>
          <span className="rc-t">Shipper</span>
          <span className="rc-d">Post freight, track every stage, message dispatch</span>
        </button>
      </div>

      <form action={action}>
        <input type="hidden" name="role" value={role} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required
            autoComplete="current-password" />
        </div>

        {state.error && (
          <p role="alert" style={{
            fontSize: '.8rem', color: 'var(--warn)', background: 'var(--warn-soft)',
            border: '1px solid var(--warn-line)', borderRadius: 'var(--r)',
            padding: '9px 11px', margin: '0 0 12px', lineHeight: 1.5,
          }}>
            {state.error}
          </p>
        )}

        <Submit role={role} />
      </form>
    </>
  );
}
