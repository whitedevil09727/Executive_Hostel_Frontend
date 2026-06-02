'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import toast from 'react-hot-toast';
import {
  formatINR,
  PAYMENT_CATEGORIES,
  paymentCategoryLabel,
  propertyTitle,
  roomTariffKey,
} from '@/lib/tariffs';

interface ActiveBooking {
  bookingId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
}

interface Room {
  id: number;
  roomNumber: string;
  roomType: string;
  property: string;
  floor?: string;
  tariffCategory?: string;
  privatePersonsRatePerDay?: number;
  incidentalChargePerDay?: number;
  pricePerNight?: number;
  status?: string;
  activeBooking?: ActiveBooking;
}

interface Booking {
  id: number;
  bookingId: string;
  guestName: string;
  guestEmail?: string;
  guestPhone: string;
  guestOrganization?: string;
  guestIdType?: string;
  guestIdNumber?: string;
  referredBy?: string;
  checkInDate: string;
  checkInTime?: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  status: string;
  paymentCategory?: string;
  rentAmount?: number;
  incidentalChargeAmount?: number;
  paymentAmount?: number;
  paymentStatus?: string;
  receiptNumber?: string;
  notes?: string;
  rejectionReason?: string;
  room?: Room;
  rooms?: Room[];
  createdBy?: { fullName: string };
  allocatedBy?: { fullName: string };
  createdAt: string;
}

interface TariffEntry {
  roomCategory: string;
  ratesPerDayPerRoom: Record<string, number>;
}

const WORKFLOW = [
  'PENDING_VERIFICATION',
  'PENDING_ALLOCATION',
  'APPROVED',
  'CHECKED_IN',
  'CHECKED_OUT',
] as const;

const WORKFLOW_LABELS: Record<string, string> = {
  PENDING_VERIFICATION: 'Verification',
  PENDING_ALLOCATION: 'Allocation',
  APPROVED: 'Approved',
  CHECKED_IN: 'Checked In',
  CHECKED_OUT: 'Checked Out',
};

const STATUS_BADGE: Record<string, string> = {
  PENDING_VERIFICATION:
    'bg-amber-50 text-amber-700 border border-amber-200',
  PENDING_ALLOCATION:
    'bg-orange-50 text-orange-700 border border-orange-200',
  APPROVED: 'bg-blue-50 text-blue-700 border border-blue-200',
  CHECKED_IN: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  CHECKED_OUT: 'bg-gray-100 text-gray-600 border border-gray-200',
  REJECTED: 'bg-red-50 text-red-700 border border-red-200',
  CANCELLED: 'bg-red-50 text-red-600 border border-red-200',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending Verification',
  PENDING_ALLOCATION: 'Pending Allocation',
  APPROVED: 'Approved',
  CHECKED_IN: 'Checked In',
  CHECKED_OUT: 'Checked Out',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 p-3 hover:border-blue-100 hover:bg-blue-50/40 transition-all">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className="mt-1 break-words text-sm font-semibold text-slate-800">
          {value}
        </p>
      </div>
    </div>
  );
}

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

export default function BookingDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, hydrate } = useAuthStore();

  const [booking, setBooking] = useState<Booking | null>(null);
  const [availableRooms, setAvailableRooms] = useState<Room[]>([]);
  const [unavailableRooms, setUnavailableRooms] = useState<Room[]>([]);
  const [tariffs, setTariffs] = useState<Record<string, TariffEntry>>({});
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [payCategory, setPayCategory] = useState('PRIVATE_PERSONS');
  const [receiptNo, setReceiptNo] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  // Shift room state
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftRooms, setShiftRooms] = useState<Room[]>([]);
  const [shiftRoomId, setShiftRoomId] = useState('');
  const [shiftReason, setShiftReason] = useState('');
  const [shifting, setShifting] = useState(false);

  // Extend stay state
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [newCheckOutDate, setNewCheckOutDate] = useState('');
  const [extendReason, setExtendReason] = useState('');
  const [extending, setExtending] = useState(false);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    const applyRoomLists = (
      rooms: any,
      allRooms: any,
      bookingRoomIds: number[],
    ) => {
      const availableList = (Array.isArray(rooms) ? rooms : []).filter(
        (room: Room) =>
          room.status === undefined || room.status === 'AVAILABLE',
      );

      const availableIds = new Set(
        availableList.map((room: Room) => room.id),
      );

      const blockedList = (Array.isArray(allRooms) ? allRooms : [])
        .filter((room: Room) => !availableIds.has(room.id))
        .filter(
          (room: Room) =>
            room.status === 'OCCUPIED' ||
            room.status === 'MAINTENANCE' ||
            room.activeBooking,
        );

      setAvailableRooms(availableList);
      setUnavailableRooms(blockedList);

      setSelectedRoomIds(
        bookingRoomIds
          .filter((roomId) => availableIds.has(roomId))
          .map(String),
      );
    };

    const load = async () => {
      try {
        const b: any = await api.get(`/bookings/${id}`);
        setBooking(b);

        const tariffPromise = api.get('/masters/tariffs');

        if (
          b.status === 'PENDING_ALLOCATION' ||
          b.status === 'PENDING_VERIFICATION'
        ) {
          const [rooms, allRooms, tariffData]: any[] = await Promise.all([
            api.get(
              `/rooms/available?checkIn=${b.checkInDate}&checkOut=${b.checkOutDate}`,
            ),
            api.get('/rooms/with-bookings'),
            tariffPromise,
          ]);

          const bookedRoomIds =
            Array.isArray(b.rooms) && b.rooms.length
              ? b.rooms.map((room: Room) => room.id)
              : b.room?.id
              ? [b.room.id]
              : [];

          applyRoomLists(rooms, allRooms, bookedRoomIds);

          setTariffs(
            tariffData && typeof tariffData === 'object' ? tariffData : {},
          );

          if (b.paymentCategory) setPayCategory(b.paymentCategory);
        } else {
          const tariffData: any = await tariffPromise;

          setTariffs(
            tariffData && typeof tariffData === 'object' ? tariffData : {},
          );
        }
      } catch {
        toast.error('Booking not found');
        router.push('/bookings');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [id]);

  const reload = async () => {
    const b: any = await api.get(`/bookings/${id}`);
    setBooking(b);
  };

  const act = async (fn: () => Promise<any>, successMsg?: string) => {
    if (!hasUsableToken()) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');

      toast.error('Session expired. Please login again.');
      router.replace('/');

      return;
    }

    setActing(true);

    try {
      await fn();
      await reload();

      toast.success(successMsg ?? 'Done');
    } catch (err: any) {
      toast.error(err?.message ?? 'Action failed');
    } finally {
      setActing(false);
    }
  };

  const handleForward = () =>
    act(
      () => api.post(`/bookings/${id}/forward`),
      'Forwarded to Estate Officer',
    );

  const handleCheckIn = () =>
    act(
      () => api.post(`/bookings/${id}/checkin`),
      'Guest checked in',
    );

  const handleCheckOut = () =>
    act(
      () =>
        api.post(
          `/bookings/${id}/checkout?receiptNumber=${receiptNo}`,
        ),
      'Guest checked out',
    );

  const handleReject = () =>
    act(async () => {
      await api.post(
        `/bookings/${id}/reject?reason=${encodeURIComponent(
          rejectReason,
        )}`,
      );

      setShowRejectForm(false);
    }, 'Booking rejected');

  const handleCancel = () =>
    act(
      () =>
        api.post(
          `/bookings/${id}/cancel?reason=${encodeURIComponent(
            rejectReason || 'Cancelled by Estate Officer',
          )}`,
        ),
      'Booking cancelled',
    );

  const openShiftModal = async () => {
    if (!booking) return;
    try {
      const rooms: any = await api.get(
        `/rooms/available?checkIn=${booking.checkInDate}&checkOut=${booking.checkOutDate}`,
      );
      setShiftRooms(Array.isArray(rooms) ? rooms : []);
      setShiftRoomId('');
      setShiftReason('');
      setShowShiftModal(true);
    } catch {
      toast.error('Failed to load available rooms');
    }
  };

  const handleShiftRoom = async () => {
    if (!shiftRoomId) {
      toast.error('Please select a room');
      return;
    }
    setShifting(true);
    try {
      await api.post(
        `/bookings/${id}/shift-room?newRoomId=${shiftRoomId}${shiftReason ? `&reason=${encodeURIComponent(shiftReason)}` : ''}`,
      );
      await reload();
      setShowShiftModal(false);
      toast.success('Room shifted successfully. AEO and EO have been notified.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to shift room');
    } finally {
      setShifting(false);
    }
  };

  const handleExtendStay = async () => {
    if (!newCheckOutDate) { toast.error('Select a new check-out date'); return; }
    setExtending(true);
    try {
      await api.post(
        `/bookings/${id}/extend-stay?newCheckOutDate=${newCheckOutDate}${extendReason ? `&reason=${encodeURIComponent(extendReason)}` : ''}`,
      );
      await reload();
      setShowExtendModal(false);
      toast.success('Stay extended. EO has been notified.');
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to extend stay');
    } finally {
      setExtending(false);
    }
  };

  const handleAllocate = () => {
    if (!selectedRoomIds.length) {
      toast.error('Please select at least one room');
      return;
    }

    act(async () => {
      const latestRooms: any = await api.get(
        `/rooms/available?checkIn=${booking?.checkInDate}&checkOut=${booking?.checkOutDate}`,
      );

      const latestAvailable = Array.isArray(latestRooms)
        ? latestRooms
        : [];

      setAvailableRooms(latestAvailable);

      const latestIds = new Set(
        latestAvailable.map((room: Room) => room.id),
      );

      const missing = selectedRoomIds.some(
        (roomId) => !latestIds.has(Number(roomId)),
      );

      if (missing) {
        setSelectedRoomIds((prev) =>
          prev.filter((roomId) =>
            latestIds.has(Number(roomId)),
          ),
        );

        throw new Error(
          'One or more selected rooms are no longer available.',
        );
      }

      if (booking?.status === 'PENDING_VERIFICATION') {
        await api.post(`/bookings/${id}/forward`);
      }

      await api.post(`/bookings/${id}/allocate`, {
        roomIds: selectedRoomIds.map(Number),
        paymentCategory: payCategory,
      });
    }, 'Rooms allocated and approved');
  };

  if (loading) {
    return (
      <div className="flex h-full flex-col bg-slate-50">
        <Header title="Booking Detail" />

        <main className="flex-1 space-y-4 p-6">
          <div className="h-24 animate-pulse rounded-3xl bg-white" />
          <div className="h-32 animate-pulse rounded-3xl bg-white" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="h-96 animate-pulse rounded-3xl bg-white" />
            <div className="h-96 animate-pulse rounded-3xl bg-white" />
          </div>
        </main>
      </div>
    );
  }

  if (!booking) return null;

  const isAEO = user?.role === 'ASSISTANT_ESTATE_OFFICER';
  const isEO = user?.role === 'ESTATE_OFFICER';
  const isCaretaker = user?.role === 'CARETAKER';

  const isTerminal =
    booking.status === 'REJECTED' ||
    booking.status === 'CANCELLED' ||
    booking.status === 'CHECKED_OUT';

  const currentStep = WORKFLOW.indexOf(booking.status as any);

  const bookingRooms = booking.rooms?.length
    ? booking.rooms
    : booking.room
    ? [booking.room]
    : [];

  const stayNights = Math.max(
    1,
    Math.floor(
      (new Date(booking.checkOutDate).getTime() -
        new Date(booking.checkInDate).getTime()) /
        86400000,
    ),
  );

  const effectiveCategory =
    payCategory ||
    booking.paymentCategory ||
    'PRIVATE_PERSONS';

  const bookedChargeRows = bookingRooms.map((room) => {
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
      tariff?.ratesPerDayPerRoom?.[effectiveCategory] ??
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
      rentTotal: rentPerDay * stayNights,
      incidentalTotal: incidentalPerDay * stayNights,
      total:
        (rentPerDay + incidentalPerDay) * stayNights,
    };
  });

  const bookedRentAmount =
    booking.rentAmount ??
    bookedChargeRows.reduce(
      (sum, row) => sum + row.rentTotal,
      0,
    );

  const bookedIncidentalAmount =
    booking.incidentalChargeAmount ??
    bookedChargeRows.reduce(
      (sum, row) => sum + row.incidentalTotal,
      0,
    );

  const bookedTotalAmount =
    booking.paymentAmount ??
    bookedRentAmount + bookedIncidentalAmount;

  const selectedRoomInfos = availableRooms.filter((room) =>
    selectedRoomIds.includes(String(room.id)),
  );

  const selectedDailyRate = selectedRoomInfos.reduce(
    (sum, room) => {
      const tariff = tariffs[roomTariffKey(room)];

      return (
        sum +
        (tariff?.ratesPerDayPerRoom?.[payCategory] ??
          room.privatePersonsRatePerDay ??
          room.pricePerNight ??
          0)
      );
    },
    0,
  );

  const selectedIncidentalDaily =
    selectedRoomInfos.reduce(
      (sum, room) =>
        sum +
        (room.incidentalChargePerDay ??
          (room.property === 'OOTY' ? 300 : 250)),
      0,
    );

  return (
    <div className="flex h-full flex-col bg-[#F4F7FB]">
      <Header title="Booking Detail" />

      <main className="flex-1 overflow-y-auto px-4 py-5 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* TOP HEADER */}

          <div className="rounded-[30px] border border-white/70 bg-white/90 p-5 shadow-[0_20px_70px_-30px_rgba(15,23,42,0.25)] backdrop-blur">

            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div className="flex items-start gap-4">

                <button
                  onClick={() => router.back()}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-500 transition hover:border-blue-200 hover:text-blue-600"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>

                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-2xl font-black tracking-tight text-slate-800">
                      {booking.bookingId}
                    </h1>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${STATUS_BADGE[booking.status]}`}
                    >
                      {STATUS_LABEL[booking.status]}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <span>
                      Created on{' '}
                      <strong className="text-slate-700">
                        {new Date(
                          booking.createdAt,
                        ).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </strong>
                    </span>

                    <span className="hidden h-1 w-1 rounded-full bg-slate-300 md:block" />

                    <span>
                      Stay Duration:{' '}
                      <strong className="text-slate-700">
                        {stayNights} Night
                        {stayNights > 1 ? 's' : ''}
                      </strong>
                    </span>
                  </div>
                </div>
              </div>

              {/* QUICK SUMMARY */}

              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">

                <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-500">
                    Check-In
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {booking.checkInDate}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-500">
                    Check-Out
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {booking.checkOutDate}
                  </p>
                </div>

                <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-orange-500">
                    Rooms
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {bookingRooms.length || 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500">
                    Total
                  </p>

                  <p className="mt-1 text-sm font-bold text-slate-800">
                    {formatINR(bookedTotalAmount)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* WORKFLOW */}

          {!isTerminal && (
            <div className="rounded-[30px] border border-white bg-white p-6 shadow-sm">

              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">
                    Booking Workflow
                  </h2>

                  <p className="text-sm text-slate-500">
                    Current booking progress
                  </p>
                </div>
              </div>

              <div className="flex items-start">
                {WORKFLOW.map((s, i) => {
                  const done = currentStep > i;
                  const active = booking.status === s;

                  return (
                    <div
                      key={s}
                      className="flex flex-1 items-start"
                    >
                      <div className="flex w-full flex-col items-center">
                        <div className="flex w-full items-center">
                          <div
                            className={`flex h-11 w-11 items-center justify-center rounded-full text-sm font-bold transition-all ${
                              done
                                ? 'bg-blue-600 text-white'
                                : active
                                ? 'bg-blue-600 text-white ring-8 ring-blue-100'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {done ? '✓' : i + 1}
                          </div>

                          {i < WORKFLOW.length - 1 && (
                            <div
                              className={`h-1 flex-1 rounded-full ${
                                done
                                  ? 'bg-blue-600'
                                  : 'bg-slate-100'
                              }`}
                            />
                          )}
                        </div>

                        <p
                          className={`mt-3 text-center text-xs font-bold ${
                            active
                              ? 'text-blue-600'
                              : done
                              ? 'text-slate-700'
                              : 'text-slate-400'
                          }`}
                        >
                          {WORKFLOW_LABELS[s]}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* MAIN CONTENT */}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

            {/* LEFT */}

            <div className="space-y-6 xl:col-span-2">

              {/* GUEST */}

              <div className="rounded-[30px] border border-white bg-white p-6 shadow-sm">

                <div className="mb-6 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Guest Details
                    </h2>

                    <p className="text-sm text-slate-500">
                      Guest information and identity details
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

                  <InfoRow
                    label="Full Name"
                    value={booking.guestName}
                    icon={
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    }
                  />

                  <InfoRow
                    label="Phone"
                    value={booking.guestPhone}
                    icon={
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    }
                  />

                  {booking.guestEmail && (
                    <InfoRow
                      label="Email"
                      value={booking.guestEmail}
                      icon={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8"
                          />
                        </svg>
                      }
                    />
                  )}

                  {booking.guestOrganization && (
                    <InfoRow
                      label="Organization"
                      value={booking.guestOrganization}
                      icon={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16"
                          />
                        </svg>
                      }
                    />
                  )}

                  {booking.guestIdType &&
                    booking.guestIdNumber && (
                      <div className="md:col-span-2">
                        <InfoRow
                          label="Identity"
                          value={`${booking.guestIdType}: ${booking.guestIdNumber}`}
                          icon={
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6"
                              />
                            </svg>
                          }
                        />
                      </div>
                    )}

                  <div className="md:col-span-2">
                    <InfoRow
                      label="Referred By"
                      value={booking.referredBy || '—'}
                      icon={
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                        </svg>
                      }
                    />
                  </div>
                </div>
              </div>

              {/* PAYMENT */}

              <div className="rounded-[30px] border border-white bg-white p-6 shadow-sm">

                <div className="mb-6 flex items-center justify-between gap-4">

                  <div>
                    <h2 className="text-lg font-bold text-slate-800">
                      Payment Summary
                    </h2>

                    <p className="text-sm text-slate-500">
                      Room charges and incidental charges
                    </p>
                  </div>

                  {booking.paymentCategory && (
                    <span className="rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                      {paymentCategoryLabel(
                        booking.paymentCategory,
                      )}
                    </span>
                  )}
                </div>

                {(() => {
                  // Detect prorated scenario: stored rent differs from per-room calc
                  const calcRent = bookedChargeRows.reduce((s, r) => s + r.rentTotal, 0);
                  const isProrated = booking.rentAmount != null &&
                    Math.abs(booking.rentAmount - calcRent) > 1;
                  return (
                    <>
                      {isProrated && (
                        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs">
                          <svg className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-orange-800">
                            <strong>Prorated amount applied</strong> — Room was reallocated during the stay. The Grand Total reflects the actual charge: days in previous room at old rate + remaining days at new rate. The per-room row shows the new room&apos;s current rate for reference.
                          </p>
                        </div>
                      )}
                      <div className="overflow-hidden rounded-3xl border border-slate-200">
                        <div className="overflow-x-auto">
                          <table className="min-w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr className="text-left text-slate-500">
                                <th className="px-5 py-4 font-bold">Room</th>
                                <th className="px-5 py-4 font-bold">Type</th>
                                <th className="px-5 py-4 text-right font-bold">Rent/Day</th>
                                <th className="px-5 py-4 text-right font-bold">Incidental</th>
                                <th className="px-5 py-4 text-right font-bold">
                                  {isProrated ? 'Rate Reference' : 'Total'}
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {bookedChargeRows.map((row) => (
                                <tr key={row.room.id} className="border-t border-slate-100">
                                  <td className="px-5 py-4 font-bold text-slate-800">{row.room.roomNumber}</td>
                                  <td className="px-5 py-4 text-slate-500">{row.roomCategory}</td>
                                  <td className="px-5 py-4 text-right font-semibold text-slate-700">{formatINR(row.rentPerDay)}</td>
                                  <td className="px-5 py-4 text-right font-semibold text-slate-700">{formatINR(row.incidentalPerDay)}</td>
                                  <td className="px-5 py-4 text-right font-bold text-blue-700">
                                    {isProrated ? '(prorated)' : formatINR(row.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50">
                              <tr>
                                <td colSpan={2} className="px-5 py-4 text-sm font-bold text-slate-700">
                                  {isProrated ? 'Adjusted Total' : 'Grand Total'}
                                </td>
                                <td className="px-5 py-4 text-right font-bold text-slate-700">{formatINR(bookedRentAmount)}</td>
                                <td className="px-5 py-4 text-right font-bold text-slate-700">{formatINR(bookedIncidentalAmount)}</td>
                                <td className="px-5 py-4 text-right text-lg font-black text-blue-700">{formatINR(bookedTotalAmount)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </>
                  );
                })()}

                {booking.notes && (
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Notes
                    </p>

                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {booking.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR */}

            <div className="space-y-6">

              {/* STAY */}

              <div className="rounded-[30px] border border-white bg-white p-6 shadow-sm">

                <h2 className="mb-5 text-lg font-bold text-slate-800">
                  Stay Details
                </h2>

                <div className="space-y-4">

                  <InfoRow
                    label="Check-In"
                    value={booking.checkInDate}
                    icon={<span>📅</span>}
                  />

                  <InfoRow
                    label="Check-Out"
                    value={booking.checkOutDate}
                    icon={<span>🏁</span>}
                  />

                  {bookingRooms.length > 0 && (
                    <InfoRow
                      label="Room(s)"
                      value={bookingRooms
                        .map((room) => room.roomNumber)
                        .join(', ')}
                      icon={<span>🛏️</span>}
                    />
                  )}

                  {booking.room?.property && (
                    <InfoRow
                      label="Property"
                      value={propertyTitle(
                        booking.room.property,
                      )}
                      icon={<span>🏢</span>}
                    />
                  )}

                  {booking.allocatedBy && (
                    <InfoRow
                      label="Allocated By"
                      value={booking.allocatedBy.fullName}
                      icon={<span>👤</span>}
                    />
                  )}
                </div>
              </div>

              {/* ACTION PANEL */}

              {(isAEO || isEO || isCaretaker) && !isTerminal && (
                <div className="rounded-[30px] border border-blue-100 bg-gradient-to-br from-white to-blue-50 p-6 shadow-sm">

                  <h2 className="mb-5 text-lg font-bold text-slate-800">
                    Actions
                  </h2>

                  {/* CHECK IN */}

                  {(isCaretaker || isAEO) &&
                    booking.status === 'APPROVED' && (
                      <button
                        onClick={handleCheckIn}
                        disabled={acting}
                        className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        Confirm Check-In
                      </button>
                    )}

                  {/* CHECK OUT — caretaker only (payment collected via payment module) */}

                  {isCaretaker &&
                    booking.status === 'CHECKED_IN' && (
                      <div key="checkout-container" className="space-y-4">

                        <input
                          key="receipt-number-input"
                          value={receiptNo}
                          onChange={(e) =>
                            setReceiptNo(e.target.value)
                          }
                          placeholder="Receipt Number"
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                        />

                        <button
                          onClick={handleCheckOut}
                          disabled={acting}
                          className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                        >
                          Confirm Check-Out
                        </button>
                      </div>
                    )}

                  {/* FORWARD */}

                  {isAEO &&
                    booking.status ===
                      'PENDING_VERIFICATION' && (
                      <div className="space-y-3">

                        {booking.referredBy && (
                          <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500">
                              Referred By
                            </p>
                            <p className="mt-1 text-sm font-bold text-slate-800">
                              {booking.referredBy}
                            </p>
                          </div>
                        )}

                        <button
                          onClick={handleForward}
                          disabled={acting}
                          className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                        >
                          Forward To Estate Officer
                        </button>

                        <button
                          onClick={() =>
                            setShowRejectForm(
                              !showRejectForm,
                            )
                          }
                          className="w-full rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-bold text-red-600 transition hover:bg-red-100"
                        >
                          Reject Booking
                        </button>
                      </div>
                    )}

                  {/* SHIFT ROOM — all roles, for APPROVED or CHECKED_IN */}
                  {(booking.status === 'APPROVED' || booking.status === 'CHECKED_IN') && (
                    <button
                      onClick={openShiftModal}
                      disabled={acting}
                      className="mt-3 w-full rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 text-sm font-bold text-orange-700 transition hover:bg-orange-100 disabled:opacity-60"
                    >
                      Shift / Reallocate Room
                    </button>
                  )}

                  {/* EXTEND STAY — all roles, for APPROVED or CHECKED_IN */}
                  {(booking.status === 'APPROVED' || booking.status === 'CHECKED_IN') && (
                    <button
                      onClick={() => {
                        setNewCheckOutDate('');
                        setExtendReason('');
                        setShowExtendModal(true);
                      }}
                      disabled={acting}
                      className="mt-2 w-full rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 text-sm font-bold text-violet-700 transition hover:bg-violet-100 disabled:opacity-60"
                    >
                      Extend Stay
                    </button>
                  )}
                </div>
              )}

              {/* ALLOCATION */}

              {isEO &&
                (booking.status ===
                  'PENDING_ALLOCATION' ||
                  booking.status ===
                    'PENDING_VERIFICATION') && (
                  <div className="rounded-[30px] border border-emerald-100 bg-white p-6 shadow-sm">

                    <h2 className="mb-5 text-lg font-bold text-slate-800">
                      Allocate Room
                    </h2>

                    <div className="space-y-5">

                      {booking.referredBy && (
                        <div className="rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-violet-500">
                            Referred By
                          </p>
                          <p className="mt-1 text-sm font-bold text-slate-800">
                            {booking.referredBy}
                          </p>
                        </div>
                      )}

                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                          Available Rooms
                        </label>

                        <div className="max-h-72 space-y-2 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">

                          {availableRooms.map((r) => {
                            const checked =
                              selectedRoomIds.includes(
                                String(r.id),
                              );

                            return (
                              <label
                                key={r.id}
                                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition ${
                                  checked
                                    ? 'border-blue-300 bg-blue-50'
                                    : 'border-white bg-white hover:border-blue-100'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setSelectedRoomIds(
                                      (prev) =>
                                        checked
                                          ? prev.filter(
                                              (roomId) =>
                                                roomId !==
                                                String(
                                                  r.id,
                                                ),
                                            )
                                          : [
                                              ...prev,
                                              String(r.id),
                                            ],
                                    )
                                  }
                                  className="mt-1"
                                />

                                <div>
                                  <p className="text-sm font-bold text-slate-800">
                                    {r.roomNumber}
                                  </p>

                                  <p className="text-xs text-slate-500">
                                    {propertyTitle(
                                      r.property,
                                    )}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-slate-400">
                          Payment Category
                        </label>

                        <select
                          value={payCategory}
                          onChange={(e) =>
                            setPayCategory(
                              e.target.value,
                            )
                          }
                          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400"
                        >
                          {PAYMENT_CATEGORIES.map(
                            (category) => (
                              <option
                                key={category.value}
                                value={category.value}
                              >
                                {category.label}
                              </option>
                            ),
                          )}
                        </select>
                      </div>

                      {selectedRoomInfos.length > 0 && (
                        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">

                          <p className="text-xs font-bold uppercase tracking-wider text-emerald-600">
                            Estimated Charges
                          </p>

                          <p className="mt-2 text-lg font-black text-slate-800">
                            {formatINR(selectedDailyRate)}
                            <span className="text-sm font-semibold text-slate-500">
                              {' '}
                              / day rent
                            </span>
                          </p>

                          <p className="mt-1 text-sm text-slate-600">
                            Incidental:
                            {' '}
                            {formatINR(
                              selectedIncidentalDaily,
                            )}
                            /day
                          </p>
                        </div>
                      )}

                      <button
                        onClick={handleAllocate}
                        disabled={acting}
                        className="w-full rounded-2xl bg-blue-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-60"
                      >
                        Approve & Allocate Room
                      </button>
                    </div>
                  </div>
                )}

              {/* CANCEL */}

              {isEO && !isTerminal && (
                <div key="cancel-booking-panel" className="rounded-[30px] border border-red-100 bg-white p-6 shadow-sm">

                  <h2 className="text-lg font-bold text-red-700">
                    Cancel Booking
                  </h2>

                  <p className="mt-2 text-sm text-slate-500">
                    This action will cancel the booking and
                    release allocated rooms.
                  </p>

                  <textarea
                    key="cancel-reason-textarea"
                    value={rejectReason}
                    onChange={(e) =>
                      setRejectReason(e.target.value)
                    }
                    rows={4}
                    placeholder="Cancellation reason..."
                    className="mt-4 w-full rounded-2xl border border-red-200 bg-red-50/40 px-4 py-3 text-sm outline-none focus:border-red-400"
                  />

                  <button
                    onClick={handleCancel}
                    disabled={acting}
                    className="mt-4 w-full rounded-2xl bg-red-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    Cancel Booking
                  </button>
                </div>
              )}

              {/* REJECTION FORM */}

              {showRejectForm && !isEO && (
                <div key="reject-booking-panel" className="rounded-[30px] border border-red-200 bg-white p-6 shadow-sm">

                  <h2 className="text-lg font-bold text-red-700">
                    Reject Booking
                  </h2>

                  <textarea
                    key="reject-reason-textarea"
                    value={rejectReason}
                    onChange={(e) =>
                      setRejectReason(e.target.value)
                    }
                    rows={4}
                    placeholder="Reason for rejection..."
                    className="mt-4 w-full rounded-2xl border border-red-200 bg-red-50/40 px-4 py-3 text-sm outline-none focus:border-red-400"
                  />

                  <div className="mt-4 flex gap-3">

                    <button
                      onClick={handleReject}
                      disabled={acting}
                      className="flex-1 rounded-2xl bg-red-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
                    >
                      Confirm Reject
                    </button>

                    <button
                      onClick={() =>
                        setShowRejectForm(false)
                      }
                      className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* EXTEND STAY MODAL */}
      {showExtendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-bold text-slate-800">Extend Stay</h3>
            <p className="mb-4 text-xs text-slate-500">
              Current check-out: <strong>{booking?.checkOutDate}</strong>. Select a later date to extend the guest&apos;s stay. Amounts will be recalculated automatically.
            </p>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                New Check-Out Date *
              </label>
              <input
                type="date"
                value={newCheckOutDate}
                min={booking?.checkOutDate ? (() => {
                  const d = new Date(booking.checkOutDate);
                  d.setDate(d.getDate() + 1);
                  return d.toISOString().slice(0, 10);
                })() : ''}
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
              <p className="mt-1 text-[10px] text-slate-400">EO will be notified if extended by Caretaker or AEO.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExtendModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleExtendStay}
                disabled={extending || !newCheckOutDate}
                className="flex-1 rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition"
              >
                {extending ? 'Extending...' : 'Confirm Extension'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT ROOM MODAL */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 className="mb-1 text-base font-bold text-slate-800">Shift / Reallocate Room</h3>
            <p className="mb-4 text-xs text-slate-500">
              Select a new room for {booking?.guestName}. The current room will be released.
              AEO and EO will be notified automatically.
            </p>

            <div className="mb-4 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3 space-y-2">
              {shiftRooms.length === 0 ? (
                <p className="py-4 text-center text-sm text-slate-400">No other rooms available for these dates</p>
              ) : shiftRooms.map((r) => (
                <label
                  key={r.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border p-3 transition ${shiftRoomId === String(r.id) ? 'border-orange-300 bg-orange-50' : 'border-white bg-white hover:border-orange-100'}`}
                >
                  <input
                    type="radio"
                    name="shiftRoom"
                    value={String(r.id)}
                    checked={shiftRoomId === String(r.id)}
                    onChange={() => setShiftRoomId(String(r.id))}
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-800">{r.roomNumber}</p>
                    <p className="text-xs text-slate-500">{r.property} · {r.roomType}</p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mb-4">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                Reason for Shift *
              </label>
              <textarea
                value={shiftReason}
                onChange={(e) => setShiftReason(e.target.value)}
                rows={3}
                placeholder="e.g. Guest request, maintenance issue, VIP upgrade..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-orange-400"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowShiftModal(false)}
                className="flex-1 rounded-2xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleShiftRoom}
                disabled={shifting || !shiftRoomId || !shiftReason.trim()}
                className="flex-1 rounded-2xl bg-orange-600 px-5 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60"
              >
                {shifting ? 'Shifting...' : 'Confirm Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}