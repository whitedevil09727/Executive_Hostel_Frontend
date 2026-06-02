'use client';

import Header from '@/components/Header';
import Link from 'next/link';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatINR, paymentCategoryLabel, propertyTitle } from '@/lib/tariffs';
import { useAuthStore } from '@/store/auth';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface Booking {
  id: number;
  bookingId: string;
  guestName: string;
  guestPhone: string;
  guestOrganization?: string;
  referredBy?: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  paymentCategory?: string;
  paymentAmount?: number;
  room?: { roomNumber: string; roomType: string; property: string };
  rooms?: { roomNumber: string; roomType: string; property: string }[];
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  PENDING_VERIFICATION: 'bg-amber-50 text-amber-700 border-amber-200',
  PENDING_ALLOCATION: 'bg-orange-50 text-orange-700 border-orange-200',
  APPROVED: 'bg-sky-50 text-sky-700 border-sky-200',
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

type Tab = 'ALL' | 'UPCOMING' | 'PENDING' | 'ACTIVE' | 'COMPLETED';
type SortKey = 'createdAt' | 'checkInDate' | 'guestName' | 'status';

const TABS: { key: Tab; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'COMPLETED', label: 'Completed' },
];

const STATUS_ORDER: Record<string, number> = {
  PENDING_VERIFICATION: 1,
  PENDING_ALLOCATION: 2,
  APPROVED: 3,
  CHECKED_IN: 4,
  CHECKED_OUT: 5,
  REJECTED: 6,
  CANCELLED: 7,
};

function sortBookings(list: Booking[], key: SortKey, dir: 'asc' | 'desc') {
  return [...list].sort((a, b) => {
    let cmp: number;
    if (key === 'status') {
      cmp = (STATUS_ORDER[a.status] ?? 99) - (STATUS_ORDER[b.status] ?? 99);
    } else {
      const va = String((a as any)[key] ?? '');
      const vb = String((b as any)[key] ?? '');
      cmp = va < vb ? -1 : va > vb ? 1 : 0;
    }
    return dir === 'asc' ? cmp : -cmp;
  });
}

function bookingRooms(booking: Booking) {
  return booking.rooms?.length ? booking.rooms : (booking.room ? [booking.room] : []);
}

export default function BookingsPage() {
  const { user, hydrate } = useAuthStore();
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [tab, setTab] = useState<Tab>('ALL');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ COIMBATORE: true, OOTY: true, UNALLOCATED: true });

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const queryTab = params.get('tab')?.toUpperCase() as Tab;
      if (queryTab && ['ALL', 'UPCOMING', 'PENDING', 'ACTIVE', 'COMPLETED'].includes(queryTab)) {
        setTab(queryTab);
      }
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: any;
      if (tab === 'UPCOMING') {
        data = await api.get('/bookings/upcoming');
      } else if (tab === 'PENDING') {
        const [pv, pa] = await Promise.all([
          api.get('/bookings?status=PENDING_VERIFICATION'),
          api.get('/bookings?status=PENDING_ALLOCATION'),
        ]);
        data = [...(Array.isArray(pv) ? pv : []), ...(Array.isArray(pa) ? pa : [])];
      } else if (tab === 'ACTIVE') {
        data = await api.get('/bookings?status=CHECKED_IN');
      } else if (tab === 'COMPLETED') {
        const [co, rj] = await Promise.all([
          api.get('/bookings?status=CHECKED_OUT'),
          api.get('/bookings?status=REJECTED'),
        ]);
        data = [...(Array.isArray(co) ? co : []), ...(Array.isArray(rj) ? rj : [])];
      } else {
        data = await api.get('/bookings');
      }
      setAllBookings(Array.isArray(data) ? data : data?.content ?? []);
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => sortBookings(
    allBookings.filter((booking) => {
      const q = search.toLowerCase();
      return (
        booking.guestName.toLowerCase().includes(q) ||
        booking.bookingId.toLowerCase().includes(q) ||
        booking.guestPhone.includes(q) ||
        (booking.guestOrganization?.toLowerCase().includes(q) ?? false) ||
        bookingRooms(booking).some((room) => room.roomNumber.toLowerCase().includes(q))
      );
    }),
    sortKey,
    sortDir
  ), [allBookings, search, sortDir, sortKey]);

  const grouped = useMemo(() => {
    const next: Record<string, Booking[]> = { COIMBATORE: [], OOTY: [], UNALLOCATED: [] };
    filtered.forEach((booking) => {
      const key = bookingRooms(booking)[0]?.property ?? 'UNALLOCATED';
      if (!next[key]) next[key] = [];
      next[key].push(booking);
    });
    return next;
  }, [filtered]);

  const tabCounts: Partial<Record<Tab, number>> = {
    PENDING: allBookings.filter((booking) => booking.status === 'PENDING_VERIFICATION' || booking.status === 'PENDING_ALLOCATION').length,
    ACTIVE: allBookings.filter((booking) => booking.status === 'CHECKED_IN').length,
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50">
      <Header title="Bookings" />

      <main className="flex-1 overflow-y-auto p-6 forest-surface">
        <div className="mb-5 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-lg font-bold text-[#0F172A]">Bookings</h1>
            <p className="text-xs text-[#64748B] font-medium">{loading ? 'Loading...' : `${filtered.length} result${filtered.length === 1 ? '' : 's'}`}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Search by name, ID, room..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-56 rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 shadow-xs transition-all duration-250"
            />
            <select
              value={`${sortKey}-${sortDir}`}
              onChange={(event) => {
                const [key, dir] = event.target.value.split('-');
                setSortKey(key as SortKey);
                setSortDir(dir as 'asc' | 'desc');
              }}
              className="rounded-lg border border-slate-200/70 bg-white px-3 py-2 text-sm text-[#64748B] outline-none shadow-xs focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20 transition-all duration-250"
            >
              <option value="status-asc">Status (Workflow)</option>
              <option value="createdAt-desc">Newest First</option>
              <option value="createdAt-asc">Oldest First</option>
              <option value="checkInDate-asc">Check-In Asc</option>
              <option value="checkInDate-desc">Check-In Desc</option>
              <option value="guestName-asc">Name A-Z</option>
              <option value="guestName-desc">Name Z-A</option>
            </select>
            {user?.role === 'ASSISTANT_ESTATE_OFFICER' && (
              <Link href="/bookings/new" className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white shadow-soft hover:bg-[#1D4ED8] hover:shadow-soft-lg transition-all duration-250">
                New Booking
              </Link>
            )}
          </div>
        </div>

        <div className="mb-5 flex w-fit flex-wrap gap-1 rounded-lg border border-slate-200/60 bg-white p-1 shadow-soft">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-250 ${tab === key ? 'bg-[#2563EB] text-white shadow-soft' : 'text-[#64748B] hover:bg-blue-50/80 hover:text-[#2563EB]'}`}
            >
              {label}
              {(tabCounts[key] ?? 0) > 0 && <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-[10px]">{tabCounts[key]}</span>}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="rounded-lg border border-slate-200/60 bg-white p-6 shadow-soft">
            <div className="space-y-3">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="skeleton h-14 rounded-lg" />)}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-slate-200/60 bg-white py-16 text-center text-sm font-medium text-[#94A3B8] shadow-soft">
            No bookings found
          </div>
        ) : (
          ['COIMBATORE', 'OOTY', 'UNALLOCATED'].map((property) => {
            const bookings = grouped[property] ?? [];
            if (!bookings.length) return null;
            const open = expanded[property];
            return (
              <section key={property} className="mb-5 overflow-hidden rounded-lg border border-slate-200/60 bg-white shadow-soft">
                <button
                  type="button"
                  onClick={() => setExpanded((prev) => ({ ...prev, [property]: !prev[property] }))}
                  className="flex w-full items-center justify-between bg-slate-50/60 px-4 py-3 text-left transition-colors duration-250 hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-lg text-[#2563EB] transition-transform duration-250 ${open ? 'rotate-90' : ''}`}>&rsaquo;</span>
                    <div>
                      <h2 className="text-sm font-bold text-[#0F172A]">{propertyTitle(property)}</h2>
                      <p className="text-xs text-[#64748B] font-medium">{bookings.length} booking{bookings.length === 1 ? '' : 's'}{property === 'COIMBATORE' ? ' ' : ''}</p>
                    </div>
                  </div>
                </button>

                {open && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-slate-100/60 bg-slate-50/60 text-[11px] font-bold uppercase tracking-wide text-[#64748B]">
                          <th className="px-5 py-3 text-left">Booking ID</th>
                          <th className="px-5 py-3 text-left">Guest</th>
                          <th className="px-5 py-3 text-left">Dates</th>
                          <th className="px-5 py-3 text-left">Room</th>
                          <th className="px-5 py-3 text-left">Tariff</th>
                          <th className="px-5 py-3 text-left">Status</th>
                          <th className="px-5 py-3 text-left" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100/60">
                        {bookings.map((booking) => (
                          <tr key={booking.id} className="group transition-colors duration-200 hover:bg-blue-50/30">
                            <td className="px-5 py-3.5"><span className="font-mono text-xs font-bold text-[#2563EB]">{booking.bookingId}</span></td>
                            <td className="px-5 py-3.5">
                              <p className="text-xs font-bold text-[#0F172A]">{booking.guestName}</p>
                              <p className="text-[11px] text-[#64748B]">{booking.guestPhone}</p>
                              {booking.referredBy && (
                                <p className="text-[10px] text-violet-600 font-semibold mt-0.5">Ref: {booking.referredBy}</p>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-xs text-[#64748B]">
                              <p className="font-medium text-[#0F172A]">{booking.checkInDate}</p>
                              <p className="text-[11px] text-[#94A3B8]">to {booking.checkOutDate}</p>
                            </td>
                            <td className="px-5 py-3.5 text-xs text-[#64748B]">
                              {bookingRooms(booking).length ? (
                                <>
                                  <p className="font-bold text-[#0F172A]">{bookingRooms(booking).map((room) => room.roomNumber).join(', ')}</p>
                                  <p className="text-[11px] text-[#94A3B8]">{bookingRooms(booking).length} room{bookingRooms(booking).length === 1 ? '' : 's'}</p>
                                </>
                              ) : <span className="text-[#CBD5E1]">Not assigned</span>}
                            </td>
                            <td className="px-5 py-3.5 text-xs">
                              {booking.paymentAmount ? <p className="font-bold text-[#0F172A]">{formatINR(booking.paymentAmount)}</p> : <span className="text-[#CBD5E1]">-</span>}
                              {booking.paymentCategory && <p className="mt-0.5 max-w-[180px] text-[10px] font-semibold text-emerald-700">{paymentCategoryLabel(booking.paymentCategory)}</p>}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-bold shadow-xs ${STATUS_COLORS[booking.status] ?? 'bg-slate-100 text-[#64748B] border-slate-200'}`}>
                                {STATUS_LABEL[booking.status] ?? booking.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <Link href={`/bookings/${booking.id}`} className="text-xs font-bold text-[#2563EB] opacity-0 transition-all duration-200 hover:text-[#1D4ED8] group-hover:opacity-100">View</Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
