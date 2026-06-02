'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CaretakerIndex() {
  const router = useRouter();
  useEffect(() => { router.replace('/caretaker/reallocation'); }, [router]);
  return null;
}
