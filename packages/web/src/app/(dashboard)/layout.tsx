'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  GitCompare,
  FileText,
  Settings,
  Menu,
  X,
  LogOut,
  User,
  ChevronDown,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LegalLinks } from '@/components/LegalLinks';
import { FeedbackLink } from '@/components/FeedbackLink';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Profile', href: '/profile', icon: User },
  { name: 'Scenarios', href: '/profile/scenarios', icon: GitCompare },
  { name: 'Reports', href: '/reports', icon: FileText },
  { name: 'Glossary', href: '/glossary', icon: BookOpen },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ds-scrim/50 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-64 bg-ds-surface-container/80 backdrop-blur-md transform transition-transform duration-200 ease-in-out lg:translate-x-0 print:hidden',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">R</span>
            </div>
            <span className="font-bold text-xl text-ds-inverse-on-surface">RetireOps</span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5 text-ds-inverse-on-surface" />
          </Button>
        </div>

        <nav className="flex flex-col gap-1 p-4">
          {navigation.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground rounded-lg px-3 py-2.5'
                    : 'text-ds-inverse-on-surface/70 hover:bg-ds-on-secondary/10 hover:text-ds-inverse-on-surface rounded-lg px-3 py-2.5'
                )}
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64 print:pl-0">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 bg-ds-surface-container/80 backdrop-blur-md px-4 lg:px-6 print:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-5 w-5 text-ds-inverse-on-surface" />
          </Button>

          <div className="flex-1" />

          {/* User menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-full bg-ds-primary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <ChevronDown className="h-4 w-4 text-ds-inverse-on-surface/70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-ds-surface rounded-card shadow-lg">
              <DropdownMenuItem asChild>
                <Link href="/settings" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="flex items-center gap-2 text-ds-error hover:bg-ds-error-container"
                onClick={() => {
                  localStorage.removeItem('accessToken');
                  localStorage.removeItem('refreshToken');
                  window.location.href = '/login';
                }}
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Page content */}
        <main className="overflow-x-hidden p-4 lg:p-6 print:p-0">
          <div className="mb-4 rounded-card bg-ds-tertiary-container text-ds-on-tertiary-container px-4 py-3 text-sm print:hidden">
            Results are planning estimates, not financial advice. Some calculations and beta
            features may be incomplete.
          </div>
          {children}
        </main>
        <footer className="bg-ds-surface-raised px-4 py-4 text-center text-sm text-muted-foreground lg:px-6 print:hidden">
          <p>
            Not financial, tax, or legal advice. Estimates may be incomplete or inaccurate. Verify
            important decisions with a qualified professional before acting on any result.
          </p>
          <p className="mt-2 text-xs">
            Hosted RetireOps stores planning data to provide the service. Review the privacy policy
            and terms before relying on any result.
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <LegalLinks />
            <FeedbackLink />
          </div>
        </footer>
      </div>
    </div>
  );
}
