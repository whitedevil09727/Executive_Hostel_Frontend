'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useEffect, useState, useCallback } from 'react';

interface AuditLog {
  id: number;
  action: string;
  entityType?: string;
  entityId?: number;
  entityRef?: string;
  performedByUsername?: string;
  performedByName?: string;
  performedByRole?: string;
  details?: string;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  BOOKING_CREATED:       'bg-blue-100 text-blue-800',
  BOOKING_FORWARDED:     'bg-sky-100 text-sky-800',
  BOOKING_APPROVED:      'bg-emerald-100 text-emerald-800',
  BOOKING_REJECTED:      'bg-red-100 text-red-800',
  BOOKING_CANCELLED:     'bg-red-100 text-red-700',
  GUEST_CHECKED_IN:      'bg-teal-100 text-teal-800',
  GUEST_CHECKED_OUT:     'bg-gray-200 text-gray-700',
  ROOM_SHIFTED:          'bg-orange-100 text-orange-800',
  ROOM_BLOCKED:          'bg-amber-100 text-amber-800',
  ROOM_UNBLOCKED:        'bg-lime-100 text-lime-800',
  ROOM_STATUS_CHANGED:   'bg-violet-100 text-violet-800',
  PAYMENT_COLLECTED_UPI: 'bg-emerald-200 text-emerald-900',
};

const ROLE_LABELS: Record<string, string> = {
  ASSISTANT_ESTATE_OFFICER: 'AEO',
  ESTATE_OFFICER: 'EO',
  CARETAKER: 'Caretaker',
  FACULTY: 'Faculty',
};

const ACTION_LABELS: Record<string, string> = {
  BOOKING_CREATED: 'Booking Created',
  BOOKING_FORWARDED: 'Booking Forwarded',
  BOOKING_APPROVED: 'Booking Approved',
  BOOKING_REJECTED: 'Booking Rejected',
  BOOKING_CANCELLED: 'Booking Cancelled',
  GUEST_CHECKED_IN: 'Guest Checked In',
  GUEST_CHECKED_OUT: 'Guest Checked Out',
  ROOM_SHIFTED: 'Room Shifted',
  ROOM_BLOCKED: 'Room Blocked',
  ROOM_UNBLOCKED: 'Room Unblocked',
  ROOM_STATUS_CHANGED: 'Room Status Changed',
  PAYMENT_COLLECTED_UPI: 'UPI Payment Collected',
};

const ALL_ACTIONS = Object.keys(ACTION_LABELS);

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');

  const load = useCallback(async (p = 0) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), size: '50' });
      if (filterAction) params.set('action', filterAction);
      if (filterUser) params.set('username', filterUser);
      if (filterFrom) params.set('from', filterFrom);
      if (filterTo) params.set('to', filterTo);

      const data: any = await api.get(`/audit-logs?${params}`);
      setLogs(Array.isArray(data.content) ? data.content : []);
      setTotal(data.totalElements ?? 0);
      setPage(p);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  }, [filterAction, filterUser, filterFrom, filterTo]);

  useEffect(() => { load(0); }, [load]);

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/40">
      <Header title="Audit Logs" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">Audit Logs</h1>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Complete trail of all actions performed in the system — {total.toLocaleString()} total records
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="mb-5 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Action</label>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              >
                <option value="">All Actions</option>
                {ALL_ACTIONS.map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">User</label>
              <input
                type="text"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="username..."
                className="w-36 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">From</label>
              <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">To</label>
              <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]" />
            </div>
            <button
              onClick={() => load(0)}
              className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8] transition"
            >
              Search
            </button>
            <button
              onClick={() => { setFilterAction(''); setFilterUser(''); setFilterFrom(''); setFilterTo(''); }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
            >
              Clear
            </button>
          </div>

          {/* Table */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="skeleton h-12 rounded-lg" />
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="py-16 text-center text-sm text-gray-400">No audit records found</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-[11px] font-bold uppercase tracking-wide text-gray-400">
                      <th className="px-4 py-3 text-left">Time</th>
                      <th className="px-4 py-3 text-left">Action</th>
                      <th className="px-4 py-3 text-left">Entity</th>
                      <th className="px-4 py-3 text-left">Performed By</th>
                      <th className="px-4 py-3 text-left">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="whitespace-nowrap px-4 py-3 text-[11px] text-gray-500">
                          {new Date(log.createdAt).toLocaleString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric',
                            hour: '2-digit', minute: '2-digit', second: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {log.entityType && (
                            <div>
                              <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{log.entityType}</span>
                              {log.entityRef && (
                                <p className="font-bold text-gray-800 text-xs">{log.entityRef}</p>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {log.performedByName && (
                            <div>
                              <p className="text-xs font-semibold text-gray-800">{log.performedByName}</p>
                              <p className="text-[10px] text-gray-400">
                                {log.performedByUsername}
                                {log.performedByRole && (
                                  <span className="ml-1 rounded bg-gray-100 px-1 py-0.5 font-bold">
                                    {ROLE_LABELS[log.performedByRole] ?? log.performedByRole}
                                  </span>
                                )}
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-xs text-gray-600">
                          <p className="line-clamp-2">{log.details}</p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
              <p>Showing {page * 50 + 1}–{Math.min((page + 1) * 50, total)} of {total}</p>
              <div className="flex gap-1">
                <button
                  disabled={page === 0}
                  onClick={() => load(page - 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-bold hover:bg-gray-50 disabled:opacity-40"
                >
                  ← Prev
                </button>
                <span className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-bold">
                  {page + 1} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => load(page + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-bold hover:bg-gray-50 disabled:opacity-40"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
