import Link from 'next/link';
import { BrandPanel } from '@/components/BrandPanel';
import { SignUpForm } from './SignUpForm';

export default function SignUpPage() {
  return (
    <div className="login">
      <BrandPanel />
      <div className="login-form">
        <div className="lf-inner">
          <p className="lf-eyebrow">Create an account</p>
          <h2 className="lf-title">Which side are you on?</h2>
          <p className="lf-note">
            This choice decides which app you get. It is stored on your profile and
            enforced in the database, so pick the one you actually work as.
          </p>

          <SignUpForm />

          <p style={{ fontSize: '.8rem', color: 'var(--ink-3)', marginTop: 18 }}>
            Already have an account? <Link className="link-btn" href="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
