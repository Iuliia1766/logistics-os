import Link from 'next/link';
import { LoginForm } from './LoginForm';
import { BrandPanel } from '@/components/BrandPanel';

export default async function LoginPage({
  searchParams,
}: { searchParams: Promise<{ check_email?: string; role?: string; no_profile?: string }> }) {
  const sp = await searchParams;

  return (
    <div className="login">
      <BrandPanel />
      <div className="login-form">
        <div className="lf-inner">
          <p className="lf-eyebrow">Sign in</p>
          <h2 className="lf-title">Choose your account</h2>
          <p className="lf-note">
            Driver and shipper accounts open completely different apps — different data,
            different actions, one shared ledger underneath.
          </p>

          {sp.check_email && (
            <div className="demo-hint" style={{ marginBottom: 16 }}>
              <b>Check your email.</b> Confirm the address, then sign in here.
            </div>
          )}
          {sp.no_profile && (
            <div className="demo-hint" style={{ marginBottom: 16 }}>
              <b>That account has no profile yet.</b> Sign up again to finish setting it up.
            </div>
          )}

          <LoginForm initialRole={sp.role === 'shipper' ? 'shipper' : 'driver'} />

          <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', marginTop: 18 }}>
            No account yet? <Link className="link-btn" href="/signup">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
