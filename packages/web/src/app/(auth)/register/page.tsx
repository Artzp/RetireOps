/* eslint-disable @typescript-eslint/no-unsafe-assignment */

/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */

/* eslint-disable @typescript-eslint/no-misused-promises */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LegalNotice } from '@/components/LegalNotice';
import { useToast } from '@/components/ui/use-toast';

const DISCLAIMER_STORAGE_KEY = 'retireops.disclaimer.acceptedAt';

// Returns the ISO timestamp recorded for this acceptance so callers can also
// send it to the backend. Persisting to localStorage is best-effort.
function recordDisclaimerAcceptance(): string {
  const acceptedAt = new Date().toISOString();
  if (typeof window === 'undefined') return acceptedAt;
  try {
    window.localStorage.setItem(DISCLAIMER_STORAGE_KEY, acceptedAt);
  } catch {
    // localStorage may be unavailable (Safari private mode, quota); proceed silently
  }
  return acceptedAt;
}

// Google icon component
function GoogleIcon() {
  return (
    <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/\d/, 'Password must contain at least one number'),
    confirmPassword: z.string(),
    acceptDisclaimer: z.literal(true, {
      message:
        'Please confirm you understand RetireOps is planning software, not financial, tax, or legal advice.',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { acceptDisclaimer: false as unknown as true },
  });

  const password = watch('password', '');
  const acceptDisclaimer = watch('acceptDisclaimer');

  const handleGoogleSignUp = async () => {
    // Force the disclaimer checkbox to validate before leaving the page for Google.
    const ok = await trigger('acceptDisclaimer');
    if (!ok) {
      return;
    }
    setIsGoogleLoading(true);
    try {
      recordDisclaimerAcceptance();
      // Note: the Google OAuth user-creation path stamps disclaimer_accepted_at
      // server-side at NOW() — the gate on this button (acceptDisclaimer === true)
      // is what guarantees acceptance happened.
      const response = await fetch('/api/auth/google/url');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Failed to get Google auth URL');
      }

      // Redirect to Google OAuth
      window.location.href = result.data.url;
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Google Sign-up Failed',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
      setIsGoogleLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return { score: 0, label: '' };
    let score = 0;
    if (pwd.length >= 8) score++;
    if (pwd.length >= 12) score++;
    if (/[a-z]/.test(pwd)) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/\d/.test(pwd)) score++;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pwd)) score++;

    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong', 'Very Strong', 'Excellent'];
    return { score, label: labels[score] || 'Excellent' };
  };

  const strength = getPasswordStrength(password);

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);

    try {
      const disclaimerAcceptedAt = recordDisclaimerAcceptance();
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
          disclaimerAcceptedAt,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error?.message || 'Registration failed');
      }

      // Store tokens
      localStorage.setItem('accessToken', result.data.tokens.accessToken);
      localStorage.setItem('refreshToken', result.data.tokens.refreshToken);

      toast({
        title: 'Account created!',
        description: 'Welcome to RetireOps',
      });

      router.push('/dashboard');
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Registration failed',
        description: error instanceof Error ? error.message : 'An error occurred',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="bg-ds-surface rounded-card shadow-sm">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold font-display">Create an account</CardTitle>
        <CardDescription>Enter your details to create your RetireOps account</CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit(onSubmit)}>
        <CardContent className="space-y-4">
          <LegalNotice compact />
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              autoComplete="name"
              {...register('name')}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              {...register('email')}
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register('password')}
            />
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5, 6].map((level) => (
                    <div
                      key={level}
                      className={`h-1.5 flex-1 rounded-full ${
                        level <= strength.score
                          ? strength.score <= 2
                            ? 'bg-destructive'
                            : strength.score <= 4
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                          : 'bg-muted'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>
            )}
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm Password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <div className="space-y-2 pt-2">
            <div className="flex items-start gap-2">
              <Checkbox
                id="acceptDisclaimer"
                checked={acceptDisclaimer}
                onCheckedChange={(checked) => {
                  setValue(
                    'acceptDisclaimer',
                    checked === true ? true : (false as unknown as true),
                    {
                      shouldValidate: true,
                    }
                  );
                }}
                aria-invalid={errors.acceptDisclaimer ? 'true' : 'false'}
              />
              <Label
                htmlFor="acceptDisclaimer"
                className="text-sm font-normal leading-snug cursor-pointer"
              >
                I understand RetireOps provides planning estimates only and is not financial, tax,
                or legal advice. I will verify important decisions with a qualified professional
                before acting on any result.
              </Label>
            </div>
            {errors.acceptDisclaimer && (
              <p className="text-sm text-destructive">{errors.acceptDisclaimer.message}</p>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4">
          <Button
            type="submit"
            className="w-full rounded-button"
            disabled={isLoading || isGoogleLoading || !acceptDisclaimer}
          >
            {isLoading ? 'Creating account...' : 'Create account'}
          </Button>

          <div className="relative w-full">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-ds-outline-variant" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-ds-surface px-2 text-muted-foreground">Or continue with</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full border-ds-outline-variant"
            onClick={handleGoogleSignUp}
            disabled={isLoading || isGoogleLoading || !acceptDisclaimer}
          >
            <GoogleIcon />
            {isGoogleLoading ? 'Redirecting...' : 'Sign up with Google'}
          </Button>

          <p className="text-sm text-center text-muted-foreground">
            By creating an account, you agree to the{' '}
            <Link href="/terms" className="text-primary hover:underline">
              Terms of Use
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </p>

          <p className="text-sm text-center text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
