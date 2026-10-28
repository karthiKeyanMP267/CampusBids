import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  CheckCheck,
  Trophy,
  AlertCircle,
  MessageSquare,
  Search,
  Handshake,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import { cn } from '../../lib/utils';

export default function NotificationBell() {
  const { user, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [browserPermission, setBrowserPermission] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const menuRef = useRef(null);
  const navigate = useNavigate();

  // Load user's notifications
  async function loadNotifications() {
    if (!user || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) throw error;
      setNotifications(data || []);
      setUnreadCount((data || []).filter((n) => !n.is_read).length);
    } catch {
      // Non-blocking
    }
  }

  useEffect(() => {
    if (!isAuthenticated || !user) return;
    loadNotifications();

    // Realtime notifications subscription (unique channel name per instance to prevent collision)
    let channel = null;
    try {
      const channelName = `notifs-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      channel = supabase
        .channel(channelName)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (payload?.new) {
              setNotifications((prev) => [payload.new, ...prev]);
              setUnreadCount((c) => c + 1);

              // Browser notification if granted
              if (
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                try {
                  new Notification(payload.new.title, {
                    body: payload.new.message,
                    icon: '/favicon.ico',
                  });
                } catch {
                  // Ignore browser permission error
                }
              }
            }
          }
        );
      channel.subscribe();
    } catch (subErr) {
      console.warn('Realtime notifications subscription skipped:', subErr);
    }

    // Close on click outside
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      if (channel && supabase) {
        try {
          supabase.removeChannel(channel);
        } catch {
          // Ignore
        }
      }
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [user?.id, isAuthenticated]);

  async function handleMarkAllAsRead() {
    if (!user || !supabase) return;
    try {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    } catch {
      // Non-blocking
    }
  }

  async function handleNotificationClick(notif) {
    // Mark as read
    if (!notif.is_read && supabase) {
      supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notif.id)
        .then(() => {
          setNotifications((prev) =>
            prev.map((n) => (n.id === notif.id ? { ...n, is_read: true } : n))
          );
          setUnreadCount((c) => Math.max(0, c - 1));
        });
    }

    setOpen(false);
    if (notif.auction_id) {
      navigate(`/auction/${notif.auction_id}`);
    }
  }

  async function requestBrowserPermission() {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setBrowserPermission(perm);
      if (perm === 'granted') {
        new Notification('Notifications Enabled!', {
          body: 'You will receive desktop alerts for auction updates while CampusBid is open.',
        });
      }
    }
  }

  if (!isAuthenticated) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-xl border border-surface-200 bg-white p-2 text-surface-600 hover:bg-surface-50 hover:text-surface-900 transition-colors shadow-2xs"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-bold text-white ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Menu */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-surface-200 bg-white shadow-xl animate-fade-in z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-surface-150 bg-surface-50">
            <div className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-brand-600" />
              <h4 className="text-xs font-bold text-surface-900">Notifications</h4>
              {unreadCount > 0 && (
                <span className="rounded-full bg-brand-100 text-brand-800 text-[10px] font-bold px-2 py-0.2">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 flex items-center gap-1 transition-colors"
              >
                <CheckCheck className="h-3 w-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Browser notification prompt if not decided */}
          {browserPermission === 'default' && (
            <div className="p-2.5 bg-brand-50/60 border-b border-brand-100 flex items-center justify-between gap-2">
              <span className="text-[11px] text-brand-800">
                Get desktop alerts for outbids & wins?
              </span>
              <button
                type="button"
                onClick={requestBrowserPermission}
                className="text-[10px] font-bold bg-brand-600 text-white px-2.5 py-1 rounded-lg hover:bg-brand-700 shadow-2xs shrink-0"
              >
                Enable
              </button>
            </div>
          )}

          {/* Notifications List */}
          <div className="max-h-[380px] overflow-y-auto divide-y divide-surface-100">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-xs text-surface-400">
                <CheckCheck className="h-8 w-8 text-surface-300 mx-auto mb-2" />
                All caught up! No notifications yet.
              </div>
            ) : (
              notifications.map((n) => {
                let icon = <Bell className="h-4 w-4 text-brand-500" />;
                if (n.type === 'won') {
                  icon = <Trophy className="h-4 w-4 text-amber-500" />;
                } else if (n.type === 'outbid') {
                  icon = <AlertCircle className="h-4 w-4 text-red-500" />;
                } else if (n.type === 'seller_approval') {
                  icon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
                } else if (n.type === 'seller_rejection') {
                  icon = <XCircle className="h-4 w-4 text-rose-500" />;
                } else if (n.type === 'qa_answered' || n.type === 'qa_new_question') {
                  icon = <MessageSquare className="h-4 w-4 text-purple-500" />;
                } else if (n.type === 'saved_search_match') {
                  icon = <Search className="h-4 w-4 text-blue-500" />;
                } else if (n.type === 'handover_update') {
                  icon = <Handshake className="h-4 w-4 text-emerald-500" />;
                }

                return (
                  <div
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      'p-3.5 hover:bg-surface-50 cursor-pointer transition-colors flex items-start gap-3',
                      !n.is_read && 'bg-brand-50/20'
                    )}
                  >
                    <div className="mt-0.5 shrink-0 rounded-xl bg-white border border-surface-200 p-2 shadow-2xs">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className={cn('text-xs truncate', !n.is_read ? 'font-bold text-surface-900' : 'font-medium text-surface-700')}>
                          {n.title}
                        </p>
                        {!n.is_read && (
                          <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" />
                        )}
                      </div>
                      <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-2 leading-relaxed">
                        {n.message}
                      </p>
                      <span className="text-[9px] text-surface-400 mt-1 block">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
