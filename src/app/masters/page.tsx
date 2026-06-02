'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatINR, PAYMENT_CATEGORIES, propertyTitle } from '@/lib/tariffs';
import { useAuthStore } from '@/store/auth';
import { useCallback, useEffect, useState } from 'react';

interface Room {
  id: number;
  roomNumber: string;
  roomType: string;
  property: string;
  floor?: string;
  amenities?: string;
  status: string;
}

interface MasterRequest {
  id: number;
  requestType: string;
  roomNumber?: string;
  roomType?: string;
  property?: string;
  floor?: string;
  amenities?: string;
  pricePerNight?: number;
  targetRoom?: { roomNumber: string; property: string };
  status: string;
  requestedBy?: { fullName: string };
  reviewNotes?: string;
  requestNotes?: string;
  createdAt: string;
}

interface TariffEntry {
  roomCategoryKey: string;
  property: string;
  roomCategory: string;
  incidentalChargePerDay: number;
  ratesPerDayPerRoom: Record<string, number>;
}

type Tab = 'INVENTORY' | 'TARIFFS' | 'REQUESTS' | 'ADD';

const ROOM_TYPES = ['NORMAL', 'SUITE'];
const PROPERTIES = ['COIMBATORE', 'OOTY'];
const FLOORS = ['Ground', 'First', 'Second', 'Third'];

const STATUS_COLORS: Record<string, string> = {
  OCCUPIED: 'bg-red-50 text-red-700 border-red-200',
  MAINTENANCE: 'bg-amber-50 text-amber-700 border-amber-200',
  AVAILABLE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const REQ_COLORS: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
};

const statusLabel = (value: string) => value.charAt(0) + value.slice(1).toLowerCase();

export default function MastersPage() {
  const { user, hydrate } = useAuthStore();
  const [tab, setTab] = useState<Tab>('INVENTORY');
  const [rooms, setRooms] = useState<Room[]>([]);
  const [requests, setRequests] = useState<MasterRequest[]>([]);
  const [tariffs, setTariffs] = useState<Record<string, TariffEntry>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ COIMBATORE: true, OOTY: true });
  const [editingTariff, setEditingTariff] = useState('');
  const [editingRate, setEditingRate] = useState('');

  const [newRoom, setNewRoom] = useState({
    roomNumber: '',
    numberOfRooms: '1',
    roomType: 'NORMAL',
    property: 'COIMBATORE',
    floor: 'Ground',
    amenities: 'AC, Attached Bathroom, TV, Wi-Fi',
    requestNotes: '',
  });

  useEffect(() => { hydrate(); }, [hydrate]);

  const isEO = user?.role === 'ESTATE_OFFICER';

  const loadRooms = useCallback(async () => {
    try {
      const data: any = await api.get('/rooms');
      setRooms(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load rooms');
    }
  }, []);

  const loadRequests = useCallback(async () => {
    try {
      const url = isEO ? '/masters/requests' : '/masters/requests/mine';
      const data: any = await api.get(url);
      setRequests(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load requests');
    }
  }, [isEO]);

  const loadTariffs = useCallback(async () => {
    try {
      const data: any = await api.get('/masters/tariffs');
      setTariffs(data && typeof data === 'object' ? data : {});
    } catch {
      toast.error('Failed to load tariff categories');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadRooms(), loadRequests(), loadTariffs()]).finally(() => setLoading(false));
  }, [loadRooms, loadRequests, loadTariffs]);

  const submitNewRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoom.roomNumber) {
      toast.error('Room number is required');
      return;
    }
    setSubmitting(true);
    try {
      const payload = { ...newRoom, pricePerNight: 0 };
      const payloadWithCount = { ...payload, numberOfRooms: Math.max(1, Number(newRoom.numberOfRooms) || 1) };
      if (isEO) {
        await api.post('/masters/rooms', payloadWithCount);
        toast.success(payloadWithCount.numberOfRooms > 1 ? `${payloadWithCount.numberOfRooms} rooms created` : 'Room created');
        await loadRooms();
        setTab('INVENTORY');
      } else {
        await api.post('/masters/requests/room-create', payloadWithCount);
        toast.success('Room creation request submitted for EO approval');
        await loadRequests();
        setTab('REQUESTS');
      }
      setNewRoom({ roomNumber: '', numberOfRooms: '1', roomType: 'NORMAL', property: 'COIMBATORE', floor: 'Ground', amenities: 'AC, Attached Bathroom, TV, Wi-Fi', requestNotes: '' });
    } catch {
      toast.error('Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const reviewRequest = async (id: number, action: 'APPROVED' | 'REJECTED') => {
    try {
      await api.post(`/masters/requests/${id}/review`, { action, reviewNotes });
      toast.success(action === 'APPROVED' ? 'Request approved' : 'Request rejected');
      setReviewingId(null);
      setReviewNotes('');
      await loadRequests();
      if (action === 'APPROVED') await loadRooms();
    } catch {
      toast.error('Failed to review request');
    }
  };

  const saveTariffRate = async (roomCategoryKey: string, paymentCategory: string) => {
    const ratePerDay = Number(editingRate);
    if (Number.isNaN(ratePerDay) || ratePerDay < 0) {
      toast.error('Enter a valid rate');
      return;
    }
    try {
      const data: any = await api.patch('/masters/tariffs', { roomCategoryKey, paymentCategory, ratePerDay });
      setTariffs(data && typeof data === 'object' ? data : {});
      setEditingTariff('');
      setEditingRate('');
      toast.success('Tariff updated');
    } catch {
      toast.error('Failed to update tariff');
    }
  };

  const pendingCount = requests.filter((request) => request.status === 'PENDING').length;
  const activeRequests = requests.filter((request) => request.status !== 'APPROVED');
  const approvedRequests = requests.filter((request) => request.status === 'APPROVED');
  const tariffEntries = Object.values(tariffs).filter((entry): entry is TariffEntry => !!entry?.ratesPerDayPerRoom);
  const inputCls = 'w-full px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] outline-none bg-gray-50 focus:bg-white transition';
  const labelCls = 'block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide';

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/40">
      <Header title="Masters" />

      <main className="flex-1 overflow-y-auto p-6 forest-surface">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">Masters</h1>
              <p className="text-xs text-[#64748B]">Room inventory, official tariffs, and approval requests</p>
            </div>
            <div className="flex gap-3">
              <div className="rounded-lg border border-slate-200/60 bg-white px-4 py-2 text-center shadow-soft">
                <p className="text-xl font-bold text-[#0F172A]">{rooms.length}</p>
                <p className="text-[11px] text-[#64748B]">Rooms</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-center shadow-xs">
                <p className="text-xl font-bold text-amber-700">{pendingCount}</p>
                <p className="text-[11px] text-amber-700/70">Pending</p>
              </div>
            </div>
          </div>

          <div className="mb-5 flex w-fit flex-wrap gap-1 rounded-lg border border-slate-200/60 bg-white p-1 shadow-soft">
            {([
              { key: 'INVENTORY' as Tab, label: 'Inventory' },
              { key: 'TARIFFS' as Tab, label: 'Tariffs' },
              { key: 'REQUESTS' as Tab, label: `Requests${pendingCount ? ` (${pendingCount})` : ''}` },
              { key: 'ADD' as Tab, label: isEO ? 'Add Room' : 'Request Room' },
            ]).map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} className={`rounded-md px-4 py-1.5 text-xs font-bold transition-all duration-250 ${tab === key ? 'bg-[#2563EB] text-white shadow-soft' : 'text-[#64748B] hover:bg-blue-50/40 hover:text-[#2563EB]'}`}>
                {label}
              </button>
            ))}
          </div>

          {tab === 'INVENTORY' && (
            loading ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="skeleton h-36 rounded-lg" />)}</div>
            ) : (
              ['COIMBATORE', 'OOTY'].map((property) => {
                const propRooms = rooms.filter((room) => room.property === property);
                if (!propRooms.length) return null;
                const open = expanded[property];
                return (
                  <section key={property} className="mb-6 overflow-hidden rounded-lg border border-slate-200/60 bg-white shadow-soft">
                    <button type="button" onClick={() => setExpanded((prev) => ({ ...prev, [property]: !prev[property] }))} className="flex w-full items-center justify-between bg-slate-50/60 px-4 py-3 text-left transition-colors duration-250 hover:bg-slate-50">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg text-[#2563EB] transition-transform duration-250 ${open ? 'rotate-90' : ''}`}>&rsaquo;</span>
                        <div>
                          <h2 className="text-sm font-bold text-[#0F172A]">{propertyTitle(property)}</h2>
                          <p className="text-xs text-[#64748B]">{propRooms.length} room{propRooms.length === 1 ? '' : 's'}{property === 'COIMBATORE' ? ' ' : ''}</p>
                        </div>
                      </div>
                    </button>
                    {open && (
                      <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-4">
                        {propRooms.map((room) => (
                          <div key={room.id} className="rounded-lg border border-slate-100/60 bg-white p-4 shadow-xs transition-all duration-250 hover:border-slate-300 hover:border-solid hover:shadow-soft">
                            <div className="mb-3 flex items-start justify-between gap-2">
                              <div>
                                <p className="text-lg font-bold text-gray-900">{room.roomNumber}</p>
                                <p className="text-[11px] text-gray-500">{room.property === 'OOTY' ? 'Double/Three bedded Non AC' : room.roomType === 'SUITE' ? 'VIP Suite' : 'Double bedded (AC)'}</p>
                                {room.floor && <p className="text-[10px] text-gray-400">{room.floor}</p>}
                              </div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${STATUS_COLORS[room.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>{statusLabel(room.status)}</span>
                            </div>
                            {room.amenities && <p className="line-clamp-2 text-xs text-gray-500">{room.amenities}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })
            )
          )}

          {tab === 'TARIFFS' && (
            <div className="grid gap-4 lg:grid-cols-3">
              {tariffEntries.map((entry) => (
                <section key={`${entry.property}-${entry.roomCategory}`} className="rounded-lg border border-emerald-900/10 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">{propertyTitle(entry.property)}</p>
                  <h2 className="mt-1 text-base font-bold text-gray-900">{entry.roomCategory}</h2>
                  <p className="mt-1 text-xs text-gray-500">Incidental / maintenance: {formatINR(entry.incidentalChargePerDay)} per day</p>
                  <div className="mt-4 space-y-2">
                    {PAYMENT_CATEGORIES.map((category) => (
                      <div key={category.value} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 px-3 py-2">
                        <p className="text-xs font-semibold text-gray-700">{category.label}</p>
                        {isEO && editingTariff === `${entry.roomCategoryKey}-${category.value}` ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0"
                              value={editingRate}
                              onChange={(event) => setEditingRate(event.target.value)}
                              className="w-24 rounded-md border border-emerald-300 bg-white px-2 py-1 text-xs font-bold outline-none"
                              autoFocus
                            />
                            <button onClick={() => saveTariffRate(entry.roomCategoryKey, category.value)} className="rounded-md bg-[#2563EB] px-2 py-1 text-[11px] font-bold text-white">Save</button>
                            <button onClick={() => { setEditingTariff(''); setEditingRate(''); }} className="rounded-md px-2 py-1 text-[11px] font-bold text-gray-500">Cancel</button>
                          </div>
                        ) : isEO ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTariff(`${entry.roomCategoryKey}-${category.value}`);
                              setEditingRate(String(entry.ratesPerDayPerRoom[category.value] ?? 0));
                            }}
                            className="whitespace-nowrap rounded-md px-2 py-1 text-xs font-bold text-[#2563EB] transition hover:bg-blue-100"
                            title="Edit tariff"
                          >
                            {formatINR(entry.ratesPerDayPerRoom[category.value])}
                          </button>
                        ) : (
                          <span className="whitespace-nowrap text-xs font-bold text-gray-700">
                            {formatINR(entry.ratesPerDayPerRoom[category.value])}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          {tab === 'REQUESTS' && (
            <div className="space-y-5">
            <div className="overflow-hidden rounded-lg border border-gray-100 bg-white/90 shadow-sm backdrop-blur">
              <div className="border-b border-gray-100 bg-emerald-50/60 px-5 py-4">
                <h2 className="text-sm font-bold text-gray-900">Active Requests</h2>
                <p className="text-xs text-gray-500">Pending and rejected master requests for review tracking</p>
              </div>
              {activeRequests.length === 0 ? (
                <div className="py-14 text-center text-sm text-gray-400">No active master requests found</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        <th className="px-5 py-3 text-left">Type</th>
                        <th className="px-5 py-3 text-left">Details</th>
                        <th className="px-5 py-3 text-left">Requested By</th>
                        <th className="px-5 py-3 text-left">Status</th>
                        {isEO && <th className="px-5 py-3 text-left">Actions</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {activeRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-gray-50/70">
                          <td className="px-5 py-3.5">
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-bold text-sky-700">
                              {request.requestType === 'ROOM_CREATE' ? 'New Room' : 'Tariff Request'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-600">
                            {request.requestType === 'ROOM_CREATE' ? (
                              <>
                                <p className="font-bold text-gray-800">Room {request.roomNumber}</p>
                                <p className="text-gray-400">{request.roomType} - {request.property}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-bold text-gray-800">Room {request.targetRoom?.roomNumber}</p>
                                <p className="text-gray-400">Legacy price request: {formatINR(request.pricePerNight)}</p>
                              </>
                            )}
                            {request.requestNotes && <p className="mt-0.5 text-[11px] italic text-gray-400">{request.requestNotes}</p>}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-600">
                            <p className="font-medium">{request.requestedBy?.fullName ?? '-'}</p>
                            <p className="text-[11px] text-gray-400">{new Date(request.createdAt).toLocaleDateString('en-IN')}</p>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${REQ_COLORS[request.status] ?? 'bg-gray-100 text-gray-500 border-gray-200'}`}>{request.status}</span>
                            {request.reviewNotes && <p className="mt-1 max-w-[160px] truncate text-[10px] text-gray-400">Note: {request.reviewNotes}</p>}
                          </td>
                          {isEO && (
                            <td className="px-5 py-3.5">
                              {request.status === 'PENDING' && reviewingId !== request.id && (
                                <button onClick={() => setReviewingId(request.id)} className="text-xs font-bold text-[#2563EB] hover:underline">Review</button>
                              )}
                              {reviewingId === request.id && (
                                <div className="flex min-w-[320px] items-center gap-2">
                                  <input value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none" placeholder="Review notes" />
                                  <button onClick={() => reviewRequest(request.id, 'APPROVED')} className="rounded-md bg-[#2563EB] px-3 py-1.5 text-xs font-bold text-white">Approve</button>
                                  <button onClick={() => reviewRequest(request.id, 'REJECTED')} className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600">Reject</button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-lg border border-emerald-100 bg-white/90 shadow-sm backdrop-blur">
              <div className="border-b border-emerald-100 bg-white px-5 py-4">
                <h2 className="text-sm font-bold text-gray-900">Approved Requests</h2>
                <p className="text-xs text-gray-500">Completed master approvals listed separately below</p>
              </div>
              {approvedRequests.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-400">No approved requests yet</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                        <th className="px-5 py-3 text-left">Type</th>
                        <th className="px-5 py-3 text-left">Approved Details</th>
                        <th className="px-5 py-3 text-left">Requested By</th>
                        <th className="px-5 py-3 text-left">Approved On</th>
                        <th className="px-5 py-3 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {approvedRequests.map((request) => (
                        <tr key={request.id} className="hover:bg-emerald-50/40">
                          <td className="px-5 py-3.5">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                              {request.requestType === 'ROOM_CREATE' ? 'New Room' : 'Tariff Request'}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-600">
                            {request.requestType === 'ROOM_CREATE' ? (
                              <>
                                <p className="font-bold text-gray-800">Room {request.roomNumber}</p>
                                <p className="text-gray-400">{request.roomType} - {request.property}</p>
                              </>
                            ) : (
                              <>
                                <p className="font-bold text-gray-800">Room {request.targetRoom?.roomNumber}</p>
                                <p className="text-gray-400">Approved value: {formatINR(request.pricePerNight)}</p>
                              </>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-gray-600">{request.requestedBy?.fullName ?? '-'}</td>
                          <td className="px-5 py-3.5 text-xs text-gray-500">{new Date(request.createdAt).toLocaleDateString('en-IN')}</td>
                          <td className="px-5 py-3.5 text-xs text-gray-500">{request.reviewNotes || request.requestNotes || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            </div>
          )}

          {tab === 'ADD' && (
            <section className="max-w-xl rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-800">{isEO ? 'Add New Room' : 'Request New Room'}</h2>
              <p className="mt-1 text-xs text-gray-500">Tariff rates are managed by official category, not individual room price.</p>
              <form onSubmit={submitNewRoom} className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Room Number *</label>
                    <input required value={newRoom.roomNumber} onChange={(event) => setNewRoom((prev) => ({ ...prev, roomNumber: event.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>No. of Rooms</label>
                    <input type="number" min="1" value={newRoom.numberOfRooms} onChange={(event) => setNewRoom((prev) => ({ ...prev, numberOfRooms: event.target.value }))} className={inputCls} />
                    <p className="mt-1 text-[10px] text-gray-400">If more than 1, room numbers increment from the starting room number.</p>
                  </div>
                  <div>
                    <label className={labelCls}>Room Type</label>
                    <select value={newRoom.roomType} onChange={(event) => setNewRoom((prev) => ({ ...prev, roomType: event.target.value }))} className={`${inputCls} cursor-pointer`}>
                      {ROOM_TYPES.map((type) => <option key={type} value={type}>{type === 'SUITE' ? 'Suite' : 'Normal'}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Property</label>
                    <select value={newRoom.property} onChange={(event) => setNewRoom((prev) => ({ ...prev, property: event.target.value }))} className={`${inputCls} cursor-pointer`}>
                      {PROPERTIES.map((property) => <option key={property} value={property}>{propertyTitle(property)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Floor</label>
                    <select value={newRoom.floor} onChange={(event) => setNewRoom((prev) => ({ ...prev, floor: event.target.value }))} className={`${inputCls} cursor-pointer`}>
                      {FLOORS.map((floor) => <option key={floor} value={floor}>{floor}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Amenities</label>
                    <input value={newRoom.amenities} onChange={(event) => setNewRoom((prev) => ({ ...prev, amenities: event.target.value }))} className={inputCls} />
                  </div>
                  <div className="col-span-2">
                    <label className={labelCls}>Notes</label>
                    <input value={newRoom.requestNotes} onChange={(event) => setNewRoom((prev) => ({ ...prev, requestNotes: event.target.value }))} className={inputCls} />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button type="submit" disabled={submitting} className="rounded-lg bg-[#2563EB] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60">
                    {submitting ? 'Submitting...' : isEO ? 'Create Room' : 'Submit for Approval'}
                  </button>
                </div>
              </form>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
