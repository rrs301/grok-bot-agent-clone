'use client';

import React, { useState, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/workspace';
  const urlError = searchParams.get('error');

  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(
    urlError === 'OAuthSignin' || urlError === 'OAuthCallback'
      ? 'Error connecting with OAuth provider. Please check your credentials.'
      : null
  );

  const handleOAuthSignIn = (provider: 'google' | 'github') => {
    setOauthLoading(provider);
    setError(null);
    signIn(provider, { callbackUrl });
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.header}>
          <Link href="/" style={styles.badge}>
            ← Back to Home
          </Link>
          <h1 style={styles.title}>Welcome Back</h1>
          <p style={styles.subtitle}>Sign in with your preferred provider to access your account.</p>
        </div>

        {error && (
          <div style={styles.errorAlert}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        <div style={styles.oauthGroup}>
          <button
            type="button"
            onClick={() => handleOAuthSignIn('google')}
            disabled={!!oauthLoading}
            style={styles.googleButton}
          >
            <svg style={styles.oauthIcon} viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            {oauthLoading === 'google' ? 'Connecting...' : 'Continue with Google'}
          </button>

          <button
            type="button"
            onClick={() => handleOAuthSignIn('github')}
            disabled={!!oauthLoading}
            style={styles.githubButton}
          >
            <svg style={styles.oauthIcon} viewBox="0 0 24 24" fill="currentColor">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            {oauthLoading === 'github' ? 'Connecting...' : 'Continue with GitHub'}
          </button>
        </div>

        <div style={styles.footer}>
          <p style={styles.footerText}>
            Don&apos;t have an account?{' '}
            <Link href="/sign-up" style={styles.footerLink}>
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div style={styles.loadingContainer}>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    color: '#0f172a',
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: '1.5rem',
    boxSizing: 'border-box',
  },
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    color: '#64748b',
    fontFamily: 'system-ui, sans-serif',
  },
  card: {
    width: '100%',
    maxWidth: '420px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '16px',
    padding: '2.5rem',
    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '2rem',
  },
  badge: {
    display: 'inline-block',
    fontSize: '0.8rem',
    fontWeight: 500,
    color: '#64748b',
    textDecoration: 'none',
    marginBottom: '1.25rem',
    padding: '0.35rem 0.85rem',
    borderRadius: '9999px',
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
  },
  title: {
    fontSize: '1.75rem',
    fontWeight: 700,
    letterSpacing: '-0.025em',
    margin: '0 0 0.5rem 0',
    color: '#0f172a',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    lineHeight: 1.5,
    margin: 0,
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    padding: '0.75rem 1rem',
    borderRadius: '8px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    fontSize: '0.875rem',
    marginBottom: '1.5rem',
  },
  oauthGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  googleButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    backgroundColor: '#ffffff',
    color: '#1e293b',
    border: '1px solid #cbd5e1',
    fontSize: '0.925rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s, border-color 0.2s',
  },
  githubButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.75rem',
    width: '100%',
    padding: '0.85rem 1rem',
    borderRadius: '10px',
    backgroundColor: '#0f172a',
    color: '#ffffff',
    border: '1px solid #0f172a',
    fontSize: '0.925rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  oauthIcon: {
    width: '20px',
    height: '20px',
  },
  footer: {
    marginTop: '1.5rem',
    textAlign: 'center',
  },
  footerText: {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: 0,
  },
  footerLink: {
    color: '#2563eb',
    textDecoration: 'none',
    fontWeight: 600,
  },
};
