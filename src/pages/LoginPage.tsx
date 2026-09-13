import React, { useState } from 'react';
import {
  Phone,
  ArrowRight,
  ShieldCheck,
  User,
  CheckCircle2,
  Moon,
  Sun,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { formatDevoteeName } from '../utils/calculations';
import { findDevoteeByPhone, formatDevoteeFamilyDisplay } from '../utils/devoteeHelpers';

export const LoginPage: React.FC = () => {
  const {
    devotees,
    loginWithPhone,
    loginAsGuest,
    setIsAdminPinModalOpen,
    theme,
    toggleTheme,
    showToast,
  } = useApp();

  const [phoneInput, setPhoneInput] = useState('');
  const [guestNameInput, setGuestNameInput] = useState('');
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Clean phone input (digits only, max 10)
  const cleanPhone = phoneInput.replace(/\D/g, '').slice(0, 10);

  // Check if a registered devotee or family member matches the current phone input
  const phoneMatch = cleanPhone.length === 10
    ? findDevoteeByPhone(devotees, cleanPhone)
    : null;
  const matchedDevotee = phoneMatch?.devotee || null;

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cleanPhone.length !== 10) {
      showToast({
        type: 'warning',
        title: 'Enter 10-Digit Mobile',
        message: 'Please enter a valid 10-digit Indian phone number.',
      });
      return;
    }

    setIsLoading(true);
    try {
      const success = await loginWithPhone(cleanPhone);
      if (!success) {
        showToast({
          type: 'error',
          title: 'Devotee Not Found',
          message: `No devotee or family member registered with mobile +91 ${cleanPhone}. Please check your number or continue as guest.`,
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNameInput.trim()) {
      showToast({
        type: 'warning',
        title: 'Name Required',
        message: 'Please enter your name to log seva expenses as guest.',
      });
      return;
    }
    loginAsGuest(guestNameInput.trim());
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-gradient-to-br from-amber-50 via-slate-50 to-orange-50 dark:from-slate-950 dark:via-slate-900 dark:to-amber-950/30 text-slate-900 dark:text-slate-100 p-4 sm:p-6 md:p-8">
      {/* Top Header with Theme Switcher */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center p-1">
            <img src="/GNHLogo.png" alt="GNH" className="w-full h-full object-contain" />
          </div>
          <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
            GNH Seva App
          </span>
        </div>

        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          title="Toggle Dark Mode"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-auto py-8">
        <Card className="p-6 sm:p-8 border-2 border-amber-500/20 shadow-2xl backdrop-blur-md bg-white/90 dark:bg-slate-900/90 rounded-3xl">
          {/* Logo & Title */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto rounded-3xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border-2 border-amber-500/40 flex items-center justify-center p-3 shadow-inner mb-4">
              <img src="/GNHLogo.png" alt="GNH Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              GNH Community Seva
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Prasadam Meals Ledger & Devotee Seva Portal
            </p>
          </div>

          {!showGuestForm ? (
            /* Standard Mobile Number Login Form */
            <form onSubmit={handlePhoneSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 mb-2">
                  Enter Registered Mobile Number
                </label>
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 flex items-center gap-1.5 text-slate-400 dark:text-slate-500 font-semibold text-sm pointer-events-none">
                    <Phone className="w-4 h-4 text-amber-500" />
                    <span>+91</span>
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    autoFocus
                    placeholder="9876543210"
                    value={cleanPhone}
                    onChange={e => setPhoneInput(e.target.value)}
                    className="w-full pl-20 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/80 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white font-mono text-base font-bold tracking-wider focus:border-amber-500 focus:ring-4 focus:ring-amber-500/15 outline-none transition-all"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5 pl-1">
                  Log in with your primary mobile or any registered family member's phone number.
                </p>
              </div>

              {/* Instant Match Badge */}
              {matchedDevotee && (
                <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 flex items-start gap-3 animate-fade-in shadow-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <div className="font-bold text-sm text-emerald-900 dark:text-emerald-200">
                      {formatDevoteeName(matchedDevotee)}
                    </div>
                    {phoneMatch?.matchedMemberName && !phoneMatch.isPrimary && (
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-semibold text-[11px]">
                        <User className="w-3 h-3" />
                        <span>Logging in via Family Member: <strong>{phoneMatch.matchedMemberName}</strong> (+91 {cleanPhone})</span>
                      </div>
                    )}
                    {matchedDevotee.family_members && matchedDevotee.family_members.length > 1 && (
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        <strong>Family:</strong> {formatDevoteeFamilyDisplay(matchedDevotee, false)}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <Button
                type="submit"
                variant="saffron"
                size="lg"
                className="w-full py-3.5 text-base font-bold shadow-lg shadow-amber-500/20"
                disabled={cleanPhone.length !== 10 || isLoading}
              >
                {isLoading ? (
                  <span>Signing In...</span>
                ) : phoneMatch?.matchedMemberName && !phoneMatch.isPrimary ? (
                  <>
                    <span>Continue as {phoneMatch.matchedMemberName} ({matchedDevotee?.group_name})</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                ) : matchedDevotee ? (
                  <>
                    <span>Continue as {matchedDevotee.group_name}</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                ) : (
                  <>
                    <span>Verify & Login</span>
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </>
                )}
              </Button>

              {/* Guest & Admin Options */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setShowGuestForm(true)}
                  className="text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>Continue as Guest</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAdminPinModalOpen(true)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 font-medium"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-slate-400" />
                  <span>Admin Portal</span>
                </button>
              </div>
            </form>
          ) : (
            /* Guest Access Form */
            <form onSubmit={handleGuestSubmit} className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Guest Seva Access
                </h3>
                <button
                  type="button"
                  onClick={() => setShowGuestForm(false)}
                  className="text-xs text-amber-600 hover:underline"
                >
                  Back to Phone Login
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                  Your Full Name
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Radheshyam Das"
                  value={guestNameInput}
                  onChange={e => setGuestNameInput(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-sm focus:border-amber-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Guests can log regular grocery/seva expenses and festival seva contributions.
                </p>
              </div>

              <Button
                type="submit"
                variant="saffron"
                size="lg"
                className="w-full py-3 text-sm font-bold"
                disabled={!guestNameInput.trim()}
              >
                <span>Continue as Guest</span>
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </form>
          )}
        </Card>
      </div>

      {/* Footer */}
      <div className="max-w-md w-full mx-auto text-center text-xs text-slate-400">
        Sri Sri Radha Gopinath Mandir • GNH Community Prasadam System
      </div>
    </div>
  );
};
