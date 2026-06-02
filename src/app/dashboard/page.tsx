'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import { propertyTitle } from '@/lib/tariffs';
import { useAuthStore } from '@/store/auth';
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  DocumentCheckIcon,
  HomeModernIcon,
  PlusIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface BookingStats {
  pendingVerification: number;
  pendingAllocation: number;
  approved: number;
  checkedIn: number;
  todayCheckIns: number;
  todayCheckOuts: number;
}

interface RoomStats {
  total: number;
  available: number;
  occupied: number;
  maintenance: number;
}

interface RecentBooking {
  id: number;
  bookingId: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  createdAt?: string;
  room?: { roomNumber: string; roomType: string; property?: string };
  rooms?: { roomNumber: string; roomType: string; property?: string }[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_ALLOCATION: 'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED: 'bg-blue-50 text-[#2563EB] border-blue-200',
  CHECKED_IN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  CHECKED_OUT: 'bg-gray-100 text-gray-500 border-gray-200',
  CANCELLED: 'bg-red-50 text-red-600 border-red-200',
  REJECTED: 'bg-red-50 text-red-600 border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending Verification',
  PENDING_ALLOCATION: 'Pending Approval',
  APPROVED: 'Approved',
  CHECKED_IN: 'Checked In',
  CHECKED_OUT: 'Checked Out',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
};

const ROLE_LABEL: Record<string, string> = {
  ASSISTANT_ESTATE_OFFICER: 'Assistant Estate Officer',
  ESTATE_OFFICER: 'Estate Officer',
  CARETAKER: 'Caretaker',
};

function Avatar({ name }: { name: string }) {
  const initials = name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-xs font-bold text-[#2563EB] ring-1 ring-blue-100/50">
      {initials}
    </div>
  );
}

function bookingRooms(booking: RecentBooking) {
  return booking.rooms?.length ? booking.rooms : (booking.room ? [booking.room] : []);
}

export default function DashboardPage() {
  const { user, hydrate } = useAuthStore();
  const [bookingStats, setBookingStats] = useState<BookingStats | null>(null);
  const [roomStats, setRoomStats] = useState<RoomStats | null>(null);
  const [recent, setRecent] = useState<RecentBooking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    const load = async () => {
      try {
        const [bs, rs, rb] = await Promise.all([
          api.get('/bookings/stats'),
          api.get('/rooms/stats'),
          api.get('/bookings'),
        ]);
        setBookingStats(bs as unknown as BookingStats);
        setRoomStats(rs as unknown as RoomStats);
        const list = Array.isArray(rb) ? rb as RecentBooking[] : ((rb as any).content ?? []);
        setRecent(list);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const chronologicalRecent = useMemo(() => {
    const STATUS_ORDER: Record<string, number> = {
      PENDING_VERIFICATION: 1,
      PENDING_ALLOCATION: 2,
      APPROVED: 3,
      CHECKED_IN: 4,
      CHECKED_OUT: 5,
      REJECTED: 6,
      CANCELLED: 7,
    };

    return [...recent]
      .sort((a, b) => {
        const orderA = STATUS_ORDER[a.status] ?? 99;
        const orderB = STATUS_ORDER[b.status] ?? 99;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        const aDate = `${a.checkInDate || ''}T${a.createdAt || ''}`;
        const bDate = `${b.checkInDate || ''}T${b.createdAt || ''}`;
        return bDate.localeCompare(aDate);
      })
      .slice(0, 6);
  }, [recent]);

  const awaitingApproval = useMemo(() => {
    // Bookings that need action.
    // EO can approve PENDING_ALLOCATION and PENDING_VERIFICATION.
    // AEO verifies PENDING_VERIFICATION.
    if (user?.role === 'ESTATE_OFFICER') {
      return recent.filter((b) => b.status === 'PENDING_ALLOCATION' || b.status === 'PENDING_VERIFICATION');
    }
    if (user?.role === 'ASSISTANT_ESTATE_OFFICER') {
      return recent.filter((b) => b.status === 'PENDING_VERIFICATION');
    }
    return [];
  }, [recent, user?.role]);

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const occupancyPct = roomStats ? Math.round((roomStats.occupied / (roomStats.total || 1)) * 100) : 0;
  const pendingTotal = (bookingStats?.pendingVerification ?? 0) + (bookingStats?.pendingAllocation ?? 0);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50">
      <Header title="Dashboard" />

      <main className="flex-1 overflow-y-auto forest-surface p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          
          {/* Welcome Banner */}
          <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-soft-lg">
            <div className="h-[6px] bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700" />
            <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
              
                <h1 className="text-2xl font-bold text-[#0F172A] tracking-tight">
                  Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.fullName?.split(' ')[0]}
                </h1>
                <p className="mt-1 text-xs text-[#64748B] font-medium">
                  Logged in as <span className="font-semibold text-[#0F172A]">{ROLE_LABEL[user?.role ?? ''] ?? user?.role}</span> · CASFOS Hostel Operations Center.
                </p>
              </div>
              {user?.role === 'ASSISTANT_ESTATE_OFFICER' && (
                <Link href="/bookings/new" className="inline-flex w-fit items-center gap-2 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white shadow-soft hover:bg-[#1D4ED8] hover:shadow-soft-lg transition-all duration-250 hover:translate-y-[-1px]">
                  <PlusIcon className="h-4 w-4" />
                  New Booking
                </Link>
              )}
            </div>

            {/* Quick Stats Grid */}
            {!loading && bookingStats && (
              <div className="grid grid-cols-2 gap-4 border-t border-slate-100/80 p-6 pt-5 lg:grid-cols-4 bg-gradient-to-br from-slate-50/50 to-slate-100/30">
                {[
                  { 
                    label: 'Today Check-Ins', 
                    value: bookingStats.todayCheckIns, 
                    desc: 'Expected stays arriving today',
                    icon: CalendarDaysIcon, 
                    bg: 'bg-blue-500', 
                    iconBg: 'bg-blue-600',
                    iconColor: 'text-white',
                    href: '/bookings?tab=UPCOMING'
                  },
                  { 
                    label: 'Today Check-Outs', 
                    value: bookingStats.todayCheckOuts, 
                    desc: 'Checked-in guests leaving today',
                    icon: CheckCircleIcon, 
                    bg: 'bg-teal-500', 
                    iconBg: 'bg-teal-600',
                    iconColor: 'text-white',
                    href: '/bookings?tab=ACTIVE'
                  },
                  { 
                    label: 'Pending Overall', 
                    value: pendingTotal, 
                    desc: 'Awaiting verification or approval',
                    icon: ClockIcon, 
                    bg: 'bg-amber-500', 
                    iconBg: 'bg-amber-600',
                    iconColor: 'text-white',
                    href: '/bookings?tab=PENDING'
                  },
                  { 
                    label: 'Active Guests', 
                    value: bookingStats.checkedIn, 
                    desc: 'Guests currently stay in-house',
                    icon: HomeModernIcon, 
                    bg: 'bg-indigo-500', 
                    iconBg: 'bg-indigo-600',
                    iconColor: 'text-white',
                    href: '/bookings?tab=ACTIVE'
                  },
                ].map((item) => (
                  <Link key={item.label} href={item.href} className={`group relative overflow-hidden rounded-xl border-0 ${item.bg} shadow-soft hover:shadow-soft-lg transition-all duration-300 hover:scale-105`}>
                    <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
                    <div className="relative p-4 flex flex-col h-full">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-3xl font-extrabold text-white tracking-tight">{item.value}</p>
                        </div>
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.iconBg} shadow-lg group-hover:scale-110 transition-transform duration-250`}>
                          <item.icon className={`h-5 w-5 ${item.iconColor}`} />
                        </div>
                      </div>
                      <div className="mt-auto">
                        <p className="text-sm font-bold text-white leading-tight">{item.label}</p>
                        <p className="text-xs text-white/80 mt-1 font-medium">{item.desc}</p>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="skeleton h-64 rounded-2xl" />
              <div className="skeleton h-64 rounded-2xl" />
            </div>
          ) : (
            <>
              {/* Approvals Quick Queue — Prominently placed at the top for Estate Officers */}
              {awaitingApproval.length > 0 && (
                <section className="rounded-2xl border-2 border-amber-200 bg-amber-50/30 p-5 shadow-soft">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-amber-950 flex items-center gap-2.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500 shadow-glow-accent"></span>
                        </span>
                        Pending Action Queue
                      </h2>
                      <p className="text-xs text-amber-800/80 font-medium">Bookings awaiting your approval or verification</p>
                    </div>
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 shadow-xs">
                      {awaitingApproval.length} pending
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {awaitingApproval.map((b) => (
                      <div key={b.id} className="group relative flex flex-col justify-between rounded-lg border border-amber-200 bg-white p-4 shadow-soft hover:shadow-soft-lg transition-all duration-250">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-mono text-xs font-bold text-[#2563EB]">{b.bookingId}</span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold border shadow-xs ${STATUS_COLORS[b.status]}`}>
                              {STATUS_LABEL[b.status] ?? b.status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-bold text-[#0F172A]">{b.guestName}</p>
                          <p className="text-[10px] text-[#64748B] font-medium">Check-In: {b.checkInDate} to {b.checkOutDate}</p>
                        </div>
                        <div className="mt-3.5 pt-3 border-t border-slate-100/60 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#64748B]">
                            {bookingRooms(b).length ? `${bookingRooms(b).length} room(s) requested` : 'Room unallocated'}
                          </span>
                          <Link href={`/bookings/${b.id}`} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#2563EB] hover:text-[#1D4ED8] transition-colors duration-200">
                            {user?.role === 'ESTATE_OFFICER' ? 'Allocate & Approve' : 'Verify & Forward'}
                            <ArrowRightIcon className="h-3 w-3" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Pipeline and Room Stats Section */}
              <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                
                {/* Pipeline */}
                <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-soft">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">Booking Pipeline</h2>
                      <p className="text-xs text-[#64748B] font-medium">Current workflow stages distribution</p>
                    </div>
                    <ShieldCheckIcon className="h-5 w-5 text-[#2563EB]" />
                  </div>
                  <div className="grid grid-cols-2 gap-3.5">
                    {[
                      { 
                        label: 'Pending Verification', 
                        value: bookingStats?.pendingVerification ?? 0, 
                        bg: 'bg-blue-100', 
                        border: 'border-blue-300',
                        icon: ClockIcon,
                        iconBg: 'bg-blue-200',
                        iconColor: 'text-blue-600',
                        textColor: 'text-blue-900',
                        desc: 'Documents being verified'
                      },
                    
                      { 
  label: 'Approved', 
  value: bookingStats?.approved ?? 0, 
  bg: 'bg-violet-100', 
  border: 'border-violet-300',
  icon: CheckIcon,
  iconBg: 'bg-violet-200',
  iconColor: 'text-violet-600',
  textColor: 'text-violet-900',
  desc: 'Ready for check-in'
},
                      { 
                        label: 'Checked In', 
                        value: bookingStats?.checkedIn ?? 0, 
                        bg: 'bg-teal-100', 
                        border: 'border-teal-300',
                        icon: HomeModernIcon,
                        iconBg: 'bg-teal-200',
                        iconColor: 'text-teal-600',
                        textColor: 'text-teal-900',
                        desc: 'Guests in-house'
                      },
                    ].map((item) => (
                      <div key={item.label} className={`group rounded-lg border-2 ${item.border} p-4 ${item.bg} shadow-soft hover:shadow-soft-lg transition-all duration-250 hover:-translate-y-1 cursor-default`}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className={`text-3xl font-extrabold ${item.textColor} tracking-tight`}>{item.value}</p>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${item.iconBg} group-hover:scale-110 transition-transform duration-250`}>
                            <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                          </div>
                        </div>
                        <p className={`text-sm font-bold ${item.textColor}`}>{item.label}</p>
                        <p className={`text-xs ${item.textColor}/70 font-medium mt-0.5`}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rooms Stats */}
                <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-soft flex flex-col justify-between">
                  <div>
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">Room Overview</h2>
                        <p className="text-xs text-[#64748B] font-medium">Availability & maintenance statuses</p>
                      </div>
                      <WrenchScrewdriverIcon className="h-5 w-5 text-[#2563EB]" />
                    </div>
                    <div className="grid grid-cols-2 gap-3.5">
                      {[
                        { 
                          label: 'Available', 
                          value: roomStats?.available ?? 0, 
                          text: 'text-emerald-900', 
                          bg: 'bg-emerald-100',
                          border: 'border-emerald-300',
                          labelBg: 'bg-emerald-200',
                          labelText: 'text-emerald-700'
                        },
                        { 
                          label: 'Occupied', 
                          value: roomStats?.occupied ?? 0, 
                          text: 'text-red-900', 
                          bg: 'bg-red-100',
                          border: 'border-red-300',
                          labelBg: 'bg-red-200',
                          labelText: 'text-red-700'
                        },
                        { 
                          label: 'Maintenance', 
                          value: roomStats?.maintenance ?? 0, 
                          text: 'text-amber-900', 
                          bg: 'bg-amber-100',
                          border: 'border-amber-300',
                          labelBg: 'bg-amber-200',
                          labelText: 'text-amber-700'
                        },
                        { 
                          label: 'Total Rooms', 
                          value: roomStats?.total ?? 0, 
                          text: 'text-slate-900', 
                          bg: 'bg-slate-100',
                          border: 'border-slate-300',
                          labelBg: 'bg-slate-200',
                          labelText: 'text-slate-700'
                        },
                      ].map((item) => (
                        <div key={item.label} className={`rounded-lg border-2 ${item.border} p-3.5 ${item.bg} shadow-soft hover:shadow-soft-lg transition-all duration-250 hover:-translate-y-1`}>
                          <p className={`text-2xl font-bold ${item.text}`}>{item.value}</p>
                          <p className={`text-[10px] font-bold uppercase tracking-wider mt-2 ${item.labelText} ${item.labelBg} inline-block px-2 py-1 rounded`}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100/60">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-bold text-[#0F172A]">Room Occupancy Rate</p>
                      <p className="text-xs font-extrabold text-[#2563EB]">{occupancyPct}%</p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/50 shadow-xs">
                      <div
  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-700 transition-all duration-700 shadow-glow-primary"
  style={{ width: `${occupancyPct}%` }}
/>
                    </div>
                  </div>
                </div>
              </section>

              {/* Recent Bookings Table */}
              <section className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-soft-lg">
                <div className="flex items-center justify-between border-b border-slate-100/60 px-5 py-4 bg-slate-50/30">
                  <div>
                    <h2 className="text-sm font-bold text-[#0F172A] tracking-tight">Recent Bookings</h2>
                    <p className="text-xs text-[#64748B] font-medium">Sorted by status workflow order</p>
                  </div>
                  <Link href="/bookings" className="inline-flex items-center gap-1 text-xs font-bold text-[#2563EB] transition-colors duration-200 hover:text-[#1D4ED8]">
                    View all bookings
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                </div>

                {chronologicalRecent.length === 0 ? (
                  <div className="py-14 text-center text-sm font-medium text-[#94A3B8]">No bookings yet</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100/60 bg-slate-50/60 text-[10px] font-bold uppercase tracking-wider text-[#64748B]">
                          <th className="px-5 py-3.5 text-left">Check In/Out</th>
                          <th className="px-5 py-3.5 text-left">Booking ID</th>
                          <th className="px-5 py-3.5 text-left">Guest Name</th>
                          <th className="px-5 py-3.5 text-left">Room Numbers</th>
                          <th className="px-5 py-3.5 text-left">Status</th>
                          <th className="px-5 py-3.5 text-left" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {chronologicalRecent.map((booking) => (
                          <tr key={booking.id} className="group transition-colors duration-200 hover:bg-blue-50/30">
                            <td className="px-5 py-3.5 text-xs text-[#64748B]">
                              <p className="font-semibold text-[#0F172A]">{booking.checkInDate}</p>
                              <p className="text-[10px] text-[#94A3B8]">to {booking.checkOutDate}</p>
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="font-mono text-xs font-bold text-[#2563EB]">{booking.bookingId}</span>
                            </td>
                            <td className="px-5 py-3.5">
                              <div className="flex items-center gap-3">
                                <Avatar name={booking.guestName} />
                                <div>
                                  <p className="text-xs font-bold text-[#0F172A]">{booking.guestName}</p>
                                  <p className="text-[10px] text-[#64748B] font-medium">{booking.guestPhone}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-[#64748B]">
                              {bookingRooms(booking).length ? (
                                <>
                                  <p className="font-bold text-[#0F172A]">{bookingRooms(booking).map((room) => room.roomNumber).join(', ')}</p>
                                  <p className="text-[10px] text-[#94A3B8] font-medium">
                                    {bookingRooms(booking)[0].property ? propertyTitle(bookingRooms(booking)[0].property!) : `${bookingRooms(booking).length} room(s)`}
                                  </p>
                                </>
                              ) : <span className="text-[#CBD5E1] font-medium">Unassigned</span>}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold shadow-xs ${STATUS_COLORS[booking.status] ?? 'bg-slate-100 text-[#64748B] border-slate-200'}`}>
                                {STATUS_LABEL[booking.status] ?? booking.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <Link href={`/bookings/${booking.id}`} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-[#2563EB] shadow-xs hover:shadow-soft hover:bg-slate-50 transition-all duration-250">
                                View
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
