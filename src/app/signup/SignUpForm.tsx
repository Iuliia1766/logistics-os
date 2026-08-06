'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Icon } from '@/components/Icons';
import { signUp, type FormState } from '@/app/actions/auth';
import { EQUIPMENT_LABELS, EQUIPMENT_ORDER, type UserRole } from '@/lib/types';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn-primary" type="submit" disabled={pending}>
      {pending ? 'Creating…' : 'Create account'}
    </button>
  );
}

export function SignUpForm() {
  const [role, setRole] = useState<UserRole>('driver');
  const [state, action] = useActionState<FormState, FormData>(signUp, {});

  return (
    <>
      <div className="role-pick">
        <button type="button" className={'role-card' + (role === 'driver' ? ' on' : '')}
          aria-pressed={role === 'driver'} onClick={() => setRole('driver')}>
          <span className="rc-ico"><Icon name="truck" size={20} /></span>
          <span className="rc-t">Driver</span>
          <span className="rc-d">I haul freight</span>
        </button>
        <button type="button" className={'role-card' + (role === 'shipper' ? ' on' : '')}
          aria-pressed={role === 'shipper'} onClick={() => setRole('shipper')}>
          <span className="rc-ico"><Icon name="building" size={20} /></span>
          <span className="rc-t">Shipper</span>
          <span className="rc-d">I have freight to move</span>
        </button>
      </div>

      <form action={action}>
        <input type="hidden" name="role" value={role} />

        <div className="field">
          <label htmlFor="full_name">Your name</label>
          <input className="input" id="full_name" name="full_name" required autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="company">{role === 'driver' ? 'Carrier / company' : 'Company'}</label>
          <input className="input" id="company" name="company" autoComplete="organization" />
        </div>

        {role === 'driver' && (
          <>
            <div className="field">
              <label htmlFor="mc_number">MC number</label>
              <input className="input" id="mc_number" name="mc_number" placeholder="MC 1148302" />
            </div>
            <div className="field">
              <label htmlFor="equipment">What do you run?</label>
              <select className="input" id="equipment" name="equipment" defaultValue="box_16">
                {EQUIPMENT_ORDER.map((e) => (
                  <option key={e} value={e}>{EQUIPMENT_LABELS[e]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="home_zip">Home ZIP</label>
              <input className="input" id="home_zip" name="home_zip" inputMode="numeric"
                placeholder="75201" maxLength={5} required />
              <p style={{ fontSize: '.72rem', color: 'var(--ink-4)', margin: '5px 0 0' }}>
                Deadhead on every load is measured from here. You can change it any time.
              </p>
            </div>
          </>
        )}

        <div className="field">
          <label htmlFor="email">Email</label>
          <input className="input" id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" required
            minLength={8} autoComplete="new-password" />
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

        <Submit />
      </form>
    </>
  );
}
