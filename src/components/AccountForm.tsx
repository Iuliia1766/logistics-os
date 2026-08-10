'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from './Icons';
import { Toast } from './Toast';
import { saveProfile } from '@/app/actions/account';
import { EQUIPMENT_LABELS, EQUIPMENT_ORDER, type Profile, type UserRole } from '@/lib/types';

export function AccountForm({ profile, email }: { profile: Profile | null; email: string }) {
  const router = useRouter();
  const isNew = profile === null;
  // Only a brand-new profile gets to pick a side; changing it later
  // would orphan the loads already attached to the other portal.
  const [role, setRole] = useState<UserRole>(profile?.role ?? 'driver');
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const isCarrier = role === 'driver';

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await saveProfile(formData);
      setToast(res.message);
      if (res.ok) {
        router.refresh();
        if (isNew) router.push(res.ref === 'driver' ? '/driver' : '/shipper');
      }
    });
  }

  return (
    <>
      <div className="page-head">
        <h1 className="h1">{isNew ? 'Finish setting up your account' : 'Your profile'}</h1>
        <p className="sub">
          {isNew
            ? 'Your sign-in works, but the profile behind it was never created. Fill this in and you are through.'
            : 'This is what carriers, shippers and dispatch see when they deal with you.'}
        </p>
      </div>

      <div style={{ maxWidth: '38rem' }}>
        <form className="card" action={onSubmit}>
          <input type="hidden" name="role" value={role} />

          {isNew ? (
            <>
              <div className="dt-label" style={{ marginBottom: 8 }}>Account type</div>
              <div className="role-pick">
                <button type="button" className={'role-card' + (isCarrier ? ' on' : '')}
                  aria-pressed={isCarrier} onClick={() => setRole('driver')}>
                  <span className="rc-ico"><Icon name="truck" size={20} /></span>
                  <span className="rc-t">Carrier</span>
                  <span className="rc-d">I haul freight</span>
                </button>
                <button type="button" className={'role-card' + (!isCarrier ? ' on' : '')}
                  aria-pressed={!isCarrier} onClick={() => setRole('shipper')}>
                  <span className="rc-ico"><Icon name="building" size={20} /></span>
                  <span className="rc-t">Shipper</span>
                  <span className="rc-d">I have freight to move</span>
                </button>
              </div>
            </>
          ) : (
            <div className="acct-type">
              <span className="acct-type-ico">
                <Icon name={isCarrier ? 'truck' : 'building'} size={16} />
              </span>
              <div>
                <div className="acct-type-t">{isCarrier ? 'Carrier account' : 'Shipper account'}</div>
                <div className="acct-type-d">
                  Fixed once the account exists — loads are attached to it.
                </div>
              </div>
            </div>
          )}

          <div className="field">
            <label htmlFor="acct-email">Email</label>
            <input className="input" id="acct-email" value={email} disabled readOnly />
            <p className="field-note">Change this from your email provider&rsquo;s confirmation link.</p>
          </div>

          <div className="field">
            <label htmlFor="full_name">Your name</label>
            <input className="input" id="full_name" name="full_name" required autoComplete="name"
              defaultValue={profile?.full_name ?? ''} />
          </div>

          <div className="field">
            <label htmlFor="company">{isCarrier ? 'Carrier name' : 'Company'}</label>
            <input className="input" id="company" name="company" autoComplete="organization"
              defaultValue={profile?.company ?? ''} />
          </div>

          {isCarrier && (
            <>
              <div className="field">
                <label htmlFor="mc_number">MC number</label>
                <input className="input" id="mc_number" name="mc_number" placeholder="MC 1148302"
                  defaultValue={profile?.mc_number ?? ''} />
                <p className="field-note">Shippers check this before they hand you freight.</p>
              </div>

              <div className="field">
                <label htmlFor="equipment">What do you run?</label>
                <select className="input" id="equipment" name="equipment"
                  defaultValue={profile?.equipment ?? 'box_16'}>
                  {EQUIPMENT_ORDER.map((e) => (
                    <option key={e} value={e}>{EQUIPMENT_LABELS[e]}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="home_zip">Home ZIP</label>
                <input className="input" id="home_zip" name="home_zip" inputMode="numeric"
                  maxLength={5} placeholder="75201" defaultValue={profile?.home_zip ?? ''} />
                <p className="field-note">Deadhead on every load is measured from here.</p>
              </div>
            </>
          )}

          <button className="btn btn-primary" type="submit" disabled={pending}
            style={{ width: '100%', marginTop: 4 }}>
            {pending ? 'Saving…' : isNew ? 'Create my profile' : 'Save changes'}
          </button>
        </form>

        {!isNew && (
          <p className="field-note" style={{ marginTop: 12 }}>
            Signed in as {email}.{' '}
            <a className="link-btn" href={isCarrier ? '/driver' : '/shipper'}>Back to your loads</a>
          </p>
        )}
      </div>

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
