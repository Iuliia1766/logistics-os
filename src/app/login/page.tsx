import Link from 'next/link';
import { LoginForm } from './LoginForm';
import { BrandPanel } from '@/components/BrandPanel';
import { Icon } from '@/components/Icons';

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
            Carrier and shipper accounts open completely different apps — different data,
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

          {/* Two doors, because the two accounts ask for different things
              up front — a carrier needs authority and a home ZIP. */}
          <div className="signup-cta">
            <span className="signup-lead">New here? Create an account</span>
            <div className="signup-actions">
              <Link className="signup-btn" href="/signup?role=carrier">
                <span className="sb-ico"><Icon name="truck" size={18} /></span>
                <span className="sb-text">
                  <span className="sb-t">Sign up as a Carrier</span>
                  <span className="sb-d">I haul freight</span>
                </span>
                <Icon name="arrow" size={15} className="sb-arrow" />
              </Link>
              <Link className="signup-btn" href="/signup?role=shipper">
                <span className="sb-ico"><Icon name="building" size={18} /></span>
                <span className="sb-text">
                  <span className="sb-t">Sign up as a Shipper</span>
                  <span className="sb-d">I have freight to move</span>
                </span>
                <Icon name="arrow" size={15} className="sb-arrow" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
