'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { propertyTitle } from '@/lib/tariffs';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';

interface Room {
  id: number;
  roomNumber: string;
  property: string;
  roomType: string;
  floor?: string;
  status?: string;
}

interface Booking {
  id: number;
  bookingId: string;
  guestName: string;
  guestPhone: string;
  guestOrganization?: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  notes?: string;
  room?: Room;
  rooms?: Room[];
}

interface ShiftModal {
  booking: Booking;
  availableRooms: Room[];
}

interface ExtendModal {
  booking: Booking;
}

function primaryRoom(b: Booking): Room | null {
  if (b.rooms && b.rooms.length > 0) return b.rooms[0];
  return b.room ?? null;
}

function roomLabel(b: Booking): string {
  if (b.rooms && b.rooms.length > 0) return b.rooms.map((r) => r.roomNumber).join(', ');
  if (b.room) return b.room.roomNumber;
  return 'Not Allocated';
}

const STATUS_BADGE: Record<string, string> = {
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  CHECKED_IN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function ReallocationPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ShiftModal | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [reason, setReason] = useState('');
  const [shifting, setShifting] = useState(false);
  const [filter, setFilter] = useState<'ALL' | 'APPROVED' | 'CHECKED_IN'>('ALL');

  const [extendModal, setExtendModal] = useState<ExtendModal | null>(null);
  const [newCheckOutDate, setNewCheckOutDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [extending, setExtending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await api.get('/bookings');
      const all: Booking[] = Array.isArray(data) ? data : [];
      setBookings(
        all.filter((b) => b.status === 'APPROVED' || b.status === 'CHECKED_IN'),
      );
    } catch {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openShiftModal = async (booking: Booking) => {
    try {
      const rooms: any = await api.get(
        `/rooms/available?checkIn=${booking.checkInDate}&checkOut=${booking.checkOutDate}`,
      );
      setModal({
        booking,
        availableRooms: Array.isArray(rooms) ? rooms : [],
      });
      setSelectedRoomId('');
      setReason('');
    } catch {
      toast.error('Failed to load available rooms');
    }
  };

  const confirmShift = async () => {
    if (!modal) return;
    if (!selectedRoomId) { toast.error('Select a room'); return; }
    if (!reason.trim()) { toast.error('Reason is required'); return; }
    setShifting(true);
    try {
      await api.post(
        `/bookings/${modal.booking.id}/shift-room?newRoomId=${selectedRoomId}&reason=${encodeURIComponent(reason)}`,
      );
      toast.success('Room reallocated. AEO and EO have been notified.');
      setModal(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to reallocate room');
    } finally {
      setShifting(false);
    }
  };

  const confirmExtend = async () => {
    if (!extendModal) return;
    if (!newCheckOutDate) { toast.error('Select a new check-out date'); return; }
    setExtending(true);
    try {
      await api.post(
        `/bookings/${extendModal.booking.id}/extend-stay?newCheckOutDate=${newCheckOutDate}${extendReason ? `&reason=${encodeURIComponent(extendReason)}` : ''}`,
      );
      toast.success('Stay extended. EO has been notified.');
      setExtendModal(null);
      await load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to extend stay');
    } finally {
      setExtending(false);
    }
  };

  const filtered = bookings.filter(
    (b) => filter === 'ALL' || b.status === filter,
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/40">
      <Header title="Room Reallocation" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">
          {/* Page header */}
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">Room Reallocation</h1>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Shift a guest from their current room to a new room. AEO and EO are notified automatically.
              </p>
            </div>
            <div className="flex gap-2 text-xs">
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-center">
                <p className="text-lg font-bold text-blue-700">{bookings.filter((b) => b.status === 'APPROVED').length}</p>
                <p className="text-[10px] font-semibold text-blue-600">Approved</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center">
                <p className="text-lg font-bold text-emerald-700">{bookings.filter((b) => b.status === 'CHECKED_IN').length}</p>
                <p className="text-[10px] font-semibold text-emerald-600">Checked In</p>
              </div>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="mb-5 flex w-fit gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
            {(['ALL', 'APPROVED', 'CHECKED_IN'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-all ${filter === f ? 'bg-[#2563EB] text-white shadow-sm' : 'text-[#64748B] hover:text-[#2563EB]'}`}
              >
                {f === 'ALL' ? 'All' : f === 'APPROVED' ? 'Approved' : 'Checked In'}
              </button>
            ))}
          </div>

          {/* Booking list */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-44 rounded-2xl" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-400 shadow-sm">
              No bookings available for reallocation
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {filtered.map((b) => {
                const room = primaryRoom(b);
                return (
                  <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <Link href={`/bookings/${b.id}`} className="text-[11px] font-bold text-[#2563EB] hover:underline">
                          {b.bookingId}
                        </Link>
                        <p className="mt-0.5 text-base font-bold text-gray-900">{b.guestName}</p>
                        {b.guestOrganization && (
                          <p className="text-xs text-gray-500">{b.guestOrganization}</p>
                        )}
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${STATUS_BADGE[b.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        {b.status === 'CHECKED_IN' ? 'Checked In' : 'Approved'}
                      </span>
                    </div>

                    <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-xl bg-blue-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Check-In</p>
                        <p className="mt-0.5 font-bold text-slate-800">{b.checkInDate}</p>
                      </div>
                      <div className="rounded-xl bg-emerald-50 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500">Check-Out</p>
                        <p className="mt-0.5 font-bold text-slate-800">{b.checkOutDate}</p>
                      </div>
                    </div>

                    {/* Current room */}
                    <div className="mb-4 flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2.5 text-xs">
                      <svg className="h-3.5 w-3.5 shrink-0 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                      </svg>
                      <div>
                        <span className="font-bold text-orange-800">Current Room: {roomLabel(b)}</span>
                        {room?.property && (
                          <span className="ml-1 text-orange-600">— {propertyTitle(room.property)}</span>
                        )}
                      </div>
                    </div>

                    {b.notes && (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                        <p className="font-bold text-amber-700">⚠ Special Instructions</p>
                        <p className="mt-0.5 text-amber-800">{b.notes}</p>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => openShiftModal(b)}
                        className="flex-1 rounded-xl bg-[#2563EB] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#1D4ED8] transition flex items-center justify-center gap-1.5"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                        Reallocate
                      </button>
                      <button
                        onClick={() => {
                          setNewCheckOutDate('');
                          setExtendReason('');
                          setExtendModal({ booking: b });
                        }}
                        className="flex-1 rounded-xl border border-violet-200 bg-violet-50 px-4 py-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100 transition flex items-center justify-center gap-1.5"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Extend Stay
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Extend Stay Modal */}
      {extendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-800">Extend Stay</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Guest: <strong>{extendModal.booking.guestName}</strong> · Current check-out: <strong>{extendModal.booking.checkOutDate}</strong>
              </p>
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                New Check-Out Date *
              </label>
              <input
                type="date"
                value={newCheckOutDate}
                min={(() => {
                  const d = new Date(extendModal.booking.checkOutDate);
                  d.setDate(d.getDate() + 1);
                  return d.toISOString().slice(0, 10);
                })()}
                onChange={(e) => setNewCheckOutDate(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:bg-white transition"
              />
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Reason (optional)
              </label>
              <textarea
                value={extendReason}
                onChange={(e) => setExtendReason(e.target.value)}
                rows={3}
                placeholder="e.g. Guest extended trip, event delayed..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-violet-400 focus:bg-white transition"
              />
              <p className="mt-1 text-[10px] text-slate-400">EO will be notified automatically.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setExtendModal(null)}
                className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmExtend}
                disabled={extending || !newCheckOutDate}
                className="flex-1 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition"
              >
                {extending ? 'Extending...' : 'Confirm Extension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Room Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4">
              <h3 className="text-base font-bold text-slate-800">Reallocate Room</h3>
              <p className="mt-0.5 text-xs text-slate-500">
                Guest: <strong>{modal.booking.guestName}</strong> · Current room: <strong>{roomLabel(modal.booking)}</strong>
              </p>
            </div>

            <div className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Select New Room
              </p>
              <div className="max-h-52 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                {modal.availableRooms.length === 0 ? (
                  <p className="py-6 text-center text-xs text-slate-400">No other rooms available for these dates</p>
                ) : (
                  modal.availableRooms.map((r) => (
                    <label
                      key={r.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition ${
                        selectedRoomId === String(r.id)
                          ? 'border-blue-300 bg-blue-50'
                          : 'border-white bg-white hover:border-blue-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="newRoom"
                        value={String(r.id)}
                        checked={selectedRoomId === String(r.id)}
                        onChange={() => setSelectedRoomId(String(r.id))}
                        className="accent-[#2563EB]"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800">Room {r.roomNumber}</p>
                        <p className="text-xs text-slate-500">
                          {propertyTitle(r.property)} · {r.roomType}
                          {r.floor ? ` · ${r.floor}` : ''}
                        </p>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div className="mb-5">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Reason for Reallocation *
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Guest request, maintenance issue, VIP upgrade, plumbing problem..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-blue-400 focus:bg-white transition"
              />
              <p className="mt-1 text-[10px] text-slate-400">This reason will be sent to AEO and Estate Officer.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setModal(null)}
                className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={confirmShift}
                disabled={shifting || !selectedRoomId || !reason.trim()}
                className="flex-1 rounded-2xl bg-[#2563EB] px-5 py-3 text-sm font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-60 transition"
              >
                {shifting ? 'Reallocating...' : 'Confirm Reallocation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
