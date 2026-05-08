import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Household Profile — RetireOps',
};

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-ds-background flex flex-col">{children}</div>;
}
