import React, { useState } from 'react';
import {
  TrendingUp,
  ArrowRight,
  CheckCircle2,
  Clock,
  Receipt,
  CreditCard,
  Utensils,
  IndianRupee,
  Info,
  Calculator,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Crown,
  Users,
  UserCheck,
  Bell,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useApp } from '../context/AppContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import {
  formatRupee,
  formatMonthName,
  formatDevoteeName,
  PRASADAM_RATES,
  formatExpenseDate,
  formatSubmissionDateTime,
} from '../utils/calculations';
import { formatDevoteeFamilyDisplay } from '../utils/devoteeHelpers';
import { Expense } from '../types';

export const ReportsPage: React.FC = () => {
  const {
    activeMonth,
    currentDevoteeSummary,
    activeDevotee,
    guestName,
    setActiveTab,
    requestSettlement,
    expenses,
    setIsLoginModalOpen,
    setIsNotificationModalOpen,
  } = useApp();

  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState<string>('');
  const [settleDate, setSettleDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [paymentNote, setPaymentNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalculationDetails, setShowCalculationDetails] = useState(true);

  const summary = currentDevoteeSummary;

  const handleOpenSettleModal = () => {
    if (summary) {
      if (summary.settlement_reported > 0) {
        setSettleAmount(summary.settlement_reported.toString());
      } else if (summary.final_balance > 0) {
        setSettleAmount(summary.final_balance.toString());
      } else {
        setSettleAmount('');
      }
      setSettleDate(summary.settlement_date_reported || new Date().toISOString().slice(0, 10));
    }
    setIsSettleModalOpen(true);
  };

  const handleSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(settleAmount);
    if (isNaN(amountNum) || amountNum < 0) return;

    setIsSubmitting(true);
    try {
      await requestSettlement(amountNum, settleDate, paymentNote);
      setIsSettleModalOpen(false);
      // Trigger festive celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#f59e0b', '#10b981', '#3b82f6'],
        });
      } catch (err) {
        // ignore
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // If not logged in as a devotee
  if (!activeDevotee && !guestName) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <div className="w-20 h-20 mx-auto rounded-3xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center p-3 mb-4">
          <img src="/GNHLogo.png" alt="GNH" className="w-full h-full object-contain" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Welcome to GNH Seva App
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-md mx-auto">
          Please log in with your mobile number or continue as guest to view your personalized monthly ledger and meals.
        </p>
        <Button
          onClick={() => setIsLoginModalOpen(true)}
          variant="saffron"
          size="lg"
          className="mt-6"
        >
          <span>Login with Mobile</span>
          <ArrowRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    );
  }

  // Filter devotee-specific expenses
  const devoteeExpenses: Expense[] = expenses.filter(
    (e: Expense) =>
      (activeDevotee ? e.devotee_id === activeDevotee.id : (guestName ? e.guest_name === guestName : true)) &&
      (e.cycle_month === activeMonth || (e.date && e.date.startsWith(activeMonth)) || e.type === 'JANMASHTAMI' || e.type === 'PRABHUPADA_APPEARANCE')
  );

  const regularExpenses: Expense[] = devoteeExpenses.filter((e: Expense) => e.type === 'REGULAR');

  const prabhupadaExpenses: Expense[] = devoteeExpenses.filter((e: Expense) => e.type === 'PRABHUPADA_APPEARANCE');
  const totalPrabhupadaDevotee: number = prabhupadaExpenses
    .filter((e: Expense) => e.status === 'APPROVED' || e.status === 'PENDING')
    .reduce((sum: number, e: Expense) => sum + Number(e.amount), 0);

  const janmashtamiExpenses: Expense[] = devoteeExpenses.filter((e: Expense) => e.type === 'JANMASHTAMI');
  const totalJanmashtamiDevotee: number = janmashtamiExpenses
    .filter((e: Expense) => e.status === 'APPROVED' || e.status === 'PENDING')
    .reduce((sum: number, e: Expense) => sum + Number(e.amount), 0);

  const hasMultipleMembers = Boolean(
    summary && summary.devotee.family_members && summary.devotee.family_members.length > 1
  );

  // Calculation breakdowns
  const bCost = summary ? summary.breakfast_total * PRASADAM_RATES.breakfast : 0;
  const lCost = summary ? summary.lunch_total * PRASADAM_RATES.lunch : 0;
  const dCost = summary ? summary.dinner_total * PRASADAM_RATES.dinner : 0;

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {/* 1. Devotee Notification Banner for Rejected Expenses */}
      {devoteeExpenses.some(e => e.status === 'REJECTED') && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <span className="font-bold">
                Attention: You have {devoteeExpenses.filter(e => e.status === 'REJECTED').length} rejected expense(s).
              </span>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                Check admin notes and reasons in your notification center.
              </p>
            </div>
          </div>
          <Button
            onClick={() => setIsNotificationModalOpen(true)}
            variant="outline"
            size="sm"
            className="text-xs shrink-0 text-rose-600 dark:text-rose-400 border-rose-500/40 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-semibold"
          >
            <Bell className="w-3.5 h-3.5 mr-1" />
            <span>View Notifications</span>
          </Button>
        </div>
      )}

      {/* 2. Main Financial Statement Hero Card */}
      {summary && (
        <Card className="overflow-hidden border-2 border-slate-200 dark:border-slate-800 shadow-md">
          {/* Top Banner */}
          <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="saffron" size="sm">
                    {formatMonthName(activeMonth)}
                  </Badge>
                  {summary.settlement_status === 'SETTLED' ? (
                    <Badge variant="success" size="sm">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Settled</span>
                    </Badge>
                  ) : summary.settlement_status === 'PENDING_VERIFICATION' ? (
                    <Badge variant="warning" size="sm">
                      <Clock className="w-3 h-3" />
                      <span>Payment Verification Pending</span>
                    </Badge>
                  ) : (
                    <Badge variant="outline" size="sm" className="text-slate-300 border-slate-600">
                      Unsettled
                    </Badge>
                  )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold mt-2 tracking-tight">
                  {formatDevoteeName(summary.devotee)}
                </h1>
                {hasMultipleMembers && (
                  <p className="text-xs text-slate-400 mt-1">
                    Family: {formatDevoteeFamilyDisplay(summary.devotee, false)}
                  </p>
                )}
              </div>

              {/* Net Balance Pill */}
              <div className="flex flex-col items-start sm:items-end">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Final Net Balance
                </span>
                <div
                  className={`text-3xl sm:text-4xl font-extrabold tracking-tight mt-0.5 ${summary.final_balance > 0
                    ? 'text-rose-400'
                    : summary.final_balance < 0
                      ? 'text-emerald-400'
                      : 'text-slate-200'
                    }`}
                >
                  {formatRupee(summary.final_balance)}
                  {summary.has_pending_expenses && '*'}
                </div>
                <span className="text-xs font-medium mt-1">
                  {summary.final_balance > 0 ? (
                    <span className="inline-flex items-center gap-1 text-rose-300 bg-rose-950/60 px-2 py-0.5 rounded-md border border-rose-800/60">
                      ⚠️ You owe GNH
                    </span>
                  ) : summary.final_balance < 0 ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/60">
                      ✨ GNH owes You
                    </span>
                  ) : (
                    <span className="text-slate-400">All balances cleared</span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown Grid */}
          <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800">
            {/* 1. Prasadam Cost */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-medium">Prasadam Cost</span>
                <Utensils className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {formatRupee(summary.prasadam_cost)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Meals {formatRupee(summary.meals_cost)} + Community {formatRupee(summary.community_cost)}
              </div>
            </div>

            {/* 2. Approved Expenses */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-medium">Your Expenses</span>
                <Receipt className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {summary.approved_expenses > 0 ? `- ${formatRupee(summary.approved_expenses)}` : '₹0'}
                {summary.has_pending_expenses && '*'}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {regularExpenses.filter((e: Expense) => e.status === 'APPROVED').length} approved
                {summary.has_pending_expenses && `, ${regularExpenses.filter((e: Expense) => e.status === 'PENDING').length} pending approval`}
              </div>
            </div>

            {/* 3. Carried Forward */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-medium">Carried Forward</span>
                <TrendingUp className="w-4 h-4 text-blue-500" />
              </div>
              <div className="text-xl font-bold text-slate-900 dark:text-white">
                {formatRupee(summary.carried_forward)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                From previous months
              </div>
            </div>

            {/* 4. Settlement Reported */}
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/60 shadow-sm">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
                <span className="text-xs font-medium">Payment Done</span>
                <CreditCard className="w-4 h-4 text-purple-500" />
              </div>
              <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                {formatRupee(summary.settlement_reported)}
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                {summary.settlement_status === 'SETTLED' ? 'Verified by Admin' : summary.settlement_status === 'PENDING_VERIFICATION' ? 'Pending approval' : 'Not submitted'}
              </div>
            </div>
          </div>

          {/* Footnote for assumed approved pending expenses */}
          {summary.has_pending_expenses && (
            <div className="px-5 py-2.5 bg-amber-500/10 border-b border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                * Calculations include {formatRupee(summary.pending_expenses)} in pending expenses assumed as approved, subject to final verification by Admin.
              </span>
            </div>
          )}

          {/* Detailed Prasadam Cost Math & Calculation Card */}
          <div className="p-4 sm:p-5 bg-slate-100/60 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setShowCalculationDetails(!showCalculationDetails)}>
              <div className="flex items-center gap-2">
                <Calculator className="w-4 h-4 text-amber-500" />
                <h4 className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200">
                  Prasadam Cost Calculations {summary.friends_summaries && summary.friends_summaries.length > 0 ? '(Family & Friends Itemized)' : '(Meals Cost + Community Cost)'}
                </h4>
              </div>
              <button type="button" className="text-slate-400 hover:text-slate-600">
                {showCalculationDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>

            {showCalculationDetails && (
              <div className="mt-4 space-y-4">
                {/* 1. FAMILY PRASADAM STATEMENT */}
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      Family Calculation ({summary.family_member_count} {summary.family_member_count === 1 ? 'member' : 'members'})
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                      Subtotal: {formatRupee(summary.family_prasadam_cost ?? summary.prasadam_cost)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <div className="text-slate-400">Breakfast (₹40 / plate)</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {summary.breakfast_total} plates × ₹40 = <span className="text-amber-600 dark:text-amber-400">{formatRupee(bCost)}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <div className="text-slate-400">Lunch (₹80 / plate)</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {summary.lunch_total} plates × ₹80 = <span className="text-amber-600 dark:text-amber-400">{formatRupee(lCost)}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <div className="text-slate-400">Dinner (₹40 / plate)</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        {summary.dinner_total} plates × ₹40 = <span className="text-amber-600 dark:text-amber-400">{formatRupee(dCost)}</span>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                      <div className="text-slate-400">Family Community Cost</div>
                      <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                        <span className="text-amber-600 dark:text-amber-400">{formatRupee(summary.family_community_cost ?? summary.community_cost)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/30 text-xs text-slate-700 dark:text-slate-300 font-medium">
                    <strong>Family Total:</strong> Meals ({formatRupee(summary.family_meals_cost ?? summary.meals_cost)}) + Community ({formatRupee(summary.family_community_cost ?? summary.community_cost)}) = <strong className="text-amber-700 dark:text-amber-300 font-bold">{formatRupee(summary.family_prasadam_cost ?? summary.prasadam_cost)}</strong>
                  </div>
                </div>

                {/* 2. FRIENDS PRASADAM STATEMENT(S) */}
                {summary.friends_summaries && summary.friends_summaries.map(friend => (
                  <div key={friend.name} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-800/60 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5" />
                        Friend Calculation: {friend.name} {friend.phone_number ? `(+91 ${friend.phone_number})` : ''}
                      </span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        Subtotal: {formatRupee(friend.total_cost)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                        <div className="text-slate-400">Breakfast (₹40)</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {friend.breakfast_total} plates = <span className="text-emerald-600 dark:text-emerald-400">{formatRupee(friend.breakfast_total * 40)}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                        <div className="text-slate-400">Lunch (₹80)</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {friend.lunch_total} plates = <span className="text-emerald-600 dark:text-emerald-400">{formatRupee(friend.lunch_total * 80)}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                        <div className="text-slate-400">Dinner (₹40)</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          {friend.dinner_total} plates = <span className="text-emerald-600 dark:text-emerald-400">{formatRupee(friend.dinner_total * 40)}</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/50">
                        <div className="text-slate-400">Friend Community Cost</div>
                        <div className="font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                          <span className="text-emerald-600 dark:text-emerald-400">{formatRupee(friend.community_cost)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 text-xs text-slate-700 dark:text-slate-300 font-medium">
                      <strong>Friend Total:</strong> Meals ({formatRupee(friend.meals_cost)}) + Community Cost ({formatRupee(friend.community_cost)}) = <strong className="text-emerald-700 dark:text-emerald-300 font-bold">{formatRupee(friend.total_cost)}</strong> ({friend.total_meals} total meals)
                    </div>
                  </div>
                ))}

                {/* 3. FINAL GRAND TOTAL SUMMARY BANNER */}
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-orange-500/15 border border-amber-500/30 text-xs sm:text-sm text-slate-800 dark:text-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <strong>Prasadam Grand Total: </strong>
                    {summary.friends_summaries && summary.friends_summaries.length > 0 ? (
                      <span>
                        Family ({formatRupee(summary.family_prasadam_cost ?? 0)}) + Friends ({formatRupee(summary.friends_total_cost ?? 0)}) ={' '}
                      </span>
                    ) : null}
                    <strong className="text-amber-700 dark:text-amber-300 text-sm sm:text-base font-extrabold">{formatRupee(summary.prasadam_cost)}</strong>
                    <span className="text-xs text-slate-500 block sm:inline sm:ml-2">
                      ({summary.total_meals} total meals across all participants)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action Bar */}
          <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900">
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Info className="w-4 h-4 text-amber-500 shrink-0" />
              <span>
                <strong>Net Balance Formula:</strong> (Prasadam Cost ₹{summary.prasadam_cost}) - (Expenses ₹{summary.approved_expenses}) + (Carry Fwd ₹{summary.carried_forward}) - (Settled ₹{summary.settlement_reported})
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              {summary.settlement_status === 'PENDING_VERIFICATION' ? (
                <Button
                  onClick={handleOpenSettleModal}
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto text-amber-600 dark:text-amber-400 border-amber-500/40 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                >
                  <Clock className="w-4 h-4 mr-1 text-amber-500" />
                  <span>Update Reported Payment ({formatRupee(summary.settlement_reported)})</span>
                </Button>
              ) : summary.settlement_status === 'SETTLED' ? (
                <Button
                  onClick={handleOpenSettleModal}
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto text-emerald-600 dark:text-emerald-400 border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-500" />
                  <span>Settled ({formatRupee(summary.settlement_reported)}) • Update</span>
                </Button>
              ) : summary.final_balance > 0 ? (
                <Button
                  onClick={handleOpenSettleModal}
                  variant="saffron"
                  size="md"
                  className="w-full sm:w-auto"
                >
                  <IndianRupee className="w-4 h-4 mr-1" />
                  <span>Settle Balance ({formatRupee(summary.final_balance)})</span>
                </Button>
              ) : (
                <Button
                  onClick={handleOpenSettleModal}
                  variant="outline"
                  size="md"
                  className="w-full sm:w-auto"
                >
                  <IndianRupee className="w-4 h-4 mr-1" />
                  <span>Report Payment</span>
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* 3. Srila Prabhupada Appearance Day Dedicated Festival Balance Card */}
      <Card className="p-5 sm:p-6 border border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-transparent to-orange-500/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Srila Prabhupada Appearance Day Expenses
                </h3>
                <Badge variant="saffron">Active Festival</Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Vyasa-Puja seva contributions and expenses (all-time, isolated from monthly meal billing)
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 font-medium">Your Appearance Day Seva</span>
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">
              {formatRupee(totalPrabhupadaDevotee)}
            </div>
          </div>
        </div>

        {prabhupadaExpenses.length > 0 ? (
          <div className="space-y-2 mt-4">
            {prabhupadaExpenses.map((exp: Expense) => (
              <div
                key={exp.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {exp.title}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    By {exp.payer_name} • Expense: {formatExpenseDate(exp.date || exp.created_at)} • Submitted: {formatSubmissionDateTime(exp.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={exp.status === 'APPROVED' ? 'success' : exp.status === 'PENDING' ? 'warning' : 'danger'}>
                    {exp.status === 'APPROVED' ? 'Approved' : exp.status === 'PENDING' ? 'Pending Approval' : 'Rejected'}
                  </Badge>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {formatRupee(exp.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
            No Prabhupada Appearance Day expenses logged yet for this devotee.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => setActiveTab('appearance_day')}
            variant="saffron"
            size="sm"
            className="text-xs"
          >
            <span>Open Appearance Day Ledger</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </Card>

      {/* 4. Krishna Janmashtami Completed Festival Balance Card */}
      <Card className="p-5 sm:p-6 border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              <Sparkles className="w-6 h-6 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  Krishna Janmashtami Expenses
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  Completed & Archived
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Historical Janmashtami 2026 festival contributions and seva expenses
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-xs text-slate-400 font-medium">Your Janmashtami Total</span>
            <div className="text-xl font-bold text-slate-800 dark:text-slate-200">
              {formatRupee(totalJanmashtamiDevotee)}
            </div>
          </div>
        </div>

        {janmashtamiExpenses.length > 0 ? (
          <div className="space-y-2 mt-4">
            {janmashtamiExpenses.map((exp: Expense) => (
              <div
                key={exp.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {exp.title}
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    By {exp.payer_name} • Expense: {formatExpenseDate(exp.date || exp.created_at)} • Submitted: {formatSubmissionDateTime(exp.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant={exp.status === 'APPROVED' ? 'success' : exp.status === 'PENDING' ? 'warning' : 'danger'}>
                    {exp.status === 'APPROVED' ? 'Approved' : exp.status === 'PENDING' ? 'Pending Approval' : 'Rejected'}
                  </Badge>
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">
                    {formatRupee(exp.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
            No Janmashtami festival expenses logged for this devotee.
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            onClick={() => setActiveTab('appearance_day')}
            variant="outline"
            size="sm"
            className="text-xs"
          >
            <span>View All Festival Records</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      </Card>

      {/* 4. Settle Up Modal */}
      <Modal
        isOpen={isSettleModalOpen}
        onClose={() => setIsSettleModalOpen(false)}
        title="Report Balance Settlement"
        description="Notify the admin that you have paid/transferred the pending amount."
      >
        <form onSubmit={handleSettleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Amount Given / Transferred (₹)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={settleAmount}
              onChange={e => setSettleAmount(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-semibold text-lg focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Payment Date
            </label>
            <input
              type="date"
              required
              value={settleDate}
              onChange={e => setSettleDate(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Payment Reference / Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. UPI Ref #123456 or Paid in Cash to Admin"
              value={paymentNote}
              onChange={e => setPaymentNote(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div className="pt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsSettleModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="saffron"
              isLoading={isSubmitting}
              className="flex-1"
            >
              Submit for Verification
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
