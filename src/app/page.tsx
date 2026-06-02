'use client';

import {
  ArrowRightIcon,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import Image from 'next/image';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const leaves = [
  { left: '8%', delay: '-2s', duration: '16s', size: 26 },
  { left: '18%', delay: '-7s', duration: '18s', size: 20 },
  { left: '36%', delay: '-4s', duration: '14s', size: 30 },
  { left: '58%', delay: '-9s', duration: '19s', size: 24 },
  { left: '74%', delay: '-5s', duration: '15s', size: 22 },
  { left: '90%', delay: '-11s', duration: '20s', size: 28 },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const data: any = await api.post('/auth/login', {
        username,
        password,
      });

      if (data.success) {
        setAuth(
          {
            username: data.username,
            fullName: data.fullName,
            role: data.role,
            email: data.email,
            phone: data.phone,
          },
          data.token
        );

        toast.success(`Welcome, ${data.fullName}!`);
        router.push(data.role === 'FACULTY' ? '/faculty' : '/dashboard');
      } else {
        toast.error(data.message || 'Invalid credentials');
      }
    } catch {
      toast.error('Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="min-h-screen bg-[#f5f5f5]">

        {/* MAIN LAYOUT */}
        <div className="grid min-h-screen lg:grid-cols-[0.92fr_1.08fr]">

          {/* ───────────── LEFT LOGIN PANEL ───────────── */}
          <section className="relative flex items-center justify-center overflow-hidden bg-[#fafafa] px-8 py-12 sm:px-14">

            {/* Animated Leaf Background */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">

              {/* Soft Gradient Glow */}
              <div className="absolute -left-20 top-0 h-[420px] w-[420px] rounded-full bg-green-100/40 blur-3xl" />
              <div className="absolute bottom-0 right-0 h-[320px] w-[320px] rounded-full bg-amber-100/40 blur-3xl" />

              {/* Floating Leaves */}
              {leaves.map((leaf, index) => (
                <div
                  key={index}
                  className="leaf absolute"
                  style={{
                    left: leaf.left,
                    animationDelay: leaf.delay,
                    animationDuration: leaf.duration,
                  }}
                >
                  <svg
                    width={leaf.size}
                    height={leaf.size}
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="opacity-25"
                  >
                    <path
                      d="M19.5 3C11 3 5 8.5 5 17C5 18.5 5.5 20 6.5 21C15 21 21 15.5 21 7C21 5.5 20.5 4 19.5 3Z"
                      fill="#7BA66A"
                    />
                  </svg>
                </div>
              ))}
            </div>

            {/* LOGIN CONTENT */}
            <div className="relative z-10 w-full max-w-md">

              {/* Logos */}
              <div className="mb-12 flex items-center justify-center">

                {/* GOI LOGO */}
                <div className="flex items-center justify-center pr-6">
                  <Image
                    src="/ChatGPT Image May 26, 2026, 01_33_22 AM.png"
                    alt="Government Emblem"
                    width={54}
                    height={54}
                    className="object-contain"
                    priority
                  />
                </div>

                {/* Divider */}
                <div className="h-12 w-px bg-gray-300" />

                {/* CASFOS LOGO */}
                <div className="flex items-center justify-center pl-6">
                  <Image
                    src="/casfos-logo.png"
                    alt="CASFOS Logo"
                    width={76}
                    height={76}
                    className="object-contain"
                    priority
                  />
                </div>
              </div>

              {/* Heading */}
              <div className="mb-10 text-center">
                <h1 className="text-5xl font-bold tracking-tight text-[#111827]">
                  Welcome back 
                </h1>

                <p className="mt-4 text-base text-gray-500">
                  Sign in to access Executive Hostel Management
                </p>
              </div>

              {/* Form */}
              <form
                onSubmit={handleLogin}
                className="space-y-5"
              >

                {/* Username */}
                <div>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter username"
                    required
                    autoComplete="username"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 text-sm text-gray-800 shadow-sm outline-none transition-all duration-200 focus:border-[#f59e0b] focus:ring-4 focus:ring-amber-100"
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    required
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-gray-200 bg-white px-5 py-4 pr-14 text-sm text-gray-800 shadow-sm outline-none transition-all duration-200 focus:border-[#f59e0b] focus:ring-4 focus:ring-amber-100"
                  />

                  {/* SHOW / HIDE */}
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-[#f59e0b]"
                    aria-label={
                      showPassword
                        ? 'Hide password'
                        : 'Show password'
                    }
                  >
                    {showPassword ? (
                      <EyeSlashIcon className="h-5 w-5" />
                    ) : (
                      <EyeIcon className="h-5 w-5" />
                    )}
                  </button>
                </div>

                {/* Remember + Forgot */}
                <div className="flex items-center justify-between px-1 text-sm text-gray-500">

                  <label className="flex items-center gap-2">
                    {/* <input
                      type="checkbox"
                      className="rounded border-gray-300"
                    /> */}
                    {/* Remember me */}
                  </label>

                  <button
                    type="button"
                    className="transition hover:text-[#f59e0b]"
                  >
                    {/* Forgot password? */}
                  </button>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#f59e0b] px-5 py-4 text-sm font-semibold text-white shadow-lg shadow-amber-300/40 transition-all duration-300 hover:bg-[#ea980c] hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? 'Signing in...' : 'Log In'}

                  {!loading && (
                    <ArrowRightIcon className="h-4 w-4" />
                  )}
                </button>

              </form>
            </div>
          </section>

          {/* ───────────── RIGHT IMAGE PANEL ───────────── */}
          <section className="hidden bg-[#f5f5f5] p-6 lg:block">

            <div className="relative h-full w-full overflow-hidden rounded-[36px] shadow-2xl">

              {/* Background Image */}
              <Image
                src="/Executive_Hostel.jpeg"
                alt="Executive Hostel"
                fill
                priority
                className="object-cover"
              />

              {/* Overlay */}
              <div className="absolute inset-0 bg-black/35" />

              {/* CENTERED CONTENT */}
              <div className="absolute inset-0 flex items-center justify-center">

                <div className="max-w-2xl px-10 text-left text-white">

                  <h2 className="text-6xl font-bold leading-tight drop-shadow-lg">
                    Executive Hostel
                    <br />
                    Management
                  </h2>

                  <p className="mt-6 text-lg leading-8 text-white/90">
                    Manage guest stays, tariff approvals, room availability,
                    and official accommodation records across CASFOS campuses.
                  </p>

                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* GLOBAL ANIMATION */}
      <style jsx global>{`
        .leaf {
          top: -10%;
          animation-name: fallingLeaf;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }

        @keyframes fallingLeaf {
          0% {
            transform: translateY(-10vh) translateX(0) rotate(0deg);
            opacity: 0;
          }

          10% {
            opacity: 0.25;
          }

          25% {
            transform: translateY(25vh) translateX(18px) rotate(90deg);
          }

          50% {
            transform: translateY(50vh) translateX(-15px) rotate(180deg);
          }

          75% {
            transform: translateY(75vh) translateX(12px) rotate(240deg);
          }

          100% {
            transform: translateY(115vh) translateX(-10px) rotate(360deg);
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}