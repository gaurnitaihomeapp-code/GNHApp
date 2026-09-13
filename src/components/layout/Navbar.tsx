import React, { useState, useEffect } from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  User,
  LogOut,
  ShieldCheck,
  Clock,
  Bell,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Button } from '../common/Button';
import { Badge } from '../common/Badge';
import {
  formatMonthName,
  getCutoffCountdown,
  getCutoffFormattedDate,
  formatDevoteeName,
  MIN_CYCLE_MONTH,
} from '../../utils/calculations';
import { formatDevoteeFamilyDisplay } from '../../utils/devoteeHelpers';

export const Navbar: React.FC = () => {
  const {
    activeMonth,
    setActiveMonth,
    activeDevotee,
    guestName,
    setIsLoginModalOpen,
    logoutDevotee,
    isAdmin,
    logoutAdmin,
    theme,
    toggleTheme,
    setActiveTab,
    activeTab,
    setIsNotificationModalOpen,
    unreadNotificationCount,
    isLocalMode,
  } = useApp();

  const [countdown, setCountdown] = useState(() => getCutoffCountdown(activeMonth));
  const isMinMonth = activeMonth <= MIN_CYCLE_MONTH;

  // Live countdown timer updater (ticks every second)
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCutoffCountdown(activeMonth));
    }, 1000);
    return () => clearInterval(interval);
  }, [activeMonth]);

  // Navigate month back/forward (bounded by MIN_CYCLE_MONTH)
  const handlePrevMonth = () => {
    if (isMinMonth) return;
    const [yearStr, monthStr] = activeMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) - 1;
    if (month < 1) {
      month = 12;
      year -= 1;
    }
    const newMonth = `${year}-${month.toString().padStart(2, '0')}`;
    if (newMonth < MIN_CYCLE_MONTH) return;
    setActiveMonth(newMonth);
  };

  const handleNextMonth = () => {
    const [yearStr, monthStr] = activeMonth.split('-');
    let year = parseInt(yearStr, 10);
    let month = parseInt(monthStr, 10) + 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    const newMonth = `${year}-${month.toString().padStart(2, '0')}`;
    setActiveMonth(newMonth);
  };

  const hasMultipleMembers = Boolean(
    activeDevotee && activeDevotee.family_members && activeDevotee.family_members.length > 1
  );

  return (
    <header className="sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-3 sm:px-6">
        {/* Top Main Bar */}
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-4">
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setActiveTab('reports')}
              className="flex items-center gap-2.5 text-left group focus:outline-none"
            >
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center overflow-hidden p-1 shadow-sm transition-transform group-hover:scale-105">
                <img
                  src="/GNHLogo.png"
                  alt="GNH"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span className="font-extrabold text-base tracking-tight bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 dark:from-amber-400 dark:to-orange-400 bg-clip-text text-transparent">
                    GNH SEVA
                  </span>
                  <Badge variant="saffron" size="sm" className="text-[10px] px-1.5 py-0">
                    Prasadam
                  </Badge>
                  {isLocalMode && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 tracking-tight"
                      title="Operating in isolated Local Data mode. All changes stay in your browser and will never affect live production data."
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                      Local Data
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-medium text-slate-400">
                  Prasadam & Expense App
                </p>
              </div>
            </button>
          </div>

          {/* Month Selector Pill */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 rounded-2xl p-1 border border-slate-200/60 dark:border-slate-700/60 shadow-inner">
            <button
              onClick={handlePrevMonth}
              disabled={isMinMonth}
              className={`p-1.5 rounded-xl transition-colors ${
                isMinMonth
                  ? 'opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-600'
                  : 'hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
              }`}
              title={isMinMonth ? "Minimum month is August 2026" : "Previous Month"}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1.5 px-2.5 sm:px-3 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
              <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              <span className="truncate">{formatMonthName(activeMonth)}</span>
            </div>
            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-xl hover:bg-white dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Right Action Tools: Theme & Devotee Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2.5">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle Theme"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-400" />
              ) : (
                <Moon className="w-4 h-4 text-slate-600" />
              )}
            </button>

            {/* Notification Bell for logged-in devotee or guest */}
            {(activeDevotee || guestName) && (
              <button
                onClick={() => setIsNotificationModalOpen(true)}
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="View Expense Notifications"
                title="Expense Status Notifications"
              >
                <Bell className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                {unreadNotificationCount > 0 && (
                  <span className="absolute top-0.5 right-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-[9px] font-extrabold text-white shadow-sm ring-2 ring-white dark:ring-slate-900 animate-pulse">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>
            )}

            {/* Admin indicator ONLY shown if admin is logged in */}
            {isAdmin && (
              <button
                onClick={() => {
                  if (activeTab === 'admin') {
                    logoutAdmin();
                  } else {
                    setActiveTab('admin');
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/20 transition-all"
                title="Admin Mode Active (Click to lock or view)"
              >
                <ShieldCheck className="w-4 h-4" />
                <span className="hidden sm:inline">Admin Mode</span>
              </button>
            )}

            {/* Active User Chip */}
            <div className="flex items-center">
              {activeDevotee ? (
                <div className="flex items-center gap-1.5 p-1 pl-2.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-500/20 rounded-2xl">
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                      {formatDevoteeName(activeDevotee)}
                    </div>
                    <div className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
                      📱 {activeDevotee.phone_number}
                    </div>
                  </div>
                  <Button
                    onClick={logoutDevotee}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2.5 py-1 h-7 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold"
                    title="Logout"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    <span>Logout</span>
                  </Button>
                </div>
              ) : guestName ? (
                <div className="flex items-center gap-1.5 p-1 pl-2.5 bg-sky-50 dark:bg-sky-950/40 border border-sky-500/20 rounded-2xl">
                  <div className="text-left hidden md:block">
                    <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                      Guest: {guestName}
                    </div>
                    <div className="text-[10px] text-sky-600 dark:text-sky-400">
                      Temporary Seva
                    </div>
                  </div>
                  <Button
                    onClick={logoutDevotee}
                    variant="ghost"
                    size="sm"
                    className="text-xs px-2.5 py-1 h-7 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold"
                    title="Logout"
                  >
                    <LogOut className="w-3.5 h-3.5 mr-1" />
                    <span>Logout</span>
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setIsLoginModalOpen(true)}
                  variant="saffron"
                  size="sm"
                  className="rounded-xl text-xs py-1.5 px-3"
                >
                  <User className="w-3.5 h-3.5 mr-1" />
                  <span>Login</span>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Sub-Banner: Closes Exact Date & Group Status */}
        <div className="flex items-center justify-between py-1.5 border-t border-slate-100 dark:border-slate-800/60 text-[11px]">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 font-medium text-slate-500 dark:text-slate-400">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Closes: {getCutoffFormattedDate(activeMonth)}</span>
            </span>
            <Badge
              variant={countdown.isPassed ? 'danger' : countdown.days <= 2 ? 'warning' : 'saffron'}
              size="sm"
              className="font-mono text-[10px]"
            >
              {countdown.text}
            </Badge>
          </div>

          {hasMultipleMembers && (
            <div className="hidden sm:flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span>Family:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300 truncate max-w-[240px]">
                {formatDevoteeFamilyDisplay(activeDevotee, false)}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
