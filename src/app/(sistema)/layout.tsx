'use client';

import Header from '../../components/Header';
import { useAuth } from '@/hooks/useAuth';

export default function SistemaLayout({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (loading) return null;

  return (
    <>
      <Header />
      <main className="pt-20 min-h-screen bg-slate-50">
        {children}
      </main>
    </>
  );
}
