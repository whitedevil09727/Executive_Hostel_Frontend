'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useState } from 'react';
import toast from 'react-hot-toast';

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  roles: string[];
  badge?: number;
};

const NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    roles: ['ASSISTANT_ESTATE_OFFICER', 'ESTATE_OFFICER', 'CARETAKER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    label: 'New Booking',
    href: '/bookings/new',
    roles: ['ASSISTANT_ESTATE_OFFICER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v16m8-8H4"
        />
      </svg>
    ),
  },
  {
    label: 'All Bookings',
    href: '/bookings',
    roles: ['ASSISTANT_ESTATE_OFFICER', 'ESTATE_OFFICER', 'CARETAKER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
  {
    label: 'Check-In / Out',
    href: '/operations',
    roles: ['ASSISTANT_ESTATE_OFFICER', 'CARETAKER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7h8m-8 5h6m-6 5h4M5 5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5z"
        />
      </svg>
    ),
  },
  {
    label: 'Rooms',
    href: '/rooms',
    roles: ['ASSISTANT_ESTATE_OFFICER', 'ESTATE_OFFICER', 'CARETAKER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    label: 'Room Reallocation',
    href: '/caretaker/reallocation',
    roles: ['CARETAKER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
        />
      </svg>
    ),
  },
  {
    label: 'Collect Payment',
    href: '/caretaker/payment',
    roles: ['CARETAKER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
        />
      </svg>
    ),
  },
  {
    label: 'Payments',
    href: '/payments',
    roles: ['ESTATE_OFFICER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
        />
      </svg>
    ),
  },
  {
    label: 'Audit Logs',
    href: '/audit',
    roles: ['ESTATE_OFFICER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: 'Masters',
    href: '/masters',
    roles: ['ASSISTANT_ESTATE_OFFICER', 'ESTATE_OFFICER'],
    icon: (
      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, clearAuth } = useAuthStore();

  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = () => {
    clearAuth();
    toast.success('Logged out successfully');
    router.push('/');
  };

  const visibleNav = NAV.filter(
    (item) => user && item.roles.includes(user.role)
  );

  const roleLabel: Record<string, string> = {
    ASSISTANT_ESTATE_OFFICER: 'Asst. Estate Officer',
    ESTATE_OFFICER: 'Estate Officer',
    CARETAKER: 'Caretaker',
  };

  return (
    <aside
      className={`${
        collapsed ? 'w-[74px]' : 'w-[260px]'
      } h-full bg-gradient-to-b from-[#2563EB] to-[#1D4ED8] flex flex-col shrink-0 transition-all duration-300 border-r border-blue-300/20 shadow-2xl z-20`}
    >
      {/* HEADER */}
      <div
        className={`h-[78px] border-b border-white/10 flex items-center shrink-0 ${
          collapsed
            ? 'justify-center px-0'
            : 'justify-between px-5'
        }`}
      >
        {collapsed ? (
          <button
            onClick={() => setCollapsed(false)}
            className="p-2 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white transition-all duration-200"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>
        ) : (
          <>
            {/* LOGO + TITLE */}
            <div className="flex items-center gap-3">

              {/* ONLY LOGO */}
              <Image
                src="/casfos-logo.png"
                alt="CASFOS Logo"
                width={46}
                height={46}
                className="object-contain"
                priority
              />

              <div>
                <h1 className="text-[20px] font-bold tracking-wide text-white leading-none">
                  CASFOS
                </h1>

                <p className="mt-1 text-[12px] text-blue-100 font-medium">
                  Hostel System
                </p>
              </div>
            </div>

            {/* COLLAPSE BUTTON */}
            <button
              onClick={() => setCollapsed(true)}
              className="p-2 rounded-xl text-blue-100 hover:bg-white/10 hover:text-white transition-all duration-200"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* USER SECTION */}
      <div
        className={`border-b border-white/10 ${
          collapsed
            ? 'p-3 flex justify-center'
            : 'px-4 py-5'
        }`}
      >
        {collapsed ? (
          <div
            className="w-11 h-11 rounded-2xl bg-white/15 backdrop-blur-xl border border-white/20 flex items-center justify-center text-white font-bold text-sm shadow-lg"
            title={user?.fullName}
          >
            {user?.fullName?.charAt(0) ?? '?'}
          </div>
        ) : (
          <div className="rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl px-4 py-4 shadow-xl">

            <div className="flex items-center gap-3">

              {/* GLASSMORPHIC USER BADGE */}
              <div className="w-12 h-12 rounded-2xl bg-white/20 border border-white/20 backdrop-blur-xl flex items-center justify-center text-white font-bold text-sm shadow-lg">
                {user?.fullName?.charAt(0) ?? '?'}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-white">
                  {user?.fullName}
                </p>

                <p className="mt-0.5 truncate text-[12px] text-blue-100">
                  {roleLabel[user?.role ?? ''] ?? user?.role}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* NAVIGATION */}
      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-1.5">
        {visibleNav.map((item) => {
          const isActive =
            item.href === '/bookings'
              ? pathname === '/bookings' ||
                (pathname.startsWith('/bookings/') &&
                  !pathname.startsWith('/bookings/new'))
              : pathname === item.href ||
                pathname.startsWith(item.href + '/');

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`group relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-200 ${
                isActive
                  ? 'bg-white text-[#2563EB] shadow-xl'
                  : 'text-blue-100 hover:bg-white/10 hover:text-white'
              }`}
            >

              <span
                className={`shrink-0 ${
                  isActive
                    ? 'text-[#2563EB]'
                    : 'text-blue-100 group-hover:text-white'
                }`}
              >
                {item.icon}
              </span>

              {!collapsed && (
                <span className="flex-1 truncate text-[14px] font-medium">
                  {item.label}
                </span>
              )}

              {!collapsed && item.badge && item.badge > 0 && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-white">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* FOOTER */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={handleLogout}
          title={collapsed ? 'Log out' : undefined}
          className={`w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-blue-100 hover:bg-white/10 hover:text-white transition-all duration-200 ${
            collapsed ? 'justify-center' : ''
          }`}
        >
          <svg
            className="w-4 h-4 shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>

          {!collapsed && (
            <span className="text-[14px] font-medium">
              Log out
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}