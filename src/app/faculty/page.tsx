'use client';

import api from '@/lib/api';
import toast from 'react-hot-toast';
import { propertyTitle } from '@/lib/tariffs';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface RoomInfo {
  id: number;
  roomNumber: string;
  roomType: string;
  property: string;
  floor?: string;
  status: string;
  activeBooking?: { checkInDate: string; checkOutDate: string };
  availableForDates?: boolean;
}

export default function FacultyPage() {
  const { user, hydrate, clearAuth } = useAuthStore();
  const router = useRouter();

  const [grouped, setGrouped] = useState<Record<string, RoomInfo[]>>({});
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState('');

  const [checkInFilter, setCheckInFilter] = useState('');
  const [checkOutFilter, setCheckOutFilter] = useState('');
  const [dateData, setDateData] = useState<RoomInfo[] | null>(null); // null = not in date mode
  const [checking, setChecking] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);

  useEffect(() => {
    if (user && user.role !== 'FACULTY') router.replace('/dashboard');
  }, [user, router]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await api.get('/rooms/status-board');
      const result: Record<string, RoomInfo[]> = {};
      Object.entries(data ?? {}).forEach(([prop, rooms]) => {
        result[prop] = (rooms as any[]).map((r) => ({
          id: r.id,
          roomNumber: r.roomNumber,
          roomType: r.roomType,
          property: r.property,
          floor: r.floor,
          status: r.status,
          activeBooking: r.activeBooking,
        }));
      });
      setGrouped(result);
      setLastUpdated(new Date().toLocaleTimeString('en-IN'));
    } catch {
      toast.error('Failed to load room status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-refresh every 3 minutes only when not in date mode
  useEffect(() => {
    if (dateData !== null) return;
    const interval = setInterval(load, 180000);
    return () => clearInterval(interval);
  }, [load, dateData]);

  const checkAvailability = useCallback(async (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut || checkIn >= checkOut) return;
    setChecking(true);
    try {
      const data: any = await api.get(`/rooms/date-availability?checkIn=${checkIn}&checkOut=${checkOut}`);
      setDateData(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to check availability');
    } finally {
      setChecking(false);
    }
  }, []);

  // Auto-trigger when both dates are valid
  useEffect(() => {
    if (checkInFilter && checkOutFilter && checkInFilter < checkOutFilter) {
      checkAvailability(checkInFilter, checkOutFilter);
    } else {
      setDateData(null);
    }
  }, [checkInFilter, checkOutFilter, checkAvailability]);

  const clearFilter = () => {
    setCheckInFilter('');
    setCheckOutFilter('');
  };

  const isDateMode = dateData !== null;

  // Build a lookup from roomId → availableForDates when in date mode
  const dateAvailMap = new Map<number, boolean>();
  if (dateData) {
    dateData.forEach((r) => dateAvailMap.set(r.id, r.availableForDates ?? false));
  }

  const allRooms = Object.values(grouped).flat();

  const stats = isDateMode
    ? {
        total:       allRooms.length,
        available:   (dateData ?? []).filter((r) => r.availableForDates).length,
        unavailable: (dateData ?? []).filter((r) => !r.availableForDates && r.status !== 'MAINTENANCE').length,
        maintenance: (dateData ?? []).filter((r) => r.status === 'MAINTENANCE').length,
      }
    : {
        total:       allRooms.length,
        available:   allRooms.filter((r) => r.status === 'AVAILABLE').length,
        unavailable: allRooms.filter((r) => r.status === 'OCCUPIED').length,
        maintenance: allRooms.filter((r) => r.status === 'MAINTENANCE').length,
      };

  const handleLogout = () => { clearAuth(); router.push('/'); };
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <header className="sticky top-0 z-10 border-b border-white/20 bg-[#2563EB] px-6 py-4 shadow-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
              <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5" />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-none">CASFOS Hostel</h1>
              <p className="mt-0.5 text-xs text-blue-100">Room Availability Board</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated && !isDateMode && (
              <p className="hidden text-xs text-blue-200 sm:block">Updated: {lastUpdated}</p>
            )}
            <button onClick={load}
              className="rounded-xl bg-white/20 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/30 transition">
              Refresh
            </button>
            <button onClick={handleLogout}
              className="rounded-xl border border-white/30 px-3 py-1.5 text-xs font-bold text-white hover:bg-white/10 transition">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl p-6">

        {/* Stats cards — always 4 */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total Rooms', value: stats.total, bg: 'bg-slate-700' },
            { label: isDateMode ? 'Available for Dates' : 'Available', value: stats.available, bg: 'bg-emerald-600' },
            { label: isDateMode ? 'Not Available' : 'Occupied', value: stats.unavailable, bg: 'bg-red-500' },
            { label: 'Maintenance', value: stats.maintenance, bg: 'bg-amber-500' },
          ].map((s) => (
            <div key={s.label} className={`rounded-2xl ${s.bg} p-5 shadow-md text-center transition-all`}>
              <p className="text-3xl font-black text-white">{s.value}</p>
              <p className="mt-1 text-xs font-semibold text-white/80">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Date filter */}
        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            Check Room Availability for Specific Dates
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Check-In Date
              </label>
              <input
                type="date"
                value={checkInFilter}
                min={today}
                onChange={(e) => {
                  setCheckInFilter(e.target.value);
                  if (checkOutFilter && e.target.value >= checkOutFilter) setCheckOutFilter('');
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#2563EB] focus:bg-white transition"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Check-Out Date
              </label>
              <input
                type="date"
                value={checkOutFilter}
                min={checkInFilter ? (() => {
                  const d = new Date(checkInFilter); d.setDate(d.getDate() + 1);
                  return d.toISOString().slice(0, 10);
                })() : today}
                onChange={(e) => setCheckOutFilter(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#2563EB] focus:bg-white transition"
              />
            </div>

            {checking && (
              <div className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700">
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Checking...
              </div>
            )}

            {(checkInFilter || checkOutFilter) && (
              <button onClick={clearFilter}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 transition">
                ✕ Clear
              </button>
            )}
          </div>

          {/* Active filter banner */}
          {isDateMode && !checking && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs">
              <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-semibold text-emerald-900">
                Availability from <strong>{checkInFilter}</strong> to <strong>{checkOutFilter}</strong> —
                <span className="text-emerald-700"> {stats.available} available</span>,
                <span className="text-red-600"> {stats.unavailable} booked/unavailable</span>,
                <span className="text-amber-700"> {stats.maintenance} maintenance</span>
              </p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mb-5 flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-500" />
            <span className="font-semibold text-gray-600">
              {isDateMode ? 'Available for selected dates' : 'Available now'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-500" />
            <span className="font-semibold text-gray-600">
              {isDateMode ? 'Booked / Not available' : 'Occupied'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="font-semibold text-gray-600">Maintenance</span>
          </div>
          {!isDateMode && (
            <span className="ml-auto text-gray-400 hidden sm:block">Auto-refreshes every 3 minutes</span>
          )}
        </div>

        {/* Room grid */}
        {loading ? (
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6">
            {Array.from({ length: 18 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : (
          Object.entries(grouped).map(([property, propRooms]) => {
            const propAvail = isDateMode
              ? propRooms.filter((r) => dateAvailMap.get(r.id) === true).length
              : propRooms.filter((r) => r.status === 'AVAILABLE').length;
            const propUnavail = isDateMode
              ? propRooms.filter((r) => dateAvailMap.get(r.id) === false && r.status !== 'MAINTENANCE').length
              : propRooms.filter((r) => r.status === 'OCCUPIED').length;

            return (
              <section key={property} className="mb-8">
                <div className="mb-4 flex items-center gap-3">
                  <h2 className="text-base font-bold text-gray-800">{propertyTitle(property)}</h2>
                  <div className="flex gap-2 text-[10px]">
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-700">
                      {propAvail} {isDateMode ? 'free for dates' : 'free'}
                    </span>
                    <span className="rounded-full bg-red-100 px-2 py-0.5 font-bold text-red-700">
                      {propUnavail} {isDateMode ? 'not available' : 'occupied'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                  {propRooms.map((room) => {
                    const isMaintenance = room.status === 'MAINTENANCE';

                    // In date mode: use conflict-based availability (ignores current status)
                    // In current mode: use room.status directly
                    const avail = isDateMode
                      ? (isMaintenance ? null : dateAvailMap.get(room.id))
                      : (isMaintenance ? null : room.status === 'AVAILABLE');

                    // Bold full colors in date mode; soft pastels in current-status mode
                    const cardBg = isMaintenance
                      ? (isDateMode ? 'bg-amber-500' : 'bg-amber-50 border border-amber-200')
                      : avail
                      ? (isDateMode ? 'bg-emerald-500' : 'bg-emerald-50 border border-emerald-200')
                      : (isDateMode ? 'bg-red-500' : 'bg-red-50 border border-red-200');

                    const textColor = isDateMode ? 'text-white' : 'text-gray-900';
                    const subColor = isDateMode ? 'text-white/80' : 'text-gray-500';

                    const dotColor = isMaintenance
                      ? 'bg-amber-500' : avail ? 'bg-emerald-500' : 'bg-red-500';

                    const badgeBg = isMaintenance
                      ? (isDateMode ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-800')
                      : avail
                      ? (isDateMode ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-800')
                      : (isDateMode ? 'bg-red-700 text-white' : 'bg-red-200 text-red-800');

                    const statusLabel = isMaintenance
                      ? 'Maintenance'
                      : avail
                      ? (isDateMode ? 'Available' : 'Available')
                      : (isDateMode ? 'Not Available' : 'Occupied');

                    return (
                      <div
                        key={room.id}
                        className={`rounded-2xl ${cardBg} p-3 flex flex-col items-center text-center transition-all hover:shadow-md hover:scale-[1.03]`}
                      >
                        {!isDateMode && (
                          <div className={`mb-1.5 h-2.5 w-2.5 rounded-full ${dotColor}`} />
                        )}
                        <p className={`text-sm font-black ${textColor}`}>{room.roomNumber}</p>
                        <p className={`text-[9px] font-semibold ${subColor} mt-0.5`}>
                          {room.roomType === 'SUITE' ? 'Suite' : 'Normal'}
                        </p>
                        {room.floor && (
                          <p className={`text-[9px] ${subColor}`}>{room.floor}</p>
                        )}
                        <span className={`mt-1.5 rounded-full px-2 py-0.5 text-[9px] font-bold ${badgeBg}`}>
                          {statusLabel}
                        </span>
                        {!isDateMode && room.activeBooking && (
                          <p className="mt-1 text-[8px] text-gray-400 leading-tight">
                            till {room.activeBooking.checkOutDate}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}
