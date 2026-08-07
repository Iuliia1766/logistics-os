import Link from 'next/link';
import { BrandPanel } from '@/components/BrandPanel';
import { SignUpForm } from './SignUpForm';
import type { UserRole } from '@/lib/types';

export default async function SignUpPage({
  searchParams,
}: { searchParams: Promise<{ role?: string }> }) {
  const sp = await searchParams;
  // 'carrier' is what the buttons say; 'driver' is what the database calls it
  const initialRole: UserRole = sp.role === 'shipper' ? 'shipper' : 'driver';

  return (
    <div className="login">
      <BrandPanel />
      <div className="login-form">
        <div className="lf-inner">
          <p className="lf-eyebrow">Create an account</p>
          <h2 className="lf-title">
            {initialRole === 'driver' ? 'Set up your carrier account' : 'Set up your shipper account'}
          </h2>
          <p className="lf-note">
            This choice decides which app you get. It is stored on your organization and
            enforced in the database, so pick the one you actually work as — you can switch
            it here before you sign up, not after.
          </p>

          <SignUpForm initialRole={initialRole} />

          <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', marginTop: 18 }}>
            Already have an account? <Link className="link-btn" href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
