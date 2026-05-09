import Link from 'next/link';
import { Calculator, BadgeDollarSign, PiggyBank } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LegalLinks } from '@/components/LegalLinks';
import { LegalNotice } from '@/components/LegalNotice';
import { FeedbackLink } from '@/components/FeedbackLink';

export default function HomePage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky glassmorphism nav — LAND-03 */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-ds-surface-container/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-ds-primary rounded-lg flex items-center justify-center">
              <span className="text-ds-on-primary font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-xl text-ds-on-secondary">RetireOps</span>
          </div>
          <nav className="flex items-center space-x-4">
            <Link href="/login">
              <Button variant="ghost" className="text-ds-on-secondary hover:bg-ds-on-secondary/10">
                Sign In
              </Button>
            </Link>
            <Link href="/register">
              <Button className="bg-ds-primary text-ds-on-primary rounded-button hover:bg-ds-primary-fixed-dim">
                Get Started
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — LAND-01 */}
        <section className="bg-ds-secondary py-28 md:py-36 px-4 text-center">
          <div className="container mx-auto max-w-4xl">
            <h1 className="font-display text-5xl md:text-7xl font-extrabold tracking-tight text-ds-on-secondary mb-6">
              Plan Your Canadian Retirement with Confidence
            </h1>
            <p className="text-xl text-ds-on-secondary/80 mb-8 max-w-2xl mx-auto">
              Comprehensive retirement planning software designed specifically for Canadians. Model
              your CPP, OAS, RRSP, and TFSA with transparent assumptions and year-by-year estimates.
            </p>
            <div className="mx-auto mb-8 max-w-3xl">
              <LegalNotice compact />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/register">
                <Button
                  size="lg"
                  className="w-full sm:w-auto bg-ds-primary text-ds-on-primary rounded-button hover:bg-ds-primary-fixed-dim"
                >
                  Start Planning Free
                </Button>
              </Link>
              <Link href="#features">
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full sm:w-auto text-ds-on-secondary border border-ds-on-secondary/40 hover:bg-ds-on-secondary/10"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features — LAND-02 */}
        <section id="features" className="bg-ds-surface-raised py-20 px-4">
          <div className="container mx-auto max-w-6xl">
            <h2 className="font-display text-3xl font-extrabold text-center text-ds-on-background mb-12">
              Everything You Need for Retirement Planning
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={Calculator}
                title="Canadian Tax Accuracy"
                description="See how federal and provincial taxes affect your retirement income across all 13 provinces and territories."
              />
              <FeatureCard
                icon={BadgeDollarSign}
                title="CPP & OAS Benefits"
                description="Estimate your CPP, OAS, and GIS benefits based on the information you provide and the rules currently modeled in the app."
              />
              <FeatureCard
                icon={PiggyBank}
                title="RRSP & RRIF Modeling"
                description="Optimize withdrawals from RRSP, RRIF, TFSA, and non-registered accounts to minimize lifetime taxes."
              />
            </div>
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-ds-secondary py-20 px-4 text-center">
          <div className="container mx-auto max-w-2xl">
            <h2 className="font-display text-3xl font-extrabold text-ds-on-secondary mb-4">
              Ready to Take Control of Your Retirement?
            </h2>
            <p className="text-ds-on-secondary/80 mb-8">
              Use the hosted app or self-host the open source version for personal planning.
            </p>
            <Link href="/register">
              <Button
                size="lg"
                className="bg-ds-primary text-ds-on-primary rounded-button hover:bg-ds-primary-fixed-dim"
              >
                Create Your Free Account
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-ds-surface-raised py-8 px-4">
        <div className="container mx-auto text-center text-base text-ds-on-surface-variant">
          <p>&copy; {new Date().getFullYear()} RetireOps.</p>
          <p className="mt-2">
            Not financial, tax, or legal advice. Estimates may be incomplete or inaccurate. Verify
            important decisions with a qualified professional before acting on any result.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm">
            <LegalLinks />
            <FeedbackLink />
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <div className="bg-ds-surface rounded-card shadow-sm p-6">
      <Icon className="w-8 h-8 text-ds-primary mb-4" />
      <h3 className="text-base font-extrabold text-ds-on-surface mb-2">{title}</h3>
      <p className="text-base text-ds-on-surface-variant">{description}</p>
    </div>
  );
}
