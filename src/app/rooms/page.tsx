'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatINR, propertyTitle } from '@/lib/tariffs';
import { useAuthStore } from '@/store/auth';
import { useEffect, useState, useCallback } from 'react';

interface ActiveBooking {
  bookingId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
}

interface RoomBlock {
  id: number;
  startDate: string;
  endDate: string;
  reason?: string;
}

interface RoomWithBooking {
  id: number;
  roomNumber: string;
  roomType: string;
  property: string;
  status: string;
  floor?: string;
  amenities?: string;
  pricePerNight?: number;
  tariffCategory?: string;
  privatePersonsRatePerDay?: number;
  incidentalChargePerDay?: number;
  activeBooking?: ActiveBooking;
}

interface BlockModalState { roomId: number; roomNumber: string; }

const PROPERTY_FILTER = ['ALL', 'COIMBATORE', 'OOTY'];

export default function RoomsPage() {
  const { user, hydrate } = useAuthStore();
  const [rooms, setRooms] = useState<RoomWithBooking[]>([]);
  const [blocks, setBlocks] = useState<Record<number, RoomBlock[]>>({});
  const [loading, setLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState('ALL');
  const [blockModal, setBlockModal] = useState<BlockModalState | null>(null);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blocking, setBlocking] = useState(false);

  useEffect(() => { hydrate(); }, [hydrate]);
  const isEO = user?.role === 'ESTATE_OFFICER';

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const [roomData, blockData]: any[] = await Promise.all([
        api.get('/rooms/with-bookings'),
        api.get('/rooms/blocks'),
      ]);
      const roomList: RoomWithBooking[] = Array.isArray(roomData) ? roomData : [];
      setRooms(roomList);

      // Group blocks by roomId
      const blockMap: Record<number, RoomBlock[]> = {};
      if (Array.isArray(blockData)) {
        blockData.forEach((blk: any) => {
          const rid = blk.room?.id;
          if (rid) {
            if (!blockMap[rid]) blockMap[rid] = [];
            blockMap[rid].push({ id: blk.id, startDate: blk.startDate, endDate: blk.endDate, reason: blk.reason });
          }
        });
      }
      setBlocks(blockMap);
    } catch {
      toast.error('Failed to load rooms');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      await api.patch(`/rooms/${id}/status?status=${newStatus}`);
      setRooms((prev) => prev.map((r) => r.id === id ? { ...r, status: newStatus } : r));
      toast.success('Room status updated');
    } catch { toast.error('Failed to update status'); }
  };

  const submitBlock = async () => {
    if (!blockModal || !blockStart || !blockEnd) { toast.error('Select start and end dates'); return; }
    if (blockStart >= blockEnd) { toast.error('End date must be after start date'); return; }
    setBlocking(true);
    try {
      const url = `/rooms/${blockModal.roomId}/block?startDate=${blockStart}&endDate=${blockEnd}${blockReason ? `&reason=${encodeURIComponent(blockReason)}` : ''}`;
      await api.post(url);
      toast.success(`Room ${blockModal.roomNumber} blocked`);
      setBlockModal(null);
      await loadRooms();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to block room');
    } finally { setBlocking(false); }
  };

  const unblock = async (blockId: number) => {
    try {
      await api.delete(`/rooms/blocks/${blockId}`);
      toast.success('Block removed');
      await loadRooms();
    } catch { toast.error('Failed to remove block'); }
  };

  const filtered = rooms.filter((r) => propertyFilter === 'ALL' || r.property === propertyFilter);
  const isBooked = (r: RoomWithBooking) => !!r.activeBooking && r.status === 'AVAILABLE';
  const isBlocked = (r: RoomWithBooking) => (blocks[r.id] ?? []).length > 0;

  const available = filtered.filter((r) => r.status === 'AVAILABLE' && !isBooked(r) && !isBlocked(r));
  const occupied = filtered.filter((r) => r.status === 'OCCUPIED' || isBooked(r));
  const maintenance = filtered.filter((r) => r.status === 'MAINTENANCE');
  const blockedRooms = filtered.filter((r) => isBlocked(r) && r.status !== 'OCCUPIED');

  const stats = [
    { label: 'Total', value: filtered.length, bg: 'bg-slate-700', text: 'text-white' },
    { label: 'Available', value: available.length, bg: 'bg-emerald-600', text: 'text-white' },
    { label: 'Occupied', value: occupied.length, bg: 'bg-red-500', text: 'text-white' },
    { label: 'Maintenance', value: maintenance.length, bg: 'bg-amber-500', text: 'text-white' },
    { label: 'Blocked', value: blockedRooms.length, bg: 'bg-orange-500', text: 'text-white' },
  ];

  const RoomCard = ({ room }: { room: RoomWithBooking }) => {
    const booked = isBooked(room);
    const blocked = isBlocked(room);
    const roomBlocks = blocks[room.id] ?? [];

    let cardBg = 'bg-emerald-500';
    let textPrimary = 'text-white';
    let textSecondary = 'text-emerald-100';
    let badgeBg = 'bg-emerald-700 text-white';
    let statusLabel = 'Available';

    if (room.status === 'OCCUPIED' || booked) {
      cardBg = 'bg-red-500'; textPrimary = 'text-white'; textSecondary = 'text-red-100';
      badgeBg = 'bg-red-700 text-white'; statusLabel = booked ? 'Booked' : 'Occupied';
    } else if (room.status === 'MAINTENANCE') {
      cardBg = 'bg-amber-500'; textPrimary = 'text-white'; textSecondary = 'text-amber-100';
      badgeBg = 'bg-amber-700 text-white'; statusLabel = 'Maintenance';
    } else if (blocked) {
      cardBg = 'bg-orange-500'; textPrimary = 'text-white'; textSecondary = 'text-orange-100';
      badgeBg = 'bg-orange-700 text-white'; statusLabel = 'Blocked';
    }

    const displayRate = room.privatePersonsRatePerDay ?? room.pricePerNight;

    return (
      <div className={`rounded-2xl ${cardBg} p-4 shadow-md flex flex-col gap-2 transition hover:scale-[1.02] hover:shadow-lg`}>
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-lg font-black ${textPrimary}`}>{room.roomNumber}</p>
            <p className={`text-[11px] font-medium ${textSecondary}`}>
              {room.tariffCategory ?? (room.roomType === 'SUITE' ? 'VIP Suite' : 'Double Bedded AC')}
            </p>
            {room.floor && <p className={`text-[10px] ${textSecondary}`}>{room.floor} floor</p>}
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${badgeBg}`}>{statusLabel}</span>
        </div>

        {displayRate && (
          <p className={`text-xs font-bold ${textSecondary}`}>{formatINR(displayRate)}/day</p>
        )}

        {room.activeBooking && (
          <div className="rounded-xl bg-black/20 px-2.5 py-1.5 text-[10px]">
            <p className={`font-bold truncate ${textPrimary}`}>{room.activeBooking.guestName}</p>
            <p className={textSecondary}>{room.activeBooking.checkInDate} → {room.activeBooking.checkOutDate}</p>
          </div>
        )}

        {blocked && roomBlocks.map((blk) => (
          <div key={blk.id} className="rounded-xl bg-black/20 px-2.5 py-1.5 text-[10px]">
            <div className="flex items-center justify-between gap-1">
              <div>
                <p className={`font-bold ${textPrimary}`}>{blk.startDate} → {blk.endDate}</p>
                {blk.reason && <p className={`truncate ${textSecondary}`}>{blk.reason}</p>}
              </div>
              {isEO && (
                <button onClick={() => unblock(blk.id)} className="shrink-0 rounded-lg bg-black/30 px-1.5 py-0.5 text-[10px] font-bold text-white hover:bg-black/50">✕ Unblock</button>
              )}
            </div>
          </div>
        ))}

        {isEO && (
          <div className="mt-auto flex gap-1.5 pt-1">
            <select
              value={room.status}
              onChange={(e) => updateStatus(room.id, e.target.value)}
              className="flex-1 rounded-lg bg-black/20 px-2 py-1.5 text-[11px] font-bold text-white outline-none border border-white/20"
            >
              <option value="AVAILABLE" className="text-black">Available</option>
              <option value="OCCUPIED" className="text-black">Occupied</option>
              <option value="MAINTENANCE" className="text-black">Maintenance</option>
            </select>
            <button
              onClick={() => { setBlockModal({ roomId: room.id, roomNumber: room.roomNumber }); setBlockStart(''); setBlockEnd(''); setBlockReason(''); }}
              className="shrink-0 rounded-lg bg-black/20 border border-white/20 px-2 py-1.5 text-[11px] font-bold text-white hover:bg-black/30 transition"
              title="Block dates"
            >
              Block
            </button>
          </div>
        )}
      </div>
    );
  };

  const Section = ({ title, rooms: sectionRooms, accent }: { title: string; rooms: RoomWithBooking[]; accent: string }) => {
    const [open, setOpen] = useState(true);
    if (sectionRooms.length === 0) return null;
    return (
      <section className="mb-6">
        <button
          onClick={() => setOpen((v) => !v)}
          className={`mb-3 flex items-center gap-3 text-sm font-bold text-gray-800`}
        >
          <span className={`flex h-6 min-w-[24px] items-center justify-center rounded-full ${accent} text-[11px] font-black text-white px-2`}>
            {sectionRooms.length}
          </span>
          {title}
          <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {sectionRooms.map((r) => <RoomCard key={r.id} room={r} />)}
          </div>
        )}
      </section>
    );
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-slate-50/50">
      <Header title="Rooms" />
      <main className="flex-1 overflow-y-auto p-6">

        {/* Stats */}
        {!loading && (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label} className={`rounded-2xl p-4 ${s.bg} shadow-md`}>
                <p className={`text-2xl font-black ${s.text}`}>{s.value}</p>
                <p className={`text-[11px] font-semibold ${s.text} opacity-90`}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Filter */}
        <div className="mb-5 flex items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-gray-200 bg-white p-1">
            {PROPERTY_FILTER.map((p) => (
              <button key={p} onClick={() => setPropertyFilter(p)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${propertyFilter === p ? 'bg-[#2563EB] text-white' : 'text-gray-500 hover:text-[#2563EB]'}`}>
                {p === 'ALL' ? 'All Properties' : propertyTitle(p)}
              </button>
            ))}
          </div>
          <button onClick={loadRooms} className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-50 transition">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => <div key={i} className="skeleton h-36 rounded-2xl" />)}
          </div>
        ) : (
          <>
            <Section title="Available Rooms" rooms={available} accent="bg-emerald-600" />
            <Section title="Occupied / Booked" rooms={occupied} accent="bg-red-500" />
            <Section title="Under Maintenance" rooms={maintenance} accent="bg-amber-500" />
            <Section title="Blocked Rooms" rooms={blockedRooms} accent="bg-orange-500" />
            {available.length === 0 && occupied.length === 0 && maintenance.length === 0 && blockedRooms.length === 0 && (
              <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-gray-400">
                No rooms found for the selected property
              </div>
            )}
          </>
        )}
      </main>

      {/* Block Modal */}
      {blockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-bold text-gray-900">Block Room {blockModal.roomNumber}</h3>
            <p className="mb-4 text-xs text-gray-500">Blocked rooms won't appear in booking availability for the selected period.</p>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Start Date *</label>
                <input type="date" value={blockStart} onChange={(e) => setBlockStart(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">End Date *</label>
                <input type="date" value={blockEnd} onChange={(e) => setBlockEnd(e.target.value)} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</label>
                <input type="text" value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="e.g. Maintenance, VIP reservation..." className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
              </div>
            </div>
            <div className="mt-5 flex gap-2">
              <button onClick={() => setBlockModal(null)} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={submitBlock} disabled={blocking} className="flex-1 rounded-xl bg-orange-600 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60">
                {blocking ? 'Blocking...' : 'Block Room'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
