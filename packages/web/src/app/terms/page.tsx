import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Use | RetireOps',
  description: 'Terms for using the hosted RetireOps service.',
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">Terms of Use</p>
          <h1 className="text-3xl font-bold tracking-tight">Terms for the hosted service</h1>
          <p className="text-sm text-muted-foreground">
            Effective date: March 9, 2026. These terms are a baseline for public hosting and should
            be reviewed before production launch.
          </p>
        </div>

        <div className="mt-8 space-y-8 text-sm leading-6 text-muted-foreground">
          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Planning tool, not advice</h2>
            <p>
              RetireOps is provided for education and planning support only. It does not provide
              financial advice, tax advice, legal advice, or a fiduciary relationship.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Beta limitations</h2>
            <p>
              Some features are incomplete, in beta, or based on assumptions that may change.
              Outputs may contain errors or use outdated tax or benefit data.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">User responsibility</h2>
            <p>
              You are responsible for reviewing any result before acting on it. Important financial,
              retirement, tax, and estate decisions should be confirmed with a qualified
              professional.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Availability and accounts</h2>
            <p>
              We may change, suspend, or remove features at any time. You are responsible for
              maintaining the confidentiality of your account credentials.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Liability</h2>
            <p>
              The hosted service is provided as-is, without warranties of accuracy, completeness,
              merchantability, or fitness for a particular purpose, to the extent allowed by law.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Open source code</h2>
            <p>
              The codebase is available under the AGPL. Self-hosting is allowed under that license,
              and hosted users should be able to obtain the corresponding source for the running
              version.
            </p>
          </section>
        </div>

        <div className="mt-10 flex flex-wrap gap-4 text-sm">
          <Link href="/" className="text-primary hover:underline">
            Back to home
          </Link>
          <Link href="/privacy" className="text-primary hover:underline">
            Read the privacy policy
          </Link>
        </div>
      </div>
    </main>
  );
}
