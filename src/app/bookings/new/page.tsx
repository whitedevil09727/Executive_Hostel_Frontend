'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import {
  formatINR,
  PAYMENT_CATEGORIES,
  propertyTitle,
  roomTariffKey,
} from '@/lib/tariffs';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

const ID_TYPES = [
  'Aadhaar Card',
  'PAN Card',
  'Passport',
  'Driving Licence',
  'Voter ID',
  'Service ID Card',
];

const ID_RULES: Record<
  string,
  {
    label: string;
    placeholder: string;
    pattern: RegExp;
    maxLength?: number;
    hint: string;
  }
> = {
  'Aadhaar Card': {
    label: 'Aadhaar Number',
    placeholder: '12 digit Aadhaar number',
    pattern: /^\d{12}$/,
    maxLength: 12,
    hint: 'Enter exactly 12 digits.',
  },
  'PAN Card': {
    label: 'PAN Number',
    placeholder: 'ABCDE1234F',
    pattern: /^[A-Z]{5}[0-9]{4}[A-Z]$/,
    maxLength: 10,
    hint: 'Format: 5 letters, 4 digits, 1 letter.',
  },
  Passport: {
    label: 'Passport Number',
    placeholder: 'A1234567',
    pattern: /^[A-Z][0-9]{7}$/,
    maxLength: 8,
    hint: 'Format: 1 letter followed by 7 digits.',
  },
  'Driving Licence': {
    label: 'Driving Licence Number',
    placeholder: 'TN0120200001234',
    pattern: /^[A-Z]{2}[0-9]{2}[0-9A-Z]{9,13}$/,
    maxLength: 17,
    hint: 'Use state code followed by licence number.',
  },
  'Voter ID': {
    label: 'Voter ID Number',
    placeholder: 'ABC1234567',
    pattern: /^[A-Z]{3}[0-9]{7}$/,
    maxLength: 10,
    hint: 'Format: 3 letters followed by 7 digits.',
  },
  'Service ID Card': {
    label: 'Service ID Number',
    placeholder: 'Department service ID',
    pattern: /^[A-Z0-9/-]{4,30}$/,
    maxLength: 30,
    hint: 'Use 4 to 30 letters, numbers, slash or hyphen.',
  },
};

function hasUsableToken() {
  const token = localStorage.getItem('token');
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return !payload.exp || payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

interface Room {
  id: number;
  roomNumber: string;
  roomType: string;
  property: string;
  floor?: string;
  amenities?: string;
  tariffCategory?: string;
  privatePersonsRatePerDay?: number;
  incidentalChargePerDay?: number;
  pricePerNight?: number;
  status: string;
}

interface TariffEntry {
  roomCategory: string;
  incidentalChargePerDay: number;
  ratesPerDayPerRoom: Record<string, number>;
}

export default function NewBookingPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [tariffs, setTariffs] = useState<Record<string, TariffEntry>>({});
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<Room[]>([]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    COIMBATORE: true,
    OOTY: true,
  });

  const [form, setForm] = useState({
    guestName: '',
    guestEmail: '',
    guestPhone: '',
    guestOrganization: '',
    guestIdType: '',
    guestIdNumber: '',
    referredBy: '',
    checkInDate: '',
    checkInTime: '',
    checkOutDate: '',
    paymentCategory: 'PRIVATE_PERSONS',
    notes: '',
  });

  const set = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const idRule = form.guestIdType
    ? ID_RULES[form.guestIdType]
    : undefined;

  const nights = useMemo(() => {
    if (!form.checkInDate || !form.checkOutDate) return 0;
    const diff =
      new Date(form.checkOutDate).getTime() -
      new Date(form.checkInDate).getTime();
    return Math.max(0, Math.floor(diff / 86400000));
  }, [form.checkInDate, form.checkOutDate]);

  const chargeRows = selectedRooms.map((room) => {
    const tariff = tariffs[roomTariffKey(room)];
    const roomCategory =
      tariff?.roomCategory ??
      room.tariffCategory ??
      (room.property === 'OOTY'
        ? 'Double/Three bedded Non AC'
        : room.roomType === 'SUITE'
        ? 'VIP Suite'
        : 'Double bedded (AC)');
    const rentPerDay =
      tariff?.ratesPerDayPerRoom?.[form.paymentCategory] ??
      room.privatePersonsRatePerDay ??
      room.pricePerNight ??
      0;
    const incidentalPerDay =
      room.incidentalChargePerDay ??
      (room.property === 'OOTY' ? 300 : 250);
    return {
      room,
      roomCategory,
      rentPerDay,
      incidentalPerDay,
      total: (rentPerDay + incidentalPerDay) * nights,
    };
  });

  const rentAmount = chargeRows.reduce((s, r) => s + r.rentPerDay * nights, 0);
  const incidentalAmount = chargeRows.reduce(
    (s, r) => s + r.incidentalPerDay * nights,
    0
  );
  const totalAmount = rentAmount + incidentalAmount;

  useEffect(() => {
    api
      .get('/masters/tariffs')
      .then((data: any) =>
        setTariffs(data && typeof data === 'object' ? data : {})
      )
      .catch(() => setTariffs({}));
  }, []);

  useEffect(() => {
    if (
      form.checkInDate &&
      form.checkOutDate &&
      new Date(form.checkOutDate) > new Date(form.checkInDate)
    ) {
      setLoadingRooms(true);
      api
        .get(
          `/rooms/available?checkIn=${form.checkInDate}&checkOut=${form.checkOutDate}`
        )
        .then((data: any) => {
          const nextRooms = Array.isArray(data) ? data : [];
          setRooms(nextRooms);
          setSelectedRooms((prev) =>
            prev.filter((sel) =>
              nextRooms.some((room: Room) => room.id === sel.id)
            )
          );
        })
        .catch(() => setRooms([]))
        .finally(() => setLoadingRooms(false));
    } else {
      setRooms([]);
      setSelectedRooms([]);
    }
  }, [form.checkInDate, form.checkOutDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasUsableToken()) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      toast.error('Session expired. Please login again.');
      router.replace('/');
      return;
    }

    if (!form.guestName || !form.guestPhone) {
      toast.error('Guest name and phone are required');
      return;
    }

    if (!selectedRooms.length) {
      toast.error('Please select at least one room');
      return;
    }

    if (
      idRule &&
      form.guestIdNumber &&
      !idRule.pattern.test(form.guestIdNumber.toUpperCase())
    ) {
      toast.error(`Invalid ${idRule.label}. ${idRule.hint}`);
      return;
    }

    setLoading(true);
    try {
      const data: any = await api.post('/bookings', {
        ...form,
        roomIds: selectedRooms.map((room) => room.id),
        paymentCategory: form.paymentCategory,
      });
      toast.success(`Booking ${data.bookingId} created!`);
      router.push(`/bookings/${data.id}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB] outline-none bg-white transition-all duration-200 shadow-sm hover:border-slate-300';

  const selectCls =
    'w-full appearance-none px-3.5 pr-11 py-2.5 border border-slate-200 rounded-xl text-sm focus:ring-4 focus:ring-[#2563EB]/10 focus:border-[#2563EB] outline-none bg-white transition-all duration-200 shadow-sm hover:border-slate-300 cursor-pointer text-slate-700';

  const labelCls =
    'block text-xs font-semibold text-[#64748B] mb-1.5 uppercase tracking-wide';

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
      <Header title="New Booking" />

      <main className="flex-1 overflow-y-auto p-6 forest-surface">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm text-[#64748B] hover:text-[#0F172A] hover:shadow-md transition-all duration-200"
            >
              <span className="sr-only">Go back</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-[#0F172A]">Create New Booking</h1>
              <p className="text-xs text-[#64748B]">Official tariffs are applied by guest category.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* ─── GUEST INFORMATION ─── */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-sm font-bold text-[#0F172A]">Guest Information</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Full Name *</label>
                  <input required value={form.guestName} onChange={(e) => set('guestName', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Phone *</label>
                  <input required value={form.guestPhone} onChange={(e) => set('guestPhone', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.guestEmail} onChange={(e) => set('guestEmail', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Organization / Department</label>
                  <input value={form.guestOrganization} onChange={(e) => set('guestOrganization', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>ID Type</label>
                  <div className="relative">
                    <select
                      value={form.guestIdType}
                      onChange={(e) => setForm((prev) => ({ ...prev, guestIdType: e.target.value, guestIdNumber: '' }))}
                      className={selectCls}
                    >
                      <option value="">Select ID type</option>
                      {ID_TYPES.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>{idRule?.label ?? 'ID Number'}</label>
                  <input
                    value={form.guestIdNumber}
                    onChange={(e) => set('guestIdNumber', e.target.value.toUpperCase())}
                    className={inputCls}
                    placeholder={idRule?.placeholder ?? 'Select ID type first'}
                    maxLength={idRule?.maxLength}
                    disabled={!form.guestIdType}
                  />
                  <p className="mt-1 text-[10px] text-[#94A3B8]">
                    {idRule?.hint ?? 'ID number field changes based on selected ID type.'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Referred By</label>
                  <input
                    value={form.referredBy}
                    onChange={(e) => set('referredBy', e.target.value)}
                    className={inputCls}
                    placeholder="Name or designation of referring person / officer"
                  />
                </div>
              </div>
            </section>

            {/* ─── DATES & PAYMENT CATEGORY ─── */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-sm font-bold text-[#0F172A]">Stay Details</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className={labelCls}>Check-In Date * <span className="text-[10px] font-normal text-gray-400">(max 60 days ahead)</span></label>
                  <input
                    type="date"
                    required
                    value={form.checkInDate}
                    min={new Date().toISOString().slice(0, 10)}
                    max={new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)}
                    onChange={(e) => set('checkInDate', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Check-In Time</label>
                  <input type="time" value={form.checkInTime} onChange={(e) => set('checkInTime', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Check-Out Date *</label>
                  <input
                    type="date"
                    required
                    value={form.checkOutDate}
                    min={form.checkInDate || new Date().toISOString().slice(0, 10)}
                    max={new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10)}
                    onChange={(e) => set('checkOutDate', e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Guest Category *</label>
                  <div className="relative">
                    <select value={form.paymentCategory} onChange={(e) => set('paymentCategory', e.target.value)} className={selectCls}>
                      {PAYMENT_CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4">
                      <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ─── ROOM SELECTION ─── */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-sm font-bold text-[#0F172A]">
                Room Selection
                {selectedRooms.length > 0 && (
                  <span className="ml-2 text-xs font-semibold text-[#2563EB] bg-blue-50 px-2 py-0.5 rounded-full">
                    {selectedRooms.length} selected
                  </span>
                )}
              </h2>

              {(!form.checkInDate || !form.checkOutDate || new Date(form.checkOutDate) <= new Date(form.checkInDate)) ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-xs text-[#64748B]">
                  Please enter valid check-in and check-out dates above to load available rooms.
                </div>
              ) : loadingRooms ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="skeleton h-28 rounded-xl" />
                  ))}
                </div>
              ) : rooms.length === 0 ? (
                <div className="rounded-xl border border-dashed border-red-200 bg-red-50/30 p-8 text-center text-xs text-red-600 font-semibold">
                  No available rooms found for the selected dates.
                </div>
              ) : (
                <div className="space-y-4">
                  {['COIMBATORE', 'OOTY'].map((prop) => {
                    const propRooms = rooms.filter((r) => r.property === prop);
                    if (propRooms.length === 0) return null;
                    const open = expanded[prop] ?? true;

                    return (
                      <div key={prop} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <button
                          type="button"
                          onClick={() => setExpanded((prev) => ({ ...prev, [prop]: !prev[prop] }))}
                          className="flex w-full items-center justify-between bg-slate-50/50 px-4 py-3 text-left font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <span className="text-xs tracking-wide">
                            {propertyTitle(prop)} ({propRooms.length} available)
                          </span>
                          <span className={`text-lg text-slate-400 transition-transform ${open ? 'rotate-90' : ''}`}>
                            &rsaquo;
                          </span>
                        </button>

                        {open && (
                          <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 md:grid-cols-3">
                            {propRooms.map((room) => {
                              const selected = selectedRooms.some((r) => r.id === room.id);
                              const tariff = tariffs[roomTariffKey(room)];
                              const dailyRate = tariff?.ratesPerDayPerRoom?.[form.paymentCategory] ?? room.privatePersonsRatePerDay ?? room.pricePerNight ?? 0;
                              const incRate = room.incidentalChargePerDay ?? (room.property === 'OOTY' ? 300 : 250);

                              return (
                                <div
                                  key={room.id}
                                  onClick={() => {
                                    setSelectedRooms((prev) =>
                                      selected ? prev.filter((r) => r.id !== room.id) : [...prev, room]
                                    );
                                  }}
                                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all duration-200 hover:shadow-md ${
                                    selected ? 'border-[#2563EB] bg-blue-50/30' : 'border-slate-100 bg-white hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-start justify-between">
                                    <div>
                                      <p className="text-sm font-bold text-slate-800">Room {room.roomNumber}</p>
                                      <p className="text-[11px] text-slate-500 mt-0.5">
                                        {tariff?.roomCategory ?? (room.roomType === 'SUITE' ? 'VIP Suite' : 'Double bedded (AC)')}
                                      </p>
                                    </div>
                                    <input type="checkbox" checked={selected} readOnly className="h-4 w-4 rounded border-slate-300 text-[#2563EB] focus:ring-[#2563EB]" />
                                  </div>
                                  <div className="mt-3 rounded-lg bg-slate-50 p-2 text-xs">
                                    <p className="font-semibold text-slate-700">Rent: {formatINR(dailyRate)}/day</p>
                                    <p className="text-[10px] text-slate-500 mt-0.5">Incidental: {formatINR(incRate)}/day</p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* ─── NOTES ─── */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <label className={labelCls}>Special Notes / Instructions</label>
              <textarea
                value={form.notes}
                onChange={(e) => set('notes', e.target.value)}
                className={`${inputCls} h-20 resize-none`}
                placeholder="Enter any special requests, billing instructions, etc..."
              />
            </section>

            {/* ─── PRICE SUMMARY ─── */}
            {selectedRooms.length > 0 && nights > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Payment Breakdown ({nights} night{nights === 1 ? '' : 's'})
                </h3>
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                  <table className="min-w-full text-xs">
                    <thead className="bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                      <tr className="border-b border-slate-200 text-left">
                        <th className="px-4 py-3">Room</th>
                        <th className="px-4 py-3">Category</th>
                        <th className="px-4 py-3 text-right">Daily Rent</th>
                        <th className="px-4 py-3 text-right">Daily Incidental / Maintenance</th>
                        <th className="px-4 py-3 text-right font-bold">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {chargeRows.map((row) => (
                        <tr key={row.room.id}>
                          <td className="px-4 py-3 font-bold">Room {row.room.roomNumber}</td>
                          <td className="px-4 py-3 text-slate-500">{row.roomCategory}</td>
                          <td className="px-4 py-3 text-right">{formatINR(row.rentPerDay)}</td>
                          <td className="px-4 py-3 text-right">{formatINR(row.incidentalPerDay)}</td>
                          <td className="px-4 py-3 text-right font-bold text-[#2563EB]">{formatINR(row.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                      <tr>
                        <td colSpan={2} className="px-4 py-3 text-sm">Grand Total</td>
                        <td className="px-4 py-3 text-right">{formatINR(rentAmount)}</td>
                        <td className="px-4 py-3 text-right">{formatINR(incidentalAmount)}</td>
                        <td className="px-4 py-3 text-right text-sm text-[#2563EB] font-black">{formatINR(totalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </section>
            )}

            {/* ─── SUBMIT ─── */}
            <div className="flex justify-end pb-6">
              <button
                type="submit"
                disabled={loading || selectedRooms.length === 0}
                className="rounded-xl bg-[#2563EB] px-6 py-3 text-sm font-bold text-white shadow-sm hover:bg-[#1D4ED8] hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Booking'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}