'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface Notification {
  id: number;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  relatedEntityId?: number;
  relatedEntityType?: string;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  BOOKING_CREATED: '📋',
  BOOKING_FORWARDED: '📤',
  BOOKING_APPROVED: '✅',
  BOOKING_REJECTED: '❌',
  BOOKING_CHECKED_IN: '🏠',
  BOOKING_CHECKED_OUT: '🚪',
  MASTER_REQUEST_SUBMITTED: '📬',
  MASTER_REQUEST_APPROVED: '✅',
  MASTER_REQUEST_REJECTED: '❌',
  ROOM_SHIFTED: '🔄',
  ROOM_BLOCKED: '🚫',
  ROOM_UNBLOCKED: '✔️',
  STAY_EXTENDED: '📅',
};

const TYPE_BADGE: Record<string, string> = {
  BOOKING_APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  BOOKING_REJECTED: 'bg-red-50 text-red-700 border-red-200',
  BOOKING_CHECKED_IN: 'bg-blue-50 text-blue-700 border-blue-200',
  BOOKING_CHECKED_OUT: 'bg-gray-100 text-gray-600 border-gray-200',
  ROOM_SHIFTED: 'bg-orange-50 text-orange-700 border-orange-200',
  ROOM_BLOCKED: 'bg-red-50 text-red-600 border-red-200',
  ROOM_UNBLOCKED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  STAY_EXTENDED: 'bg-violet-50 text-violet-700 border-violet-200',
};

const TYPE_LABEL: Record<string, string> = {
  BOOKING_CREATED: 'Booking Created',
  BOOKING_FORWARDED: 'Forwarded',
  BOOKING_APPROVED: 'Approved',
  BOOKING_REJECTED: 'Rejected',
  BOOKING_CHECKED_IN: 'Checked In',
  BOOKING_CHECKED_OUT: 'Checked Out',
  MASTER_REQUEST_SUBMITTED: 'Master Request',
  MASTER_REQUEST_APPROVED: 'Master Approved',
  MASTER_REQUEST_REJECTED: 'Master Rejected',
  ROOM_SHIFTED: 'Room Shifted',
  ROOM_BLOCKED: 'Room Blocked',
  ROOM_UNBLOCKED: 'Room Unblocked',
  STAY_EXTENDED: 'Stay Extended',
};

const PAGE_SIZE = 20;

function getNotifLink(n: Notification) {
  if (n.relatedEntityType === 'BOOKING' && n.relatedEntityId) return `/bookings/${n.relatedEntityId}`;
  if (n.relatedEntityType === 'MASTER_REQUEST') return '/masters';
  return '#';
}

function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function NotificationsPage() {
  const [all, setAll] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await api.get('/notifications');
      setAll(Array.isArray(data) ? data : []);
    } catch {
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setAll((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All notifications marked as read');
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  const markOne = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setAll((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* silent */ }
  };

  const totalPages = Math.ceil(all.length / PAGE_SIZE);
  const paged = all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const unreadCount = all.filter((n) => !n.isRead).length;

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/40">
      <Header title="All Notifications" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">

          {/* Page header */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">Notification History</h1>
              <p className="mt-0.5 text-xs text-[#64748B]">All notifications for your account — most recent first.</p>
            </div>
            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  {unreadCount} unread
                </span>
              )}
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
                >
                  Mark all read
                </button>
              )}
            </div>
          </div>

          {/* List */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-200" />
              ))}
            </div>
          ) : all.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white py-20 text-center shadow-sm">
              <p className="text-2xl">🔔</p>
              <p className="mt-3 text-sm font-semibold text-gray-500">No notifications yet</p>
              <p className="mt-1 text-xs text-gray-400">You&apos;ll see notifications here when actions happen in the system.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {paged.map((n) => (
                  <Link
                    key={n.id}
                    href={getNotifLink(n)}
                    onClick={() => { if (!n.isRead) markOne(n.id); }}
                    className={`flex items-start gap-4 rounded-2xl border p-4 transition hover:shadow-sm ${
                      !n.isRead
                        ? 'border-blue-200 bg-blue-50/60'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <span className="mt-0.5 text-xl shrink-0">{TYPE_ICON[n.type] ?? '🔔'}</span>

                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <p className={`text-sm font-bold ${n.isRead ? 'text-slate-600' : 'text-slate-900'}`}>
                          {n.title}
                        </p>
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                          TYPE_BADGE[n.type] ?? 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {TYPE_LABEL[n.type] ?? n.type}
                        </span>
                        {!n.isRead && (
                          <span className="rounded-full bg-[#2563EB] px-2 py-0.5 text-[9px] font-bold text-white">NEW</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">{n.message}</p>
                      <p className="mt-1.5 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                    </div>

                    {!n.isRead && (
                      <div className="w-2 h-2 rounded-full bg-[#2563EB] shrink-0 mt-2" />
                    )}
                  </Link>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    ← Previous
                  </button>
                  <span className="text-xs text-slate-500">
                    Page {page + 1} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page >= totalPages - 1}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition"
                  >
                    Next →
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
