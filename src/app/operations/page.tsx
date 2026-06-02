'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import { formatINR } from '@/lib/tariffs';
import { useAuthStore } from '@/store/auth';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

interface Room {
  roomNumber: string;
}

interface Booking {
  id: number;
  bookingId: string;
  guestName: string;
  guestPhone: string;
  checkInDate: string;
  checkOutDate: string;
  paymentAmount?: number;
  room?: Room;
  rooms?: Room[];
}

const bookingRooms = (booking: Booking) =>
  booking.rooms?.length
    ? booking.rooms
    : booking.room
    ? [booking.room]
    : [];

export default function OperationsPage() {
  const { user, hydrate } = useAuthStore();
  const router = useRouter();

  const [approved, setApproved] = useState<Booking[]>([]);
  const [checkedIn, setCheckedIn] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [receiptNumbers, setReceiptNumbers] = useState<Record<number, string>>(
    {}
  );

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [approvedData, checkedInData]: any[] = await Promise.all([
        api.get('/bookings?status=APPROVED'),
        api.get('/bookings?status=CHECKED_IN'),
      ]);

      setApproved(Array.isArray(approvedData) ? approvedData : []);
      setCheckedIn(Array.isArray(checkedInData) ? checkedInData : []);
    } catch {
      toast.error('Failed to load records');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const checkIn = async (booking: Booking) => {
    setActingId(booking.id);

    try {
      await api.post(`/bookings/${booking.id}/checkin`);

      toast.success(`${booking.bookingId} checked in`);

      await load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Check-in failed');
    } finally {
      setActingId(null);
    }
  };

  const checkOut = async (booking: Booking) => {
    setActingId(booking.id);

    try {
      const receipt = receiptNumbers[booking.id] ?? '';

      await api.post(
        `/bookings/${booking.id}/checkout?receiptNumber=${encodeURIComponent(
          receipt
        )}`
      );

      toast.success(`${booking.bookingId} checked out`);

      await load();
    } catch (err: any) {
      toast.error(err?.message ?? 'Check-out failed');
    } finally {
      setActingId(null);
    }
  };

  const ActionButton = ({
    label,
    loadingLabel,
    loading,
    onClick,
    variant,
  }: {
    label: string;
    loadingLabel: string;
    loading: boolean;
    onClick: () => void;
    variant: 'primary' | 'success';
  }) => {
    const styles =
      variant === 'primary'
        ? 'bg-[#2563EB] hover:bg-[#1D4ED8]'
        : 'bg-[#14B8A6] hover:bg-[#0D9488]';

    return (
      <button
        onClick={onClick}
        disabled={loading}
        className={`h-11 w-full rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-60 ${styles}`}
      >
        {loading ? loadingLabel : label}
      </button>
    );
  };

  const BookingCard = ({
    booking,
    mode,
  }: {
    booking: Booking;
    mode: 'checkin' | 'checkout';
  }) => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* LEFT CONTENT */}
        <div className="flex-1">
          <Link
            href={`/bookings/${booking.id}`}
            className="inline-flex rounded-md bg-blue-50 px-2 py-1 font-mono text-xs font-bold text-[#2563EB] transition-colors hover:bg-blue-100"
          >
            {booking.bookingId}
          </Link>

          <div className="mt-3 space-y-2">
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {booking.guestName}
              </h3>

              <p className="text-sm text-slate-500">
                {booking.guestPhone}
              </p>
            </div>

            <div className="grid gap-3 pt-2 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Stay
                </p>

                <p className="mt-1 text-sm font-medium text-slate-700">
                  {booking.checkInDate}
                </p>

                <p className="text-sm font-medium text-slate-700">
                  to {booking.checkOutDate}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Rooms
                </p>

                <p className="mt-1 text-sm font-semibold text-slate-800">
                  {bookingRooms(booking)
                    .map((room) => room.roomNumber)
                    .join(', ') || 'Unassigned'}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Payable
                </p>

                <p className="mt-1 text-sm font-bold text-[#0F172A]">
                  {booking.paymentAmount
                    ? formatINR(booking.paymentAmount)
                    : '—'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT ACTIONS */}
        <div className="w-full lg:w-[260px]">
          {mode === 'checkin' ? (
            <ActionButton
              label="Check In"
              loadingLabel="Checking in..."
              loading={actingId === booking.id}
              onClick={() => checkIn(booking)}
              variant="primary"
            />
          ) : isCaretaker ? (
            /* Caretaker: redirect to payment collection page */
            <div className="space-y-2">
              <button
                onClick={() => router.push('/caretaker/payment')}
                className="h-11 w-full rounded-xl bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                Collect Payment & Check Out
              </button>
              <p className="text-center text-[10px] text-slate-400">
                Opens UPI payment collection module
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                value={receiptNumbers[booking.id] ?? ''}
                onChange={(event) =>
                  setReceiptNumbers((prev) => ({
                    ...prev,
                    [booking.id]: event.target.value,
                  }))
                }
                placeholder="Enter receipt number"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-700 outline-none transition-all duration-200 focus:border-[#2563EB] focus:ring-4 focus:ring-blue-100"
              />

              <ActionButton
                label="Check Out"
                loadingLabel="Checking out..."
                loading={actingId === booking.id}
                onClick={() => checkOut(booking)}
                variant="success"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const isCaretaker = user?.role === 'CARETAKER';
  const canCheckout = user?.role === 'ESTATE_OFFICER' || isCaretaker;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[#F8FAFC]">
      <Header title="Check-In / Check-Out" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-6xl space-y-10">
          {/* CHECK-IN SECTION */}
          <section>
            <div className="mb-5">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Ready for Check-In
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Approved bookings waiting for guest arrival.
              </p>
            </div>

            <div className="space-y-4">
              {loading ? (
                <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
              ) : approved.length ? (
                approved.map((booking) => (
                  <BookingCard
                    key={booking.id}
                    booking={booking}
                    mode="checkin"
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
                  <p className="text-sm font-medium text-slate-400">
                    No approved bookings waiting for check-in
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* CHECK-OUT SECTION */}
          {canCheckout && (
            <section>
              <div className="mb-5">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Ready for Check-Out
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Checked-in bookings pending receipt and completion.
                </p>
              </div>

              <div className="space-y-4">
                {loading ? (
                  <div className="h-28 animate-pulse rounded-2xl bg-slate-200" />
                ) : checkedIn.length ? (
                  checkedIn.map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      mode="checkout"
                    />
                  ))
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-14 text-center">
                    <p className="text-sm font-medium text-slate-400">
                      No guests currently waiting for check-out
                    </p>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}