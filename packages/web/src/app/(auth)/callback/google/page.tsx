/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/restrict-template-expressions */
/* eslint-disable @typescript-eslint/no-floating-promises */
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get('code');
      const error = searchParams.get('error');

      if (error) {
        setStatus('error');
        setErrorMessage(error === 'access_denied' ? 'Access was denied' : error);
        return;
      }

      if (!code) {
        setStatus('error');
        setErrorMessage('No authorization code received');
        return;
      }

      try {
        const response = await fetch('/api/auth/google/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error?.message || 'Authentication failed');
        }

        // Store tokens
        localStorage.setItem('accessToken', result.data.tokens.accessToken);
        localStorage.setItem('refreshToken', result.data.tokens.refreshToken);

        toast({
          title: result.data.isNewUser ? 'Account created!' : 'Welcome back!',
          description: `Signed in as ${result.data.user.email}`,
        });

        router.push('/dashboard');
      } catch (error) {
        setStatus('error');
        setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
      }
    };

    handleCallback();
  }, [searchParams, router, toast]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">
          {status === 'loading' ? 'Signing in with Google...' : 'Sign in failed'}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        {status === 'loading' ? (
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-muted-foreground">Please wait...</span>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <p className="text-destructive">{errorMessage}</p>
            <a href="/login" className="text-primary hover:underline">
              Back to login
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LoadingFallback() {
  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Signing in with Google...</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center space-y-4">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-muted-foreground">Please wait...</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <GoogleCallbackContent />
    </Suspense>
  );
}
