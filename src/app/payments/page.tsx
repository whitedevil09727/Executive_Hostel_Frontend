'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import { useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { formatINR, paymentCategoryLabel } from '@/lib/tariffs';

interface Booking {
  id: number; bookingId: string; guestName: string; guestPhone: string;
  checkInDate: string; checkOutDate: string; actualCheckOut?: string;
  paymentCategory?: string; paymentAmount?: number;
  paymentStatus?: string; receiptNumber?: string;
  status: string;
  room?: { roomNumber: string; roomType: string };
  rooms?: { roomNumber: string; roomType: string }[];
}

interface PaymentReportEntry {
  bookingId: string;
  guestName: string;
  guestOrganization: string;
  amount: number;
  receiptNumber: string;
  checkInDate: string;
  checkOutDate: string;
  paidAt: string;
  roomNumber?: string;
}

interface PendingEntry {
  bookingId: string;
  guestName: string;
  guestOrganization: string;
  amount: number;
  status: string;
  checkOutDate: string;
}

interface Report {
  totalCollected: number;
  totalPending: number;
  paidCount: number;
  pendingCount: number;
  recentPayments: PaymentReportEntry[];
  pendingPayments: PendingEntry[];
}

const PAY_COLORS: Record<string, string> = {
  PAID:    'bg-emerald-100 text-emerald-700',
  PENDING: 'bg-amber-100 text-amber-700',
  WAIVED:  'bg-gray-100 text-gray-600',
};

type Tab = 'all' | 'paid' | 'pending' | 'upi';

export default function PaymentsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('all');

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await api.get('/bookings');
      const all = (Array.isArray(data) ? data : data.content ?? []) as Booking[];
      setBookings(all.filter((b) => b.paymentCategory));
    } catch {
      toast.error('Failed to load payment records');
    } finally {
      setLoading(false);
    }
  }, []);

  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');

  const loadReport = useCallback(async (from?: string, to?: string) => {
    setReportLoading(true);
    try {
      let url = '/payments/report';
      const params: string[] = [];
      if (from) params.push(`from=${from}`);
      if (to) params.push(`to=${to}`);
      if (params.length) url += '?' + params.join('&');
      const data: any = await api.get(url);
      setReport(data);
    } catch {
      toast.error('Failed to load UPI report');
    } finally {
      setReportLoading(false);
    }
  }, []);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  useEffect(() => {
    if (tab === 'upi' && !report) loadReport();
  }, [tab, report, loadReport]);

  const applyMonthFilter = (ym: string) => {
    setSelectedMonth(ym);
    if (!ym) { setFromDate(''); setToDate(''); loadReport(); return; }
    const [y, m] = ym.split('-').map(Number);
    const from = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const to = `${y}-${String(m).padStart(2, '0')}-${lastDay}`;
    setFromDate(from); setToDate(to);
    loadReport(from, to);
  };

  const applyDateFilter = () => { loadReport(fromDate || undefined, toDate || undefined); };
  const clearFilter = () => { setFromDate(''); setToDate(''); setSelectedMonth(''); loadReport(); };

  const filtered = bookings.filter((b) => {
    const activeStatuses = ['APPROVED', 'CHECKED_IN', 'CHECKED_OUT'];
    if (tab === 'paid')    return b.paymentStatus === 'PAID';
    if (tab === 'pending') return b.paymentStatus === 'PENDING' && activeStatuses.includes(b.status);
    return true;
  });

  const totalRevenue = bookings
    .filter((b) => b.paymentStatus === 'PAID' && b.paymentAmount)
    .reduce((sum, b) => sum + (b.paymentAmount ?? 0), 0);

  const pendingRevenue = bookings
    .filter((b) => b.paymentStatus === 'PENDING' && b.paymentAmount &&
                   ['APPROVED', 'CHECKED_IN', 'CHECKED_OUT'].includes(b.status))
    .reduce((sum, b) => sum + (b.paymentAmount ?? 0), 0);

  const bookingRooms = (b: Booking) =>
    b.rooms?.length ? b.rooms : b.room ? [b.room] : [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50/50">
      <Header title="Payments & Collections" />
      <main className="flex-1 overflow-y-auto p-6 forest-surface">
        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Bookings', value: String(bookings.length), bg: 'bg-white border-slate-200/60', color: 'text-[#0F172A]' },
              { label: 'UPI Collected', value: formatINR(totalRevenue), bg: 'bg-emerald-50 border-emerald-200', color: 'text-emerald-700' },
              { label: 'Pending Collection', value: formatINR(pendingRevenue), bg: 'bg-amber-50 border-amber-200', color: 'text-amber-700' },
              { label: 'Waived', value: String(bookings.filter((b) => b.paymentStatus === 'WAIVED').length), bg: 'bg-blue-50 border-blue-100', color: 'text-[#2563EB]' },
            ].map((s) => (
              <div key={s.label} className={`rounded-xl p-4 border ${s.bg} shadow-xs hover:shadow-soft transition-shadow`}>
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-[#64748B] mt-1 font-medium">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1.5 bg-white border border-slate-200/60 rounded-lg p-1 w-fit mb-5 shadow-soft">
          {[
            { key: 'all' as Tab, label: 'All Records' },
            { key: 'paid' as Tab, label: 'Paid' },
            { key: 'pending' as Tab, label: 'Pending' },
            { key: 'upi' as Tab, label: '⚡ UPI Report' },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all duration-250 ${tab === t.key ? 'bg-[#2563EB] text-white shadow-soft' : 'text-[#64748B] hover:bg-blue-50/40 hover:text-[#2563EB]'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* All / Paid / Pending tabs */}
        {tab !== 'upi' && (
          <div className="bg-white rounded-lg border border-slate-200/60 shadow-soft overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton h-12 rounded-lg" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-14 text-center text-[#94A3B8]">
                <p className="text-sm">No payment records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide bg-gray-50">
                      <th className="px-5 py-3 text-left">Booking ID</th>
                      <th className="px-5 py-3 text-left">Guest</th>
                      <th className="px-5 py-3 text-left">Room</th>
                      <th className="px-5 py-3 text-left">Check-Out</th>
                      <th className="px-5 py-3 text-left">Category</th>
                      <th className="px-5 py-3 text-right">Amount</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-left">UPI / Receipt</th>
                      <th className="px-5 py-3 text-left"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map((b) => (
                      <tr key={b.id} className="hover:bg-gray-50/60 transition-colors">
                        <td className="px-5 py-3 font-mono text-xs text-[#2563EB] font-bold">{b.bookingId}</td>
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-800 text-xs">{b.guestName}</p>
                          <p className="text-[11px] text-gray-400">{b.guestPhone}</p>
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600">
                          {bookingRooms(b).length ? bookingRooms(b).map((r) => r.roomNumber).join(', ') : '—'}
                        </td>
                        <td className="px-5 py-3 text-xs text-gray-600">
                          {b.actualCheckOut ? new Date(b.actualCheckOut).toLocaleDateString('en-IN') : b.checkOutDate}
                        </td>
                        <td className="px-5 py-3">
                          {b.paymentCategory && (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                              {paymentCategoryLabel(b.paymentCategory)}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-right font-semibold text-gray-800">
                          {b.paymentAmount ? formatINR(b.paymentAmount) : '—'}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${PAY_COLORS[b.paymentStatus ?? ''] ?? 'bg-gray-100 text-gray-500'}`}>
                              {b.paymentStatus ?? '—'}
                            </span>
                            {(b.status === 'REJECTED' || b.status === 'CANCELLED') && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600 w-fit">
                                {b.status}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-gray-500 font-mono max-w-[160px] truncate">
                          {b.receiptNumber ?? '—'}
                        </td>
                        <td className="px-5 py-3">
                          <Link href={`/bookings/${b.id}`} className="text-xs text-[#2563EB] hover:underline font-semibold">View</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* UPI Collections Report */}
        {tab === 'upi' && (
          <div className="space-y-5">

            {/* Date / Month Filter */}
            <div className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">Month</label>
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => applyMonthFilter(e.target.value)}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>
              <div className="text-xs font-semibold text-gray-400 self-center">or custom range</div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">From</label>
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => { setFromDate(e.target.value); setSelectedMonth(''); }}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-400">To</label>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => { setToDate(e.target.value); setSelectedMonth(''); }}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#2563EB]"
                />
              </div>
              <button
                onClick={applyDateFilter}
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8] transition"
              >
                Apply
              </button>
              <button
                onClick={clearFilter}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-bold text-gray-500 hover:bg-gray-50 transition"
              >
                Clear
              </button>
              {(fromDate || toDate || selectedMonth) && (
                <span className="self-center rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-[11px] font-bold text-blue-700">
                  {selectedMonth ? `Month: ${selectedMonth}` : `${fromDate || '…'} → ${toDate || '…'}`}
                </span>
              )}
            </div>

            {reportLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
              </div>
            ) : !report ? (
              <div className="rounded-xl border border-gray-100 bg-white py-12 text-center text-sm text-gray-400">
                Failed to load UPI report
              </div>
            ) : (
              <>
                {/* UPI Summary */}
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                  {[
                    { label: 'Total UPI Collected', value: formatINR(report.totalCollected), bg: 'bg-emerald-50 border-emerald-200', color: 'text-emerald-700' },
                    { label: 'Pending (Cash / Other)', value: formatINR(report.totalPending), bg: 'bg-amber-50 border-amber-200', color: 'text-amber-700' },
                    { label: 'UPI Payments', value: String(report.paidCount), bg: 'bg-blue-50 border-blue-200', color: 'text-blue-700' },
                    { label: 'Pending Count', value: String(report.pendingCount), bg: 'bg-red-50 border-red-200', color: 'text-red-700' },
                  ].map((s) => (
                    <div key={s.label} className={`rounded-xl p-4 border ${s.bg}`}>
                      <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Recent UPI Payments */}
                <div className="rounded-xl border border-slate-200/60 bg-white shadow-soft overflow-hidden">
                  <div className="border-b border-gray-100 bg-emerald-50/60 px-5 py-3">
                    <h2 className="text-sm font-bold text-gray-900">UPI Payment History</h2>
                    <p className="text-xs text-gray-500">All confirmed UPI payments via Razorpay</p>
                  </div>
                  {report.recentPayments.length === 0 ? (
                    <div className="py-10 text-center text-sm text-gray-400">No UPI payments yet</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide bg-gray-50">
                            <th className="px-5 py-3 text-left">Booking</th>
                            <th className="px-5 py-3 text-left">Guest</th>
                            <th className="px-5 py-3 text-left">Room</th>
                            <th className="px-5 py-3 text-left">Stay</th>
                            <th className="px-5 py-3 text-right">Amount</th>
                            <th className="px-5 py-3 text-left">Razorpay ID</th>
                            <th className="px-5 py-3 text-left">Paid At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {report.recentPayments.map((p) => (
                            <tr key={p.receiptNumber} className="hover:bg-emerald-50/30 transition-colors">
                              <td className="px-5 py-3 font-mono text-xs text-[#2563EB] font-bold">{p.bookingId}</td>
                              <td className="px-5 py-3">
                                <p className="text-xs font-semibold text-gray-800">{p.guestName}</p>
                                {p.guestOrganization && <p className="text-[11px] text-gray-400">{p.guestOrganization}</p>}
                              </td>
                              <td className="px-5 py-3 text-xs text-gray-600">{p.roomNumber ?? '—'}</td>
                              <td className="px-5 py-3 text-xs text-gray-500">{p.checkInDate} → {p.checkOutDate}</td>
                              <td className="px-5 py-3 text-right">
                                <span className="text-sm font-bold text-emerald-700">{formatINR(p.amount)}</span>
                              </td>
                              <td className="px-5 py-3 text-[11px] font-mono text-gray-500 max-w-[180px] truncate">{p.receiptNumber}</td>
                              <td className="px-5 py-3 text-xs text-gray-500">
                                {new Date(p.paidAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Pending Payments */}
                {report.pendingPayments.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-white shadow-soft overflow-hidden">
                    <div className="border-b border-amber-100 bg-amber-50/60 px-5 py-3">
                      <h2 className="text-sm font-bold text-gray-900">Pending Payments</h2>
                      <p className="text-xs text-gray-500">Guests checked-out or checked-in with outstanding payment</p>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-xs text-gray-400 font-semibold uppercase tracking-wide bg-gray-50">
                            <th className="px-5 py-3 text-left">Booking</th>
                            <th className="px-5 py-3 text-left">Guest</th>
                            <th className="px-5 py-3 text-left">Status</th>
                            <th className="px-5 py-3 text-left">Check-Out</th>
                            <th className="px-5 py-3 text-right">Amount Due</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {report.pendingPayments.map((p, i) => (
                            <tr key={i} className="hover:bg-amber-50/30 transition-colors">
                              <td className="px-5 py-3 font-mono text-xs text-[#2563EB] font-bold">{p.bookingId}</td>
                              <td className="px-5 py-3">
                                <p className="text-xs font-semibold text-gray-800">{p.guestName}</p>
                                {p.guestOrganization && <p className="text-[11px] text-gray-400">{p.guestOrganization}</p>}
                              </td>
                              <td className="px-5 py-3">
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">{p.status.replace('_', ' ')}</span>
                              </td>
                              <td className="px-5 py-3 text-xs text-gray-600">{p.checkOutDate}</td>
                              <td className="px-5 py-3 text-right">
                                <span className="text-sm font-bold text-amber-700">{formatINR(p.amount)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
