import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Utensils,
  Plus,
  Minus,
  Lock,
  Receipt,
  Eye,
  Users,
  UserCheck,
  Save,
  Bell,
  AlertCircle,
  Download,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { MultiAttachmentUpload } from '../components/common/MultiAttachmentUpload';
import { ReceiptViewerModal } from '../components/common/ReceiptViewerModal';
import { SortableHeader } from '../components/common/SortableHeader';
import { useTableSort } from '../hooks/useTableSort';
import { exportTableToExcel } from '../utils/exportHelpers';
import { parseReceiptUrls, formatReceiptUrls } from '../utils/receiptHelpers';
import { compressImage } from '../utils/imageCompressor';
import { Expense, PrasadamCount } from '../types';
import {
  formatRupee,
  isCutoffPassed,
  getCutoffFormattedDate,
  formatMonthName,
  getDefaultExpenseDate,
  PRASADAM_RATES,
  calculateMealsCost,
  formatExpenseDate,
  formatSubmissionDateTime,
} from '../utils/calculations';
import {
  getFamilyMemberNames,
  getPrimaryFamilyMemberName,
  getPureFamilyMembers,
  getFriendMembers,
} from '../utils/devoteeHelpers';
import { storageService } from '../services/storageService';

export const PrasadamPage: React.FC = () => {
  const {
    activeMonth,
    activeDevotee,
    loggedInMemberName,
    guestName,
    prasadamCounts,
    updateMonthlyMealCounts,
    updateFriendMonthlyCounts,
    submitExpense,
    expenses,
    communityCostPerMember,
    showToast,
    setIsLoginModalOpen,
    setIsNotificationModalOpen,
  } = useApp();

  const isCutoff = isCutoffPassed(activeMonth);

  // Family and Friend separation
  const friendMembers = useMemo(() => (activeDevotee ? getFriendMembers(activeDevotee) : []), [activeDevotee]);
  const pureFamily = useMemo(() => (activeDevotee ? getPureFamilyMembers(activeDevotee) : []), [activeDevotee]);
  const familyMembers = useMemo(() => (activeDevotee ? getFamilyMemberNames(activeDevotee) : []), [activeDevotee]);

  // Active participant tab: 'family' or 'friend:Name'
  const [activeParticipantTab, setActiveParticipantTab] = useState<string>('family');

  // Compute existing monthly totals for family
  const familyTotals = useMemo(() => {
    if (!activeDevotee) return { b: 0, l: 0, d: 0 };
    const devoteeCounts = prasadamCounts.filter(
      (c: PrasadamCount) => c.devotee_id === activeDevotee.id && c.date.startsWith(activeMonth)
    );
    const b = devoteeCounts.reduce((sum, c) => sum + (c.breakfast_count || 0), 0);
    const l = devoteeCounts.reduce((sum, c) => sum + (c.lunch_count || 0), 0);
    const d = devoteeCounts.reduce((sum, c) => sum + (c.dinner_count || 0), 0);
    return { b, l, d };
  }, [prasadamCounts, activeDevotee, activeMonth]);

  // Selected friend object (if friend tab is active)
  const selectedFriend = useMemo(() => {
    if (!activeParticipantTab.startsWith('friend:')) return null;
    const friendName = activeParticipantTab.slice(7);
    return friendMembers.find(f => f.name.toLowerCase().trim() === friendName.toLowerCase().trim()) || null;
  }, [activeParticipantTab, friendMembers]);

  // Existing totals for selected friend
  const friendTotals = useMemo(() => {
    if (!selectedFriend) return { b: 0, l: 0, d: 0 };
    const mCounts = selectedFriend.monthly_counts?.[activeMonth];
    return {
      b: mCounts?.breakfast || 0,
      l: mCounts?.lunch || 0,
      d: mCounts?.dinner || 0,
    };
  }, [selectedFriend, activeMonth]);

  // Interactive editable state for monthly counts
  const [bCount, setBCount] = useState<number>(0);
  const [lCount, setLCount] = useState<number>(0);
  const [dCount, setDCount] = useState<number>(0);
  const [isManualSaving, setIsManualSaving] = useState(false);

  // Sync state when activeDevotee, activeMonth, or activeParticipantTab changes
  useEffect(() => {
    if (activeParticipantTab.startsWith('friend:')) {
      setBCount(friendTotals.b);
      setLCount(friendTotals.l);
      setDCount(friendTotals.d);
    } else {
      setBCount(familyTotals.b);
      setLCount(familyTotals.l);
      setDCount(familyTotals.d);
    }
  }, [
    activeParticipantTab,
    familyTotals.b,
    familyTotals.l,
    familyTotals.d,
    friendTotals.b,
    friendTotals.l,
    friendTotals.d,
    activeMonth,
    activeDevotee?.id,
  ]);

  // Scroll to regular expenses section if hash matches or if navigated from another page
  useEffect(() => {
    if (window.location.hash === '#regular-expenses-section') {
      const timer = setTimeout(() => {
        const el = document.getElementById('regular-expenses-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  // Direct manual save action
  const handleSaveCounts = async () => {
    if (!activeDevotee) return;
    setIsManualSaving(true);
    try {
      if (activeParticipantTab.startsWith('friend:') && selectedFriend) {
        await updateFriendMonthlyCounts(
          activeDevotee.id,
          selectedFriend.name,
          activeMonth,
          bCount,
          lCount,
          dCount,
          { silent: false }
        );
      } else {
        await updateMonthlyMealCounts(
          activeDevotee.id,
          activeMonth,
          bCount,
          lCount,
          dCount,
          { silent: false }
        );
      }
    } catch (err) {
      console.error('Error saving counts:', err);
      showToast({
        type: 'error',
        title: 'Failed to Save',
        message: 'Could not save prasadam counts. Please try again.',
      });
    } finally {
      setIsManualSaving(false);
    }
  };

  // Handle direct value changes
  const handleUpdateB = (val: number) => {
    const clamped = Math.max(0, val);
    setBCount(clamped);
  };

  const handleUpdateL = (val: number) => {
    const clamped = Math.max(0, val);
    setLCount(clamped);
  };

  const handleUpdateD = (val: number) => {
    const clamped = Math.max(0, val);
    setDCount(clamped);
  };

  // Live calculated costs for current section
  const bCost = bCount * PRASADAM_RATES.breakfast;
  const lCost = lCount * PRASADAM_RATES.lunch;
  const dCost = dCount * PRASADAM_RATES.dinner;
  const currentTotalMeals = bCount + lCount + dCount;
  const currentMealsCost = bCost + lCost + dCost;

  const defaultGroupCost = typeof activeDevotee?.community_cost === 'number' ? activeDevotee.community_cost : communityCostPerMember;

  let currentCommunityCost = 0;
  if (selectedFriend) {
    currentCommunityCost = typeof selectedFriend.community_cost === 'number' ? selectedFriend.community_cost : defaultGroupCost;
  } else {
    if (pureFamily.length > 0) {
      currentCommunityCost = pureFamily.reduce(
        (sum, m) => sum + (typeof m.community_cost === 'number' ? m.community_cost : defaultGroupCost),
        0
      );
    } else {
      currentCommunityCost = defaultGroupCost;
    }
  }

  const currentTotalPrasadamCost = currentMealsCost + currentCommunityCost;

  // Live Grand Total Across Family & All Friends
  const familyLiveMealsCost = selectedFriend
    ? calculateMealsCost(familyTotals.b, familyTotals.l, familyTotals.d)
    : currentMealsCost;
  const familyLiveCommunityCost = pureFamily.length > 0
    ? pureFamily.reduce((sum, m) => sum + (typeof m.community_cost === 'number' ? m.community_cost : defaultGroupCost), 0)
    : defaultGroupCost;
  const familyLiveTotal = familyLiveMealsCost + familyLiveCommunityCost;

  let friendsLiveTotal = 0;
  friendMembers.forEach(f => {
    if (selectedFriend && f.name.toLowerCase().trim() === selectedFriend.name.toLowerCase().trim()) {
      friendsLiveTotal += currentTotalPrasadamCost;
    } else {
      const counts = f.monthly_counts?.[activeMonth] || { breakfast: 0, lunch: 0, dinner: 0 };
      const mCost = calculateMealsCost(counts.breakfast || 0, counts.lunch || 0, counts.dinner || 0);
      const cCost = typeof f.community_cost === 'number' ? f.community_cost : defaultGroupCost;
      friendsLiveTotal += (mCost + cCost);
    }
  });

  const grandTotalCost = familyLiveTotal + friendsLiveTotal;

  // Resolve default payer name helper (defaults single family member or logged in member)
  const getDefaultPayer = useCallback(() => {
    if (loggedInMemberName) return loggedInMemberName;
    if (activeDevotee) {
      const members = getFamilyMemberNames(activeDevotee);
      if (members.length === 1) return members[0];
    }
    if (guestName) return guestName;
    return '';
  }, [loggedInMemberName, activeDevotee, guestName]);

  // Expense form state
  const [expenseDate, setExpenseDate] = useState<string>(() => getDefaultExpenseDate(activeMonth));
  const [payerName, setPayerName] = useState<string>(() => getDefaultPayer());
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseComments, setExpenseComments] = useState<string>('');
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [isUploadingExpense, setIsUploadingExpense] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  // Sync payer name & expense date when context changes
  useEffect(() => {
    setPayerName(getDefaultPayer());
  }, [getDefaultPayer]);

  useEffect(() => {
    setExpenseDate(getDefaultExpenseDate(activeMonth));
  }, [activeMonth]);

  // Handle Expense Form Submit
  const handleExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseDate.trim()) {
      showToast({
        type: 'warning',
        title: 'Expense Date Required',
        message: 'Please select the date of this expense.',
      });
      return;
    }

    const amountNum = parseFloat(expenseAmount);
    if (isNaN(amountNum) || !expenseTitle.trim()) return;

    const defaultPayer = getDefaultPayer() || getPrimaryFamilyMemberName(activeDevotee) || guestName || 'Devotee';
    const resolvedPayer = payerName || defaultPayer;

    setIsUploadingExpense(true);
    try {
      let billUrl: string | null = null;

      if (receiptFiles.length > 0) {
        const uploadedUrls: string[] = [];
        for (const file of receiptFiles) {
          let toUpload = file;
          if (file.type.startsWith('image/')) {
            try {
              toUpload = await compressImage(file, { maxSizeMB: 0.19 });
            } catch (err) {
              console.warn('Compression error, using original', err);
            }
          }
          const url = await storageService.uploadReceipt(toUpload);
          uploadedUrls.push(url);
        }
        billUrl = formatReceiptUrls(uploadedUrls);
      }

      await submitExpense({
        devotee_id: activeDevotee?.id || null,
        guest_name: activeDevotee ? null : guestName || 'Guest',
        date: expenseDate,
        type: 'REGULAR',
        payer_name: resolvedPayer,
        title: expenseTitle.trim(),
        amount: amountNum,
        comments: expenseComments.trim() || null,
        bill_url: billUrl,
        status: 'PENDING',
        cycle_month: expenseDate ? expenseDate.slice(0, 7) : activeMonth,
      });

      // Reset form
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseComments('');
      setReceiptFiles([]);
      setExpenseDate(getDefaultExpenseDate(activeMonth));
      setPayerName(getDefaultPayer());
    } finally {
      setIsUploadingExpense(false);
    }
  };

  // Filter regular expenses for this devotee/guest
  const regularExpenses: Expense[] = expenses.filter(
    (e: Expense) =>
      (activeDevotee ? e.devotee_id === activeDevotee.id : (guestName ? e.guest_name === guestName : true)) &&
      (e.cycle_month === activeMonth || (e.date && e.date.startsWith(activeMonth))) &&
      e.type === 'REGULAR'
  );

  const {
    sortedData: sortedRegularExpenses,
    sortConfig: expenseSortConfig,
    requestSort: requestExpenseSort,
  } = useTableSort<Expense>(regularExpenses, {
    initialConfig: { key: 'date', direction: 'desc' },
    getSortValue: (item, key) => {
      if (key === 'date') return item.date || item.created_at;
      if (key === 'created_at') return item.created_at;
      if (key === 'title') return item.title;
      if (key === 'payer_name') return item.payer_name;
      if (key === 'amount') return Number(item.amount);
      if (key === 'status') return item.status;
      return (item as any)[key];
    },
  });

  const handleExportExpenses = () => {
    if (sortedRegularExpenses.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Expenses to Export',
        message: 'There are no submitted expenses to export for this month.',
      });
      return;
    }

    const exportData = sortedRegularExpenses.map(exp => ({
      'Expense Date': formatExpenseDate(exp.date || exp.created_at),
      'Submitted At': formatSubmissionDateTime(exp.created_at),
      'Item Title': exp.title,
      'Comments / Notes': exp.comments || '-',
      'Payer': exp.payer_name,
      'Amount (₹)': Number(exp.amount),
      'Receipt Attached': exp.bill_url ? 'YES' : 'NO',
      'Status': exp.status,
      'Rejection Reason': exp.rejection_reason || '-',
    }));

    exportTableToExcel(
      exportData,
      `My_Regular_Expenses_${activeMonth}_${formatMonthName(activeMonth).replace(/\s+/g, '_')}`,
      'Regular Expenses'
    );

    showToast({
      type: 'success',
      title: 'Export Successful',
      message: 'Expenses table exported in current sorted order.',
    });
  };

  // If not logged in
  if (!activeDevotee && !guestName) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 text-center">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Devotee Identification Required
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
          Please log in with your mobile number to view and manage monthly prasadam counts.
        </p>
        <Button onClick={() => setIsLoginModalOpen(true)} variant="saffron" className="mt-6">
          Login / Identify
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-24">
      {/* Devotee Notification Banner for Rejected Expenses */}
      {regularExpenses.some(e => e.status === 'REJECTED') && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 text-xs text-rose-800 dark:text-rose-200">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0" />
            <div>
              <span className="font-bold">
                Attention: You have {regularExpenses.filter(e => e.status === 'REJECTED').length} rejected regular expense(s).
              </span>
              <p className="text-slate-600 dark:text-slate-400 text-[11px] mt-0.5">
                Review the admin rejection notes below or open the notification center.
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

      {/* 1. DIRECT EDITABLE MONTHLY PRASADAM MEAL & COST SUMMARY CARD */}
      <Card className="overflow-hidden border-2 border-amber-500/30 bg-gradient-to-br from-amber-500/[0.04] via-white dark:via-slate-900 to-orange-500/[0.04] shadow-md">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-700 dark:text-amber-400">
                <Utensils className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                    {formatMonthName(activeMonth)} Prasadam Counts
                  </h2>
                  <Badge variant="saffron" size="sm">Direct Input</Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Enter monthly Breakfast, Lunch, and Dinner counts, then click Save below.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {isCutoff ? (
                <Badge variant="danger" size="sm">
                  <Lock className="w-3 h-3" />
                  <span>Closed: {getCutoffFormattedDate(activeMonth)}</span>
                </Badge>
              ) : (
                <Badge variant="success" size="sm">
                  <span>Entry Open</span>
                </Badge>
              )}
            </div>
          </div>

          {/* Participant Tab Switcher (Family vs Friend) */}
          {friendMembers.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <button
                type="button"
                onClick={() => setActiveParticipantTab('family')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                  activeParticipantTab === 'family'
                    ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-500/30'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Family Counts ({pureFamily.length || 1} {pureFamily.length === 1 ? 'member' : 'members'})</span>
              </button>

              {friendMembers.map(friend => {
                const tabKey = `friend:${friend.name}`;
                const isCurrent = activeParticipantTab === tabKey;
                return (
                  <button
                    key={friend.name}
                    type="button"
                    onClick={() => setActiveParticipantTab(tabKey)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs ${
                      isCurrent
                        ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-500/30'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Friend: {friend.name}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Participant Banner */}
          {selectedFriend && (
            <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 dark:bg-emerald-950/30 border border-emerald-500/30 text-xs flex items-center justify-between text-emerald-800 dark:text-emerald-300">
              <span className="font-semibold flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" />
                Filling separate meal count for Friend: <strong>{selectedFriend.name}</strong>
              </span>
              <span className="font-mono text-[11px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded-md border border-emerald-500/20">
                Community Cost: ₹{currentCommunityCost}
              </span>
            </div>
          )}

          {/* 3 Compact Interactive Slot Input Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3.5">
            {/* 1. Breakfast Slot */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-200 text-xs font-bold mb-2">
                  <span>Total Breakfasts</span>
                  <span className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                    ₹40 / plate
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={bCount <= 0}
                    onClick={() => handleUpdateB(bCount - 1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={bCount === 0 ? '' : bCount}
                      placeholder="0"
                      onChange={e => handleUpdateB(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-2xl font-extrabold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">plates</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateB(bCount + 1)}
                    className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center hover:bg-amber-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Breakfast Cost:</span>
                <span className="font-bold text-xs text-amber-600 dark:text-amber-400 font-mono">
                  {formatRupee(bCost)}
                </span>
              </div>
            </div>

            {/* 2. Lunch Slot */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-200 text-xs font-bold mb-2">
                  <span>Total Lunches</span>
                  <span className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                    ₹80 / plate
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={lCount <= 0}
                    onClick={() => handleUpdateL(lCount - 1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={lCount === 0 ? '' : lCount}
                      placeholder="0"
                      onChange={e => handleUpdateL(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-2xl font-extrabold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">plates</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateL(lCount + 1)}
                    className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center hover:bg-amber-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Lunch Cost:</span>
                <span className="font-bold text-xs text-amber-600 dark:text-amber-400 font-mono">
                  {formatRupee(lCost)}
                </span>
              </div>
            </div>

            {/* 3. Dinner Slot */}
            <div className="p-3 sm:p-3.5 rounded-xl bg-white dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-slate-700 dark:text-slate-200 text-xs font-bold mb-2">
                  <span>Total Dinners</span>
                  <span className="text-[10px] font-mono font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-1.5 py-0.5 rounded">
                    ₹40 / plate
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={dCount <= 0}
                    onClick={() => handleUpdateD(dCount - 1)}
                    className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-30 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>

                  <div className="flex-1 text-center">
                    <input
                      type="number"
                      min="0"
                      max="1000"
                      value={dCount === 0 ? '' : dCount}
                      placeholder="0"
                      onChange={e => handleUpdateD(parseInt(e.target.value) || 0)}
                      className="w-full text-center text-2xl font-extrabold bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg py-1 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <span className="text-[10px] text-slate-400 block mt-0.5">plates</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateD(dCount + 1)}
                    className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 font-bold flex items-center justify-center hover:bg-amber-400 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="text-slate-500 dark:text-slate-400 font-medium">Dinner Cost:</span>
                <span className="font-bold text-xs text-amber-600 dark:text-amber-400 font-mono">
                  {formatRupee(dCost)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Grand Total Bar with Manual Save Button & Real-time status */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-orange-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-wider font-bold text-slate-500 dark:text-slate-400">
                {selectedFriend ? `Friend: ${selectedFriend.name}` : 'Family Prasadam'}
              </span>
              <span className="text-xs font-mono font-bold bg-amber-500/20 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-md">
                {currentTotalMeals} meals
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-0.5">
              {formatRupee(currentTotalPrasadamCost)}
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-300 mt-1 flex items-center gap-1.5 flex-wrap">
              <span>Meals {formatRupee(currentMealsCost)}</span>
              <span>+</span>
              <span>Community Cost {formatRupee(currentCommunityCost)}</span>
              <span>=</span>
              <strong className="text-amber-700 dark:text-amber-300 font-bold">{formatRupee(currentTotalPrasadamCost)}</strong>
            </div>
          </div>

          <div className="flex flex-col sm:items-end gap-2.5 border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-200 dark:border-slate-700">
            {friendMembers.length > 0 && (
              <div className="text-right">
                <div className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Grand Total (Family + All Friends)
                </div>
                <div className="text-xl font-extrabold text-amber-600 dark:text-amber-400 font-mono">
                  {formatRupee(grandTotalCost)}
                </div>
              </div>
            )}

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="saffron"
                size="md"
                isLoading={isManualSaving}
                onClick={handleSaveCounts}
                className="font-bold shadow-md hover:shadow-lg transition-all"
              >
                <Save className="w-4 h-4 mr-1.5" />
                <span>Save {selectedFriend ? `${selectedFriend.name}'s Counts` : 'Prasadam Counts'}</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. REGULAR EXPENSE SUBMISSION FORM */}
      <Card id="regular-expenses-section" className="p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-md scroll-mt-20">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-2xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Log Regular Seva Expense
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Submit grocery, vegetable, or kitchen purchases to offset your monthly prasadam bill (Max 10 MB per bill).
            </p>
          </div>
        </div>

        <form onSubmit={handleExpenseSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Expense Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Expense Date *
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none font-medium"
              />
            </div>

            {/* Who made expense */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Who Made the Expense?
              </label>
              {activeDevotee ? (
                <select
                  value={payerName || (familyMembers.length === 1 ? familyMembers[0] : '')}
                  onChange={e => setPayerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  {familyMembers.length > 1 && <option value="">Select Member</option>}
                  {familyMembers.map((member: string) => (
                    <option key={member} value={member}>
                      {member}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={payerName}
                  placeholder={guestName || 'Your Name'}
                  onChange={e => setPayerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none"
                />
              )}
            </div>

            {/* Title / Item with Category Presets */}
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Expense Title / Category *
                </label>
              </div>
              <input
                type="text"
                required
                placeholder="e.g. Groceries and Sabji"
                value={expenseTitle}
                onChange={e => setExpenseTitle(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none font-medium"
              />
              {/* Quick-fill category buttons */}
              <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                {[
                  'Groceries and Sabji',
                  'Diety Dept Expenses',
                  'Maintenance Expenses',
                  'Prasdam Transport',
                  'Gas Cylinder',
                ].map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setExpenseTitle(cat)}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-md transition-all ${
                      expenseTitle === cat
                        ? 'bg-amber-500 text-slate-950 font-bold ring-1 ring-amber-500 shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    + {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Cost Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Cost Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 1450"
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Comments */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
                Comments / Description (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Add purchase details, quantity, or shop name..."
                value={expenseComments}
                onChange={e => setExpenseComments(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-amber-500 outline-none resize-none"
              />
            </div>

            {/* Bill Upload - Up to 5 Attachments */}
            <div>
              <MultiAttachmentUpload
                files={receiptFiles}
                onFilesChange={setReceiptFiles}
                maxFiles={5}
                label="Bill / Receipt Attachments (Optional, up to 5)"
                sublabel="Attach up to 5 photos/PDFs"
                onError={(msg) => showToast({ type: 'warning', title: 'Attachment Notice', message: msg })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="saffron"
              size="md"
              isLoading={isUploadingExpense}
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>Submit Regular Expense</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* 3. SUBMITTED REGULAR EXPENSES LIST */}
      <Card className="p-5 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Submitted Expenses ({regularExpenses.length})
              </h3>
              {regularExpenses.length > 0 && (
                <Button
                  type="button"
                  onClick={handleExportExpenses}
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 py-1 px-2.5 h-auto"
                  title="Export currently sorted expenses to Excel"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Excel</span>
                </Button>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Kitchen and grocery purchases offsetting your monthly prasadam bill.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold block">
              Total Offset: {formatRupee(
                regularExpenses
                  .filter((e: Expense) => e.status === 'APPROVED' || e.status === 'PENDING')
                  .reduce((sum: number, e: Expense) => sum + Number(e.amount), 0)
              )}
              {regularExpenses.some((e: Expense) => e.status === 'PENDING') && '*'}
            </span>
            {regularExpenses.some((e: Expense) => e.status === 'PENDING') && (
              <span className="text-[10px] text-slate-400">
                * Includes pending expenses assumed as approved
              </span>
            )}
          </div>
        </div>

        {regularExpenses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px]">
                  <SortableHeader
                    label="Expense Date"
                    sortKey="date"
                    currentSortKey={expenseSortConfig?.key}
                    currentDirection={expenseSortConfig?.direction}
                    onSort={requestExpenseSort}
                    className="py-2.5 px-3"
                  />
                  <SortableHeader
                    label="Submitted At"
                    sortKey="created_at"
                    currentSortKey={expenseSortConfig?.key}
                    currentDirection={expenseSortConfig?.direction}
                    onSort={requestExpenseSort}
                    className="py-2.5 px-3"
                  />
                  <SortableHeader
                    label="Item Title"
                    sortKey="title"
                    currentSortKey={expenseSortConfig?.key}
                    currentDirection={expenseSortConfig?.direction}
                    onSort={requestExpenseSort}
                    className="py-2.5 px-3"
                  />
                  <SortableHeader
                    label="Payer"
                    sortKey="payer_name"
                    currentSortKey={expenseSortConfig?.key}
                    currentDirection={expenseSortConfig?.direction}
                    onSort={requestExpenseSort}
                    className="py-2.5 px-3"
                  />
                  <SortableHeader
                    label="Amount"
                    sortKey="amount"
                    currentSortKey={expenseSortConfig?.key}
                    currentDirection={expenseSortConfig?.direction}
                    onSort={requestExpenseSort}
                    align="right"
                    className="py-2.5 px-3"
                  />
                  <SortableHeader
                    label="Receipt"
                    align="center"
                    className="py-2.5 px-3"
                  />
                  <SortableHeader
                    label="Status"
                    sortKey="status"
                    currentSortKey={expenseSortConfig?.key}
                    currentDirection={expenseSortConfig?.direction}
                    onSort={requestExpenseSort}
                    align="center"
                    className="py-2.5 px-3"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {sortedRegularExpenses.map((exp: Expense) => (
                  <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-mono font-medium">
                      {formatExpenseDate(exp.date || exp.created_at)}
                    </td>
                    <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                      {formatSubmissionDateTime(exp.created_at)}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 dark:text-white">
                        {exp.title}
                      </div>
                      {exp.comments && (
                        <div className="text-[11px] text-slate-400">{exp.comments}</div>
                      )}
                      {exp.rejection_reason && (
                        <div className="text-[10px] text-rose-500 font-semibold">
                          Reason: {exp.rejection_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                      {exp.payer_name}
                    </td>
                    <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                      {formatRupee(exp.amount)}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {exp.bill_url ? (
                        <button
                          onClick={() => setViewingReceiptUrl(exp.bill_url!)}
                          className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline text-xs font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View ({parseReceiptUrls(exp.bill_url).length})</span>
                        </button>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-center">
                      {exp.status === 'APPROVED' ? (
                        <Badge variant="success" size="sm">
                          Approved
                        </Badge>
                      ) : exp.status === 'PENDING' ? (
                        <Badge variant="warning" size="sm">
                          Pending Approval
                        </Badge>
                      ) : (
                        <Badge variant="danger" size="sm" title={exp.rejection_reason || 'Rejected'}>
                          Rejected
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {regularExpenses.some((e: Expense) => e.status === 'PENDING') && (
              <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 italic">
                * Pending entries are assumed approved in calculations subject to final Admin verification.
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-slate-400">
            No regular expenses logged for this month.
          </div>
        )}
      </Card>

      {/* Multi-Receipt Viewer Modal */}
      <ReceiptViewerModal
        isOpen={Boolean(viewingReceiptUrl)}
        onClose={() => setViewingReceiptUrl(null)}
        billUrl={viewingReceiptUrl}
        title="Regular Expense Receipts"
      />
    </div>
  );
};
