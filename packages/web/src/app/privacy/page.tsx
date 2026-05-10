import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy | RetireOps',
  description: 'How RetireOps collects, uses, and protects user data.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">Privacy Policy</p>
          <h1 className="text-3xl font-bold tracking-tight">How RetireOps handles your data</h1>
          <p className="text-sm text-muted-foreground">
            Effective date: March 9, 2026. This page is a working privacy policy for the hosted
            RetireOps service and should be reviewed before a public launch.
          </p>
        </div>

        <div className="mt-8 space-y-8 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">What we collect</h2>
            <p>
              We may collect account information such as your name, email address, and login
              details. If you use planning features, we may also collect profile, income, account,
              household, and retirement-planning inputs that you enter into the app.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">How we use it</h2>
            <p>
              We use this information to operate the service, save your projections, secure
              accounts, troubleshoot issues, and improve the product. We do not treat this data as a
              request for personalized financial advice.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">What we do not promise</h2>
            <p>
              We work to protect user data, but no online service can guarantee absolute security.
              Retirement and tax estimates may be incomplete, outdated, or wrong.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Sharing and storage</h2>
            <p>
              We may use service providers for hosting, infrastructure, logging, monitoring, and
              backups. We do not sell your personal information. Access to stored data should be
              limited to what is needed to run and maintain the service.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Your choices</h2>
            <p>
              You can choose not to enter sensitive financial information into the hosted version.
              If you prefer full control, you can self-host the source-available version under the
              RetireOps Source Available License instead.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Contact and updates</h2>
            <p>
              This policy will evolve as the hosted service matures. Material updates should be
              reflected on this page before they take effect.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-primary hover:underline">
            Back to home
          </Link>
          <Link href="/terms" className="text-primary hover:underline">
            Read the terms
          </Link>
        </div>
      </div>
    </main>
  );
}
