import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@/components/Icons';
import './privacy.css';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How Freight Forward Co LLC and Jarvissa collect, use, store, and protect information, '
    + 'including data received from Google APIs.',
  alternates: { canonical: '/privacy' },
};

const UPDATED = 'October 9, 2026';

const SECTIONS = [
  ['information-we-collect', 'Information we collect'],
  ['google-account-data', 'Google account data we access'],
  ['how-jarvissa-uses-google-data', 'How Jarvissa uses Google data'],
  ['google-api-limited-use', 'Google API Services User Data Policy'],
  ['storage-and-security', 'Data storage and security'],
  ['no-sale-of-data', 'We do not sell Google user data'],
  ['no-advertising', 'No advertising use'],
  ['sharing', 'Limited sharing'],
  ['retention-and-deletion', 'Data retention and deletion'],
  ['revoking-google-access', 'How to revoke Google access'],
  ['your-choices', 'Your choices and rights'],
  ['children', 'Children'],
  ['changes', 'Changes to this policy'],
  ['contact', 'Contact us'],
] as const;

export default function PrivacyPolicy() {
  return (
    <div className="landing">
      <header className="ld-nav">
        <div className="ld-nav-inner">
          <Link href="/" className="tb-brand">
            <div className="mark"><Icon name="radio" size={17} /></div>
            <div className="tb-name">
              FreightForward Co.
              <span>Transparent freight</span>
            </div>
          </Link>
          <div className="ld-nav-actions">
            <Link className="btn btn-ghost" href="/">Back to home</Link>
          </div>
        </div>
      </header>

      <main className="ld-main">
        <article className="pp">
          <p className="pp-eyebrow">Legal</p>
          <h1 className="pp-title">Privacy Policy</h1>
          <p className="pp-meta">Last updated: {UPDATED}</p>
          <p className="pp-lede">
            This Privacy Policy explains how Freight Forward Co LLC (&ldquo;Freight Forward
            Co,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, stores, and protects
            information when you use our website at freightforwardco.com and Jarvissa, the
            app we operate (together, the &ldquo;Services&rdquo;). It includes specific
            commitments about data we receive from your Google Account.
          </p>

          <nav className="pp-toc" aria-label="Contents">
            <p className="pp-toc-t">Contents</p>
            <ol>
              {SECTIONS.map(([id, label]) => (
                <li key={id}><a href={`#${id}`}>{label}</a></li>
              ))}
            </ol>
          </nav>

          <section className="pp-sec" id="information-we-collect">
            <h2>1. Information we collect</h2>
            <p>We collect only the information needed to run the Services:</p>
            <ul>
              <li>
                <strong>Account information</strong> you give us when you sign up or edit your
                profile, such as your name, email address, company, role (shipper or carrier),
                MC number, equipment type, and home ZIP code.
              </li>
              <li>
                <strong>Platform activity</strong>, such as loads you post or book, shipment
                status updates, and messages you send through the Services.
              </li>
              <li>
                <strong>Google account data</strong>, only if you choose to connect your
                Google Account to Jarvissa. Details are in Section 2.
              </li>
              <li>
                <strong>Technical information</strong>, such as basic log data and the
                cookies needed to keep you signed in. We do not use advertising cookies.
              </li>
              <li>
                <strong>Communications</strong>, such as emails you send to us for support.
              </li>
            </ul>
          </section>

          <section className="pp-sec" id="google-account-data">
            <h2>2. Google account data we access</h2>
            <p>
              Jarvissa connects to your Google Account through Google&rsquo;s OAuth sign-in. We
              access Google data <strong>only after you review and approve the permissions
              on Google&rsquo;s consent screen</strong>, and only to the extent of the permissions
              you approve. Depending on what you approve, this may include:
            </p>
            <ul>
              <li>
                <strong>Basic profile and email address</strong> &mdash; your name, email
                address, and profile information, used to identify your account.
              </li>
              <li>
                <strong>Gmail</strong> &mdash; your email messages, threads, labels, and related
                metadata. If you approve the corresponding permissions, Jarvissa can also
                compose and send messages and manage your mail (for example, applying labels
                or moving messages to Trash).
              </li>
              <li>
                <strong>Google Calendar</strong> &mdash; your calendars, events, and
                availability and, if you approve it, creating and changing events.
              </li>
              <li>
                <strong>Google Sheets</strong> &mdash; spreadsheets you connect or allow
                Jarvissa to open, their contents and, if you approve it, edits to them.
              </li>
              <li>
                <strong>Google Contacts</strong> (optional) &mdash; names and contact details
                from your contacts, only if you enable the Contacts integration.
              </li>
              <li>
                <strong>Google Drive</strong> (optional) &mdash; files that Jarvissa creates or
                that you open with it and, if you enable it, a list of your files with their
                names and metadata.
              </li>
            </ul>
            <p>
              We refer to this information as &ldquo;Google user data.&rdquo; You can decline
              or limit any of these permissions, and you can withdraw them at any time (see
              Section 10).
            </p>
          </section>

          <section className="pp-sec" id="how-jarvissa-uses-google-data">
            <h2>3. How Jarvissa uses Google data</h2>
            <p>
              Jarvissa uses Google user data <strong>only to provide and improve the
              user-facing features you can see and use in Jarvissa</strong> &mdash; for
              example, working with your email, calendar, and spreadsheets at your direction,
              and showing your connected account details. Specifically:
            </p>
            <ul>
              <li>
                We use the data to carry out the tasks you ask Jarvissa to perform. To do so,
                Jarvissa may send the relevant content to an AI model provider, as described in
                Section 8.
              </li>
              <li>We do not use Google user data for any purpose unrelated to those features.</li>
              <li>
                We do not use Google user data to develop, improve, or train generalized
                artificial-intelligence or machine-learning models.
              </li>
            </ul>
          </section>

          <section className="pp-sec" id="google-api-limited-use">
            <h2>4. Google API Services User Data Policy</h2>
            <div className="pp-callout">
              <p>
                Freight Forward Co LLC&rsquo;s and Jarvissa&rsquo;s use and transfer to any other
                app of information received from Google APIs will adhere to the{' '}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements.
              </p>
            </div>
            <p>In line with the Limited Use requirements:</p>
            <ul>
              <li>
                We use Google user data only to provide or improve user-facing features that
                are prominent in Jarvissa&rsquo;s interface.
              </li>
              <li>
                We transfer Google user data to others only to provide or improve those
                features, to comply with applicable law, for security purposes (such as
                investigating abuse), or as part of a merger, acquisition, or sale of assets
                after notice to you.
              </li>
              <li>We do not use or transfer Google user data for serving advertisements.</li>
              <li>
                We do not allow humans to read Google user data unless we have your
                affirmative consent for specific messages or files, it is necessary for
                security purposes such as investigating abuse, it is necessary to comply with
                applicable law, or the data is aggregated and anonymized for internal
                operations.
              </li>
            </ul>
          </section>

          <section className="pp-sec" id="storage-and-security">
            <h2>5. Data storage and security</h2>
            <p>
              We protect your information with industry-standard safeguards, including
              encryption in transit (HTTPS/TLS), encryption at rest provided by our
              infrastructure providers, and access controls that limit who can reach
              data to the people who need it to operate and support the Services.
            </p>
            <p>
              Google authorization tokens are stored securely and used only to act on your
              behalf within the permissions you granted. No method of transmission or
              storage is perfectly secure, so we cannot guarantee absolute security. If we
              learn of a breach affecting your information, we will notify you as required
              by law.
            </p>
          </section>

          <section className="pp-sec" id="no-sale-of-data">
            <h2>6. We do not sell Google user data</h2>
            <p>
              We do not sell Google user data, and we do not rent or trade it. We do not sell
              any of your personal information.
            </p>
          </section>

          <section className="pp-sec" id="no-advertising">
            <h2>7. No advertising use</h2>
            <p>
              We do not use Google user data for advertising of any kind &mdash; including
              retargeting, personalized advertising, or interest-based advertising &mdash; and
              we do not allow anyone else to use it for those purposes.
            </p>
          </section>

          <section className="pp-sec" id="sharing">
            <h2>8. Limited sharing</h2>
            <p>
              We share information only as needed to operate the Services:
            </p>
            <ul>
              <li>
                <strong>Service providers</strong> that host our infrastructure, store our
                data, or otherwise help us run the Services. They may process information only
                on our instructions, for the purpose of providing their service to us, and
                under obligations to keep it confidential and secure.
              </li>
              <li>
                <strong>AI model provider.</strong> When you ask Jarvissa to work with your
                content (for example, an email you want summarized), that content is sent to
                our AI model provider, currently Anthropic, solely to generate the result you
                requested. Under Anthropic&rsquo;s commercial terms, content sent through its API
                is not used to train its models.
              </li>
              <li>
                <strong>Legal and safety reasons</strong>, when required by law or to protect
                the rights, safety, and security of our users and the Services.
              </li>
              <li>
                <strong>Business transfers</strong>, such as a merger or acquisition, after
                notice to you.
              </li>
            </ul>
            <p>
              Google user data is shared only as described in Section 4. Within the platform,
              shipment details are visible to the other parties to a load (for example, the
              shipper and the carrier) so the load can be completed.
            </p>
          </section>

          <section className="pp-sec" id="retention-and-deletion">
            <h2>9. Data retention and deletion</h2>
            <p>
              We keep Google user data only for as long as it is needed to provide the features
              you use while your Google Account is connected to Jarvissa.
            </p>
            <ul>
              <li>
                If you disconnect your Google Account or revoke access, we stop accessing your
                Google data and delete the Google user data and authorization tokens we hold
                for you promptly, and no later than 30 days afterward.
              </li>
              <li>
                You can ask us to delete your account and associated data at any time by
                emailing{' '}
                <a href="mailto:ops@freightforwardco.com">ops@freightforwardco.com</a>. We
                will confirm your identity and complete the request within 30 days.
              </li>
              <li>
                We may keep limited records where the law requires it (for example, shipment,
                invoicing, or tax records) or where needed to resolve disputes and enforce our
                agreements. Google user data is not retained for these purposes.
              </li>
            </ul>
          </section>

          <section className="pp-sec" id="revoking-google-access">
            <h2>10. How to revoke Google access</h2>
            <p>You can withdraw Jarvissa&rsquo;s access to your Google Account at any time:</p>
            <ul>
              <li>
                Go to your{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Google Account permissions page
                </a>{' '}
                (Google Account &rarr; Security &rarr; Third-party apps &amp; services).
              </li>
              <li>Select <strong>Jarvissa</strong>, then choose <strong>Delete all connections</strong>.</li>
              <li>
                Or email us at{' '}
                <a href="mailto:ops@freightforwardco.com">ops@freightforwardco.com</a> and we
                will disconnect your account and delete the data as described in Section 9.
              </li>
            </ul>
            <p>
              Once access is revoked, Jarvissa can no longer read or change your Google data.
            </p>
          </section>

          <section className="pp-sec" id="your-choices">
            <h2>11. Your choices and rights</h2>
            <p>
              You can review and update your account details in the Services at any time.
              Depending on where you live, you may also have the right to request access to,
              correction of, or deletion of your personal information, and to object to or
              restrict certain processing. To make a request, contact us at{' '}
              <a href="mailto:ops@freightforwardco.com">ops@freightforwardco.com</a>.
            </p>
          </section>

          <section className="pp-sec" id="children">
            <h2>12. Children</h2>
            <p>
              The Services are intended for businesses and are not directed to anyone under 18.
              We do not knowingly collect personal information from children.
            </p>
          </section>

          <section className="pp-sec" id="changes">
            <h2>13. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. When we do, we will change
              the &ldquo;Last updated&rdquo; date above, and for material changes we will give
              additional notice. We will not expand how we use Google user data beyond what is
              described here without first obtaining your consent where required.
            </p>
          </section>

          <section className="pp-sec" id="contact">
            <h2>14. Contact us</h2>
            <p>
              Freight Forward Co LLC
              <br />
              Email: <a href="mailto:ops@freightforwardco.com">ops@freightforwardco.com</a>
              <br />
              Phone: <a href="tel:+17472412929">(747) 241-2929</a>
            </p>
          </section>
        </article>
      </main>

      <footer className="ld-foot">
        <div className="ld-foot-top">
          <div className="tb-brand">
            <div className="mark"><Icon name="radio" size={16} /></div>
            <div className="tb-name">
              FreightForward Co.
              <span>Transparent freight. From pickup to delivery.</span>
            </div>
          </div>
          <nav className="ld-foot-links" aria-label="Footer">
            <Link href="/">Home</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/login">Sign in</Link>
          </nav>
        </div>
        <div className="ld-foot-contact">
          <a href="mailto:ops@freightforwardco.com">
            <Icon name="msg" size={14} /> ops@freightforwardco.com
          </a>
          <a href="tel:+17472412929">
            <Icon name="phone" size={14} /> (747) 241-2929
          </a>
        </div>
        <div className="ld-foot-bot">
          <span>freightforwardco.com</span>
          <span>&copy; Freight Forward Co LLC</span>
        </div>
      </footer>
    </div>
  );
}
