'use client';

import Header from '@/components/Header';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { formatINR, paymentCategoryLabel, propertyTitle } from '@/lib/tariffs';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import jsPDF from 'jspdf';

declare global {
  interface Window {
    Razorpay: new (options: object) => { open(): void };
  }
}

interface Room { id: number; roomNumber: string; property: string; roomType: string; }

interface Booking {
  id: number; bookingId: string; guestName: string; guestPhone: string;
  guestOrganization?: string; guestDesignation?: string;
  checkInDate: string; checkOutDate: string;
  status: string; paymentStatus?: string;
  paymentAmount?: number; rentAmount?: number; incidentalChargeAmount?: number;
  paymentCategory?: string; notes?: string;
  room?: Room; rooms?: Room[];
}

interface QRModal { booking: Booking; qrId: string; imageUrl: string; }

function roomNumbers(b: Booking) {
  if (b.rooms?.length) return b.rooms.map(r => r.roomNumber).join(', ');
  if (b.room) return b.room.roomNumber;
  return '—';
}
function roomProperty(b: Booking) {
  if (b.rooms?.length) return b.rooms[0].property;
  if (b.room) return b.room.property;
  return '';
}
function nightCount(checkIn: string, checkOut: string) {
  return Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000));
}

function generateReceiptPDF(data: {
  bookingId: string; guestName: string; guestOrganization: string;
  checkInDate: string; checkOutDate: string; paymentAmount: number;
  rentAmount?: number; incidentalAmount?: number; paymentCategory: string;
  roomNumber?: string; property?: string; paymentId: string;
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = 210, margin = 14, contentW = pageW - margin * 2;
  const now = new Date();

  // Header
  doc.setFillColor(30, 64, 175); doc.rect(0, 0, pageW, 48, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
  doc.text('CASFOS Executive Hostel', margin, 16);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(186, 230, 253);
  doc.text('Centre for Advanced Forest Operations', margin, 24);
  doc.text('Forest Campus, Coimbatore — 641 002, Tamil Nadu', margin, 30);
  doc.text('Ministry of Environment, Forest & Climate Change, Govt. of India', margin, 36);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
  doc.text('OFFICIAL PAYMENT RECEIPT', pageW - margin, 16, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(186, 230, 253);
  doc.text('System Generated · No Signature Required', pageW - margin, 24, { align: 'right' });

  // Meta bar
  doc.setFillColor(239, 246, 255); doc.rect(0, 48, pageW, 20, 'F');
  doc.setDrawColor(147, 197, 253); doc.line(0, 48, pageW, 48); doc.line(0, 68, pageW, 68);
  const metaItems: [string, string, number][] = [
    ['Booking ID', data.bookingId, margin],
    ['Receipt Date', now.toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), margin + 55],
    ['Time', now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }), margin + 115],
    ['Payment Mode', 'UPI', margin + 145],
  ];
  metaItems.forEach(([label, value, x]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(71, 85, 105);
    doc.text(label.toUpperCase(), x, 56);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(15, 23, 42);
    doc.text(value, x, 64);
  });

  // Guest & Stay
  let y = 76;
  doc.setFillColor(248, 250, 252); doc.rect(margin, y, contentW, 7, 'F');
  doc.setDrawColor(226, 232, 240); doc.rect(margin, y, contentW, 7, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
  doc.text('GUEST INFORMATION', margin + 3, y + 5);
  doc.text('STAY DETAILS', margin + contentW / 2 + 3, y + 5);
  y += 10;
  doc.setDrawColor(226, 232, 240); doc.line(pageW / 2 + 2, y - 3, pageW / 2 + 2, y + 34);
  const nights = nightCount(data.checkInDate, data.checkOutDate);
  const left: [string, string][] = [
    ['Guest Name', data.guestName], ['Organization', data.guestOrganization || '—'],
    ['Room No.', data.roomNumber || '—'], ['Property', data.property ? propertyTitle(data.property) : '—'],
  ];
  const right: [string, string][] = [
    ['Check-In', data.checkInDate], ['Check-Out', data.checkOutDate],
    ['Duration', `${nights} Night${nights !== 1 ? 's' : ''}`],
    ['UPI Txn ID', data.paymentId.slice(0, 20) + (data.paymentId.length > 20 ? '…' : '')],
  ];
  left.forEach(([lbl, val], i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text(lbl, margin + 2, y + i * 9);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
    doc.text(val, margin + 28, y + i * 9);
  });
  right.forEach(([lbl, val], i) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(100, 116, 139);
    doc.text(lbl, pageW / 2 + 6, y + i * 9);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(15, 23, 42);
    doc.text(val, pageW / 2 + 26, y + i * 9);
  });
  y += 42;

  // Payment breakdown
  doc.setFillColor(248, 250, 252); doc.rect(margin, y, contentW, 7, 'F');
  doc.setDrawColor(226, 232, 240); doc.rect(margin, y, contentW, 7, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(100, 116, 139);
  doc.text('PAYMENT BREAKDOWN', margin + 3, y + 5);
  y += 10;
  doc.setFillColor(241, 245, 249); doc.rect(margin, y - 3, contentW, 8, 'F');
  doc.setDrawColor(203, 213, 225); doc.rect(margin, y - 3, contentW, 8, 'S');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(71, 85, 105);
  doc.text('Description', margin + 5, y + 2);
  doc.text('Amount (INR)', pageW - margin - 5, y + 2, { align: 'right' });
  y += 9;
  const payRows: [string, number][] = [];
  if (data.rentAmount && data.rentAmount > 0)
    payRows.push([`Room Rent (${nights} night${nights !== 1 ? 's' : ''})`, data.rentAmount]);
  if (data.incidentalAmount && data.incidentalAmount > 0)
    payRows.push([`Incidental / Maintenance Charges (${nights} night${nights !== 1 ? 's' : ''})`, data.incidentalAmount]);
  payRows.forEach(([desc, amount], i) => {
    doc.setFillColor(i % 2 === 0 ? 255 : 248, i % 2 === 0 ? 255 : 250, i % 2 === 0 ? 255 : 252);
    doc.rect(margin, y - 3, contentW, 9, 'F');
    doc.setDrawColor(226, 232, 240); doc.line(margin, y + 6, margin + contentW, y + 6);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(51, 65, 85);
    doc.text(desc, margin + 5, y + 2);
    doc.setFont('helvetica', 'bold'); doc.text(formatINR(amount), pageW - margin - 5, y + 2, { align: 'right' });
    y += 9;
  });
  doc.setFillColor(30, 64, 175); doc.rect(margin, y, contentW, 13, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text('TOTAL AMOUNT PAID', margin + 5, y + 9);
  doc.setFontSize(12); doc.text(formatINR(data.paymentAmount), pageW - margin - 5, y + 9, { align: 'right' });
  y += 18;

  // Paid stamp
  doc.setDrawColor(22, 163, 74); doc.setLineWidth(1.5);
  doc.roundedRect(margin, y, 42, 16, 3, 3, 'S'); doc.setLineWidth(0.2);
  doc.setTextColor(22, 163, 74); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
  doc.text('✓  PAID', margin + 4, y + 11);
  doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
  const txDate = now.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  doc.text(`Transaction ID : ${data.paymentId}`, pageW - margin, y + 5, { align: 'right' });
  doc.text(`Payment Date   : ${txDate}`, pageW - margin, y + 12, { align: 'right' });
  y += 26;

  // Footer
  doc.setFillColor(30, 64, 175); doc.rect(0, 272, pageW, 25, 'F');
  doc.setTextColor(186, 230, 253); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text('Thank you for choosing CASFOS Executive Hostel, Coimbatore.', pageW / 2, 280, { align: 'center' });
  doc.text('For queries, please contact the Estate Office.', pageW / 2, 287, { align: 'center' });
  doc.setFontSize(7); doc.setTextColor(147, 197, 253);
  doc.text('Centre for Advanced Forest Operations in Silvi-Culture (CASFOS) · Ministry of Environment, Forest & Climate Change', pageW / 2, 293, { align: 'center' });

  doc.save(`CASFOS-Receipt-${data.bookingId}.pdf`);
}

export default function CollectPaymentPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState<number | null>(null);
  const [qrLoadingId, setQrLoadingId] = useState<number | null>(null);
  const [checkingOutId, setCheckingOutId] = useState<number | null>(null);

  // QR modal state
  const [qrModal, setQrModal] = useState<QRModal | null>(null);
  const [qrStatus, setQrStatus] = useState<'waiting' | 'paid'>('waiting');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data: any = await api.get('/bookings');
      const all: Booking[] = Array.isArray(data) ? data : [];
      setBookings(all.filter(b => b.status === 'CHECKED_IN' && b.paymentStatus !== 'PAID'));
    } catch { toast.error('Failed to load bookings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Stop polling when component unmounts
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  const closeQR = () => { stopPolling(); setQrModal(null); setQrStatus('waiting'); };

  const openQR = async (booking: Booking) => {
    setQrLoadingId(booking.id);
    try {
      const data: any = await api.post(`/payments/create-qr/${booking.id}`);
      setQrModal({ booking, qrId: data.qrId, imageUrl: data.imageUrl });
      setQrStatus('waiting');

      // Auto-poll every 3 seconds for payment confirmation
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const status: any = await api.get(`/payments/poll-qr?qrId=${data.qrId}&bookingId=${booking.id}`);
          if (status.paid) {
            stopPolling();
            setQrStatus('paid');
            toast.success(`Payment received from ${status.guestName}! Generating receipt…`);
            generateReceiptPDF({
              bookingId:        status.bookingId,
              guestName:        status.guestName,
              guestOrganization: status.guestOrganization || '',
              checkInDate:      status.checkInDate,
              checkOutDate:     status.checkOutDate,
              paymentAmount:    status.paymentAmount,
              rentAmount:       status.rentAmount,
              incidentalAmount: status.incidentalAmount,
              paymentCategory:  status.paymentCategory ? paymentCategoryLabel(status.paymentCategory) : '—',
              roomNumber:       status.roomNumber,
              property:         status.property,
              paymentId:        status.paymentId || 'QR-PAYMENT',
            });
            setTimeout(() => { closeQR(); load(); }, 2500);
          }
        } catch { /* silent — retry next tick */ }
      }, 3000);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to generate QR code');
    } finally { setQrLoadingId(null); }
  };

  const collectViaUPI = async (booking: Booking) => {
    if (!window.Razorpay) { toast.error('Payment gateway not loaded. Please refresh.'); return; }
    setCollectingId(booking.id);
    try {
      const order: any = await api.post(`/payments/create-order/${booking.id}`);
      setCollectingId(null);

      const options = {
        key: order.keyId,
        amount: Math.round(Number(order.amount) * 100),
        currency: 'INR',
        name: 'CASFOS Executive Hostel',
        description: `Stay payment · ${order.bookingId}`,
        order_id: order.orderId,
        prefill: { name: order.guestName, email: order.guestEmail || '', contact: order.guestPhone || '' },
        theme: { color: '#2563EB' },
        modal: { ondismiss: () => setCollectingId(null) },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            const result: any = await api.post(`/payments/verify/${booking.id}`, {
              razorpay_order_id:   response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
            });
            if (result.success) {
              toast.success(`Payment of ${formatINR(result.paymentAmount)} collected! Generating receipt…`);
              generateReceiptPDF({
                bookingId:        result.bookingId,
                guestName:        result.guestName,
                guestOrganization: result.guestOrganization || '',
                checkInDate:      result.checkInDate,
                checkOutDate:     result.checkOutDate,
                paymentAmount:    result.paymentAmount,
                rentAmount:       result.rentAmount,
                incidentalAmount: result.incidentalAmount,
                paymentCategory:  result.paymentCategory ? paymentCategoryLabel(result.paymentCategory) : '—',
                roomNumber:       result.roomNumber,
                property:         result.property,
                paymentId:        result.paymentId,
              });
              await load();
            }
          } catch (err: any) { toast.error(err?.message ?? 'Payment verification failed'); }
        },
      };
      new window.Razorpay(options).open();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to initiate payment');
      setCollectingId(null);
    }
  };

  const manualCheckout = async (booking: Booking) => {
    if (!confirm(`Checkout ${booking.guestName} manually? Payment will be marked as collected (cash/waived).`)) return;
    setCheckingOutId(booking.id);
    try {
      await api.post(`/bookings/${booking.id}/checkout`);
      toast.success(`${booking.guestName} checked out.`);
      await load();
    } catch (err: any) { toast.error(err?.message ?? 'Checkout failed'); }
    finally { setCheckingOutId(null); }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden bg-gray-50/40">
      <Header title="Collect Payment" />

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl">

          {/* Header */}
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[#0F172A]">Collect Payment</h1>
              <p className="mt-0.5 text-xs text-[#64748B]">
                Use <strong>Collect via UPI</strong> to send a payment request to the guest's UPI app, or <strong>Show QR</strong> for the guest to scan and pay.
              </p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-center">
              <p className="text-lg font-bold text-emerald-700">{bookings.length}</p>
              <p className="text-[10px] font-semibold text-emerald-600">Pending Payment</p>
            </div>
          </div>

          {/* Payment method legend */}
          <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-blue-800"><strong>Collect via UPI</strong> — Enter guest's UPI ID or mobile number. A payment request is sent directly to their UPI app (GPay, PhonePe, etc.).</p>
            </div>
            <div className="flex items-start gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <p className="text-violet-800"><strong>Show QR Code</strong> — A large QR code is displayed. Guest scans it with any UPI app. Payment is auto-detected.</p>
            </div>
          </div>

          {/* Booking cards */}
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-60 rounded-2xl" />)}
            </div>
          ) : bookings.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center shadow-sm">
              <svg className="mx-auto mb-3 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-semibold text-gray-500">No pending payments</p>
              <p className="mt-1 text-xs text-gray-400">All checked-in guests have paid</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {bookings.map((b) => (
                <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-all">

                  {/* Guest */}
                  <div className="mb-4 flex items-start justify-between gap-2">
                    <div>
                      <Link href={`/bookings/${b.id}`} className="text-[11px] font-bold text-[#2563EB] hover:underline">
                        {b.bookingId}
                      </Link>
                      <p className="mt-0.5 text-base font-bold text-gray-900">{b.guestName}</p>
                      {b.guestDesignation && <p className="text-xs text-gray-500">{b.guestDesignation}</p>}
                      {b.guestOrganization && <p className="text-xs text-gray-500">{b.guestOrganization}</p>}
                    </div>
                    <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                      Checked In
                    </span>
                  </div>

                  {/* Dates */}
                  <div className="mb-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-blue-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-500">Check-In</p>
                      <p className="mt-0.5 font-bold text-slate-800">{b.checkInDate}</p>
                    </div>
                    <div className="rounded-xl bg-orange-50 px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Check-Out</p>
                      <p className="mt-0.5 font-bold text-slate-800">{b.checkOutDate}</p>
                    </div>
                  </div>

                  {/* Room */}
                  {roomNumbers(b) !== '—' && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2 text-xs">
                      <svg className="h-3.5 w-3.5 shrink-0 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16" />
                      </svg>
                      <span className="font-bold text-orange-800">Room {roomNumbers(b)}</span>
                      {roomProperty(b) && <span className="text-orange-600">— {propertyTitle(roomProperty(b))}</span>}
                    </div>
                  )}

                  {b.notes && (
                    <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
                      <p className="font-bold text-amber-700">⚠ Special Instructions</p>
                      <p className="mt-0.5 text-amber-800">{b.notes}</p>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="mb-4 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Amount to Collect</p>
                        <p className="mt-1 text-2xl font-black text-violet-900">{formatINR(b.paymentAmount ?? 0)}</p>
                      </div>
                      <div className="text-right text-xs text-violet-600 space-y-0.5">
                        {!!b.rentAmount && <p>Rent: {formatINR(b.rentAmount)}</p>}
                        {!!b.incidentalChargeAmount && <p>Incidental: {formatINR(b.incidentalChargeAmount)}</p>}
                        {b.paymentCategory && <p className="mt-1 font-semibold">{paymentCategoryLabel(b.paymentCategory)}</p>}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    {/* Collect via UPI — sends collect request to guest's app */}
                    <button
                      onClick={() => collectViaUPI(b)}
                      disabled={!!collectingId || !!qrLoadingId || !!checkingOutId}
                      className="rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60 transition flex items-center justify-center gap-1.5"
                    >
                      {collectingId === b.id ? (
                        <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Opening…</>
                      ) : (
                        <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg> Collect via UPI</>
                      )}
                    </button>

                    {/* Show QR — generates large QR code */}
                    <button
                      onClick={() => openQR(b)}
                      disabled={!!collectingId || !!qrLoadingId || !!checkingOutId}
                      className="rounded-xl bg-violet-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-60 transition flex items-center justify-center gap-1.5"
                    >
                      {qrLoadingId === b.id ? (
                        <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg> Generating…</>
                      ) : (
                        <><svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"/></svg> Show QR Code</>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={() => manualCheckout(b)}
                    disabled={!!checkingOutId || !!collectingId || !!qrLoadingId}
                    className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60 transition"
                  >
                    {checkingOutId === b.id ? 'Processing…' : 'Cash / Waived (Manual Checkout)'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* ── QR CODE MODAL ──────────────────────────────────── */}
      {qrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">

            {/* Modal header */}
            <div className="bg-violet-600 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">UPI QR Code</h2>
                <p className="text-xs text-violet-200 mt-0.5">Guest scans to pay instantly</p>
              </div>
              <button onClick={closeQR} className="rounded-xl bg-white/20 p-2 text-white hover:bg-white/30 transition">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              {/* Guest + amount summary */}
              <div className="mb-5 flex items-center justify-between rounded-2xl border border-violet-100 bg-violet-50 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-violet-600">{qrModal.booking.guestName}</p>
                  <p className="text-[10px] text-violet-500">{qrModal.booking.bookingId}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-semibold uppercase text-violet-500">Amount</p>
                  <p className="text-xl font-black text-violet-900">{formatINR(qrModal.booking.paymentAmount ?? 0)}</p>
                </div>
              </div>

              {/* QR code — large */}
              {qrStatus === 'waiting' ? (
                <div className="flex flex-col items-center">
                  <div className="rounded-2xl border-4 border-violet-200 p-2 bg-white shadow-inner">
                    <img
                      src={qrModal.imageUrl}
                      alt="UPI QR Code"
                      className="h-72 w-72 object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <svg className="h-4 w-4 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    <span>Waiting for payment… auto-detects when paid</span>
                  </div>
                  <p className="mt-2 text-[10px] text-slate-400 text-center">
                    Scan with GPay, PhonePe, Paytm or any UPI app · Valid for 1 hour
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 mb-4">
                    <svg className="h-10 w-10 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-lg font-black text-emerald-700">Payment Received!</p>
                  <p className="mt-1 text-sm text-slate-500">PDF receipt is downloading…</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
