'use client';

import React from 'react';
import { SessionProvider } from 'next-auth/react';
import Provider from '@/app/provider';

export function AuthProvider({ children }: { children: React.ReactNode }) {

  return <SessionProvider>
    <Provider>
      {children}
    </Provider>
  </SessionProvider>;
}
