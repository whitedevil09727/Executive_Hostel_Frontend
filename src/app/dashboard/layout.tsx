'use client';

import Sidebar from '@/components/Sidebar';
import api from '@/lib/api';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { hydrate, setAuth } = useAuthStore();
  const router = useRouter();
  const validatedRef = useRef(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (validatedRef.current) return;
    validatedRef.current = true;

    const stored = localStorage.getItem('token');
    if (!stored) {
      router.replace('/');
      return;
    }

    api.get('/auth/me')
      .then((data: any) => {
        setAuth(
          { username: data.username, fullName: data.fullName, role: data.role, email: data.email, phone: data.phone },
          stored
        );
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.replace('/');
      });
  }, [router, setAuth]);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
