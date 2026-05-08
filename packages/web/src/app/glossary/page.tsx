import type { Metadata } from 'next';
import Link from 'next/link';
import { GLOSSARY_TERMS, GLOSSARY_FAQ_DATA } from './glossary-data';

export const metadata: Metadata = {
  title: 'Glossary & FAQ | RetireOps',
  description:
    'Plain-language definitions of Canadian retirement terms used in RetireOps: RRSP, TFSA, RRIF, LIRA, LIF, ACB, CPP, OAS, GIS, and nominal vs real dollars.',
};

export default function GlossaryPage() {
  return (
    <main className="min-h-screen bg-muted/30 px-4 py-12">
      <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-8 shadow-sm">
        <div className="space-y-3">
          <p className="text-sm font-medium text-primary">Glossary &amp; FAQ</p>
          <h1 className="text-3xl font-bold tracking-tight">
            Canadian retirement terms, in plain language
          </h1>
          <p className="text-sm text-muted-foreground">
            Quick definitions of the acronyms and concepts you&apos;ll see in the wizard, your
            projection results, and the reverse calculator. Each entry links from the field
            it&apos;s about, so you don&apos;t have to memorize anything.
          </p>
        </div>

        {/* In-page TOC */}
        <nav aria-label="Glossary terms" className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Jump to a term
          </p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-sm">
            {GLOSSARY_TERMS.map((t) => (
              <li key={t.id}>
                <Link href={`#${t.id}`} className="text-primary hover:underline">
                  {t.term}
                </Link>
              </li>
            ))}
            <li>
              <Link href="#faq" className="text-primary hover:underline">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="#official-resources" className="text-primary hover:underline">
                Official resources
              </Link>
            </li>
          </ul>
        </nav>

        {/* Terms section */}
        <div className="mt-10 space-y-12 text-sm leading-6">
          <section id="account-types" className="scroll-mt-8 space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Account types</h2>
            <p className="text-muted-foreground">
              The wizard&apos;s Accounts step asks you to enter every retirement-related account you
              hold. Below is a refresher on what each acronym means and the tax rules that shape
              RetireOps&apos; projections.
            </p>
          </section>

          {GLOSSARY_TERMS.map((term) => (
            <section
              key={term.id}
              id={term.id}
              className="scroll-mt-8 space-y-3 border-t border-border pt-8"
            >
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {term.term}
                  {term.expansion && (
                    <span className="ml-2 text-base font-normal text-muted-foreground">
                      — {term.expansion}
                    </span>
                  )}
                </h2>
                <p className="mt-1 text-base font-medium text-foreground/90">{term.oneLiner}</p>
              </div>

              <div className="space-y-3 text-muted-foreground">
                {term.paragraphs.map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
              </div>

              {term.bullets && term.bullets.length > 0 && (
                <ul className="ml-5 list-disc space-y-1 text-muted-foreground">
                  {term.bullets.map((b, idx) => (
                    <li key={idx}>{b}</li>
                  ))}
                </ul>
              )}

              {term.related && term.related.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Related:{' '}
                  {term.related.map((relId, idx) => {
                    const related = GLOSSARY_TERMS.find((t) => t.id === relId);
                    if (!related) return null;
                    return (
                      <span key={relId}>
                        {idx > 0 && ', '}
                        <Link href={`#${relId}`} className="text-primary hover:underline">
                          {related.term}
                        </Link>
                      </span>
                    );
                  })}
                </p>
              )}

              <p className="text-xs text-muted-foreground/70">
                Source: <code className="font-mono">{term.source}</code>
              </p>
            </section>
          ))}

          {/* FAQ section */}
          <section id="faq" className="scroll-mt-8 space-y-4 border-t border-border pt-10">
            <h2 className="text-2xl font-bold text-foreground">FAQ</h2>
            <p className="text-muted-foreground">
              Cross-cutting questions that come up while building a plan.
            </p>

            <div className="space-y-3">
              {GLOSSARY_FAQ_DATA.map((faq) => (
                <details
                  key={faq.id}
                  id={faq.id}
                  className="group scroll-mt-8 rounded-lg border border-border bg-background p-4 open:bg-muted/40"
                >
                  <summary className="cursor-pointer list-none text-base font-semibold text-foreground marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ds-primary">
                    <span className="mr-2 inline-block transition-transform group-open:rotate-90">
                      ▸
                    </span>
                    {faq.question}
                  </summary>
                  <div className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                    {faq.paragraphs.map((p, idx) => (
                      <p key={idx}>{p}</p>
                    ))}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* Official resources — direct links to CRA / Service Canada portals
              so users can pull their actual numbers (CPP estimate, OAS residency,
              contribution room) instead of guessing. */}
          <section
            id="official-resources"
            className="scroll-mt-8 space-y-3 border-t border-border pt-10"
          >
            <h2 className="text-2xl font-bold text-foreground">Official resources</h2>
            <p className="text-muted-foreground">
              The most accurate inputs to your projection come from your own CRA and Service Canada
              accounts. These are the official portals.
            </p>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="https://www.canada.ca/en/revenue-agency/services/e-services/cra-my-account.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  CRA My Account ↗
                </a>{' '}
                <span className="text-muted-foreground">
                  — RRSP / TFSA / FHSA contribution room, T-slips, prior-year notices.
                </span>
              </li>
              <li>
                <a
                  href="https://www.canada.ca/en/employment-social-development/services/my-account.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  My Service Canada Account ↗
                </a>{' '}
                <span className="text-muted-foreground">
                  — your CPP statement of contributions, estimated CPP at 65, and OAS residency
                  history.
                </span>
              </li>
              <li>
                <a
                  href="https://www.canada.ca/en/services/benefits/publicpensions/cpp/old-age-security/recovery-tax.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  OAS Recovery Tax (clawback) reference ↗
                </a>{' '}
                <span className="text-muted-foreground">
                  — official thresholds and the recovery-tax calculation.
                </span>
              </li>
              <li>
                <a
                  href="https://www.canada.ca/en/revenue-agency/services/forms-publications/tax-packages-years/general-income-tax-benefit-package.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  CRA tax packages (federal + provincial) ↗
                </a>{' '}
                <span className="text-muted-foreground">
                  — bracket tables and credit amounts used in the projection.
                </span>
              </li>
            </ul>
          </section>

          <div className="border-t border-border pt-6 text-xs text-muted-foreground">
            <p>
              The definitions above are written for RetireOps users and are not tax or legal advice.
              Authoritative rules live in CRA publications and the source-of-truth documents inside
              the codebase. Verify important decisions with a qualified professional.
            </p>
            <p className="mt-3">
              <Link href="/" className="text-primary hover:underline">
                ← Back to RetireOps
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
