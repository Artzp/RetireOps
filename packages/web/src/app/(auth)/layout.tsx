import Link from 'next/link';
import { LegalLinks } from '@/components/LegalLinks';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-ds-secondary flex-col justify-between p-10">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-9 h-9 bg-ds-on-secondary/20 rounded-lg flex items-center justify-center">
            <span className="text-ds-on-secondary font-bold text-xl">R</span>
          </div>
          <span className="font-bold text-2xl text-ds-on-secondary">RetireOps</span>
        </Link>

        <div className="space-y-8">
          <div>
            <h2 className="text-3xl font-bold leading-snug font-display text-ds-on-secondary">
              Plan your Canadian retirement with clearer assumptions
            </h2>
            <p className="mt-3 text-ds-on-secondary/80">
              Estimate CPP, OAS, RRSP, TFSA, and more with a tool built for Canadians and still
              evolving in public.
            </p>
          </div>

          <ul className="space-y-4">
            {[
              'Federal and provincial tax modeling',
              'CPP and OAS timing scenarios',
              'RRSP to RRIF drawdown planning',
              'TFSA tax-free income modeling',
              'Year-by-year cash flow projections',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-ds-on-secondary">
                <div className="h-5 w-5 rounded-full bg-ds-on-secondary/20 flex items-center justify-center flex-shrink-0">
                  <svg
                    className="h-3 w-3 text-ds-on-secondary"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                {feature}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2 text-xs text-ds-on-secondary/60">
          <p>
            &copy; {new Date().getFullYear()} RetireOps. Not financial, tax, or legal advice. Beta
            features and estimates may be incomplete.
          </p>
          <LegalLinks className="justify-start text-ds-on-secondary/80" />
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-ds-background">
        <header className="p-4 lg:hidden">
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-xl">RetireOps</span>
          </Link>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="space-y-2 p-4 text-center text-sm text-muted-foreground lg:hidden">
          <p>
            &copy; {new Date().getFullYear()} RetireOps. Not financial advice. Hosted use is subject
            to the privacy policy and terms.
          </p>
          <LegalLinks />
        </footer>
      </div>
    </div>
  );
}
