'use client';

import { useAuthStore } from '@/store/auth';
import { useEffect, useRef, useState, useCallback } from 'react';
import api from '@/lib/api';
import Link from 'next/link';

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

export default function Header({ title }: { title?: string }) {
  const { user, hydrate } = useAuthStore();
  const [unread, setUnread] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => { hydrate(); }, [hydrate]);

  const fetchUnread = useCallback(async () => {
    try {
      const data: any = await api.get('/notifications/unread-count');
      setUnread(data?.count ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 30000);
    return () => clearInterval(interval);
  }, [fetchUnread]);

  const handleBellClick = async () => {
    if (!open) {
      try {
        const data: any = await api.get('/notifications');
        setNotifications(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch { /* ignore */ }
    }
    setOpen((prev) => !prev);
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setUnread(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  const markRead = async (id: number) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch { /* ignore */ }
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const typeIcon: Record<string, string> = {
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

  const getNotifLink = (n: Notification) => {
    if (n.relatedEntityType === 'BOOKING' && n.relatedEntityId) return `/bookings/${n.relatedEntityId}`;
    if (n.relatedEntityType === 'MASTER_REQUEST') return `/masters`;
    return '#';
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const roleLabel: Record<string, string> = {
    ASSISTANT_ESTATE_OFFICER: 'Asst. Estate Officer',
    ESTATE_OFFICER: 'Estate Officer',
    CARETAKER: 'Caretaker',
  };

  return (
    <header className="h-[60px] bg-white border-b border-slate-200/60 flex items-center justify-between px-6 shrink-0 shadow-soft z-10">
      <div>
        <h2 className="text-[15px] font-semibold text-[#0F172A]">{title ?? 'Dashboard'}</h2>
        <p className="text-[11px] text-[#64748B] leading-tight font-medium">CASFOS Executive Hostel · Coimbatore</p>
      </div>

      <div className="flex items-center gap-3">
        {/* Notification Bell */}
        <div className="relative" ref={bellRef}>
          <button
            onClick={handleBellClick}
            className="relative w-9 h-9 rounded-lg bg-blue-50/80 hover:bg-blue-100/80 border border-blue-100/50 flex items-center justify-center transition-all duration-250 text-[#2563EB] hover:text-[#1D4ED8] shadow-xs hover:shadow-soft"
            title="Notifications"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none shadow-soft">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Dropdown */}
          {open && (
            <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-soft-xl border border-slate-200/60 overflow-hidden z-50 animate-slide-in-down">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100/60 bg-slate-50/30">
                <span className="text-sm font-bold text-[#0F172A]">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead}
                    className="text-xs text-[#2563EB] font-semibold hover:text-[#1D4ED8] transition-colors duration-200">
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-64 overflow-y-auto divide-y divide-slate-100/60">
                {notifications.length === 0 ? (
                  <div className="py-10 text-center text-[#64748B] text-xs font-medium">No notifications yet</div>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={getNotifLink(n)}
                      onClick={() => { if (!n.isRead) markRead(n.id); setOpen(false); }}
                      className={`flex items-start gap-3 px-4 py-3 hover:bg-blue-50/60 transition-all duration-200 cursor-pointer ${!n.isRead ? 'bg-blue-50/40' : ''}`}
                    >
                      <span className="text-base mt-0.5 shrink-0">{typeIcon[n.type] ?? '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${n.isRead ? 'text-[#64748B]' : 'text-[#0F172A]'} truncate`}>
                          {n.title}
                        </p>
                        <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-[#94A3B8] mt-1">{formatTime(n.createdAt)}</p>
                      </div>
                      {!n.isRead && (
                        <div className="w-2 h-2 bg-[#2563EB] rounded-full shrink-0 mt-1.5 shadow-glow-primary" />
                      )}
                    </Link>
                  ))
                )}
              </div>
              <div className="border-t border-slate-100 px-4 py-2.5">
                <Link
                  href="/notifications"
                  onClick={() => setOpen(false)}
                  className="block text-center text-xs font-semibold text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
                >
                  View all past notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

    
      </div>
    </header>
  );
}
