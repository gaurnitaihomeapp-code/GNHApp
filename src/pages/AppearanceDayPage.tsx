import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Eye,
  Crown,
  Sparkles,
  ExternalLink,
  ArrowRight,
  Wallet,
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
import {
  formatRupee,
  getDefaultExpenseDate,
  formatExpenseDate,
  formatSubmissionDateTime,
} from '../utils/calculations';
import { getFamilyMemberNames, getPrimaryFamilyMemberName } from '../utils/devoteeHelpers';
import { compressImage } from '../utils/imageCompressor';
import { storageService } from '../services/storageService';
import { parseReceiptUrls, formatReceiptUrls } from '../utils/receiptHelpers';
import { Expense } from '../types';

export const AppearanceDayPage: React.FC = () => {
  const {
    activeMonth,
    activeDevotee,
    loggedInMemberName,
    guestName,
    expenses,
    submitExpense,
    showToast,
    setActiveTab,
  } = useApp();

  const handleNavigateToRegularExpenses = () => {
    setActiveTab('prasadam');
    window.location.hash = 'regular-expenses-section';
    setTimeout(() => {
      const el = document.getElementById('regular-expenses-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 150);
  };

  // Resolve default payer name helper
  const getDefaultPayer = useCallback(() => {
    if (loggedInMemberName) return loggedInMemberName;
    if (activeDevotee) {
      const members = getFamilyMemberNames(activeDevotee);
      if (members.length === 1) return members[0];
    }
    if (guestName) return guestName;
    return '';
  }, [loggedInMemberName, activeDevotee, guestName]);

  // Form states for Prabhupada Appearance Day
  const [expenseDate, setExpenseDate] = useState<string>(() => getDefaultExpenseDate(activeMonth));
  const [payerName, setPayerName] = useState<string>(() => getDefaultPayer());
  const [expenseTitle, setExpenseTitle] = useState<string>('');
  const [expenseAmount, setExpenseAmount] = useState<string>('');
  const [expenseComments, setExpenseComments] = useState<string>('');
  const [receiptFiles, setReceiptFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  // Active ledger view tab: 'appearance_day' or 'janmashtami'
  const [activeLedgerView, setActiveLedgerView] = useState<'appearance_day' | 'janmashtami'>('appearance_day');

  // Sync payer name & expense date with default whenever context changes
  useEffect(() => {
    setPayerName(getDefaultPayer());
  }, [getDefaultPayer]);

  useEffect(() => {
    setExpenseDate(getDefaultExpenseDate(activeMonth));
  }, [activeMonth]);

  // Filter Prabhupada Appearance Day expenses
  const allPrabhupadaExpenses = useMemo(() => {
    return expenses.filter((e: Expense) => e.type === 'PRABHUPADA_APPEARANCE');
  }, [expenses]);

  const myPrabhupadaExpenses = useMemo(() => {
    return allPrabhupadaExpenses.filter((e: Expense) =>
      activeDevotee
        ? e.devotee_id === activeDevotee.id
        : (guestName ? e.guest_name === guestName : false)
    );
  }, [allPrabhupadaExpenses, activeDevotee, guestName]);

  const totalPrabhupadaFund = useMemo(() => {
    return allPrabhupadaExpenses
      .filter(e => e.status === 'APPROVED' || e.status === 'PENDING')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [allPrabhupadaExpenses]);

  const myPrabhupadaTotal = useMemo(() => {
    return myPrabhupadaExpenses
      .filter(e => e.status === 'APPROVED' || e.status === 'PENDING')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [myPrabhupadaExpenses]);

  const myPrabhupadaPendingTotal = useMemo(() => {
    return myPrabhupadaExpenses
      .filter(e => e.status === 'PENDING')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [myPrabhupadaExpenses]);

  // Filter Janmashtami expenses (completed festival)
  const allJanmashtamiExpenses = useMemo(() => {
    return expenses.filter((e: Expense) => e.type === 'JANMASHTAMI');
  }, [expenses]);

  const myJanmashtamiExpenses = useMemo(() => {
    return allJanmashtamiExpenses.filter((e: Expense) =>
      activeDevotee
        ? e.devotee_id === activeDevotee.id
        : (guestName ? e.guest_name === guestName : false)
    );
  }, [allJanmashtamiExpenses, activeDevotee, guestName]);

  const myJanmashtamiTotal = useMemo(() => {
    return myJanmashtamiExpenses
      .filter(e => e.status === 'APPROVED' || e.status === 'PENDING')
      .reduce((sum, e) => sum + Number(e.amount), 0);
  }, [myJanmashtamiExpenses]);

  // Sort tables
  const {
    sortedData: sortedMyPrabhupadaExpenses,
    sortConfig: prabhupadaSortConfig,
    requestSort: requestPrabhupadaSort,
  } = useTableSort<Expense>(myPrabhupadaExpenses, {
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

  const {
    sortedData: sortedMyJanmashtamiExpenses,
    sortConfig: janmashtamiSortConfig,
    requestSort: requestJanmashtamiSort,
  } = useTableSort<Expense>(myJanmashtamiExpenses, {
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

  // Export handlers
  const handleExportPrabhupadaExpenses = () => {
    if (sortedMyPrabhupadaExpenses.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Expenses to Export',
        message: 'There are no submitted Prabhupada Appearance Day expenses to export.',
      });
      return;
    }

    const exportData = sortedMyPrabhupadaExpenses.map(exp => ({
      'Expense Date': formatExpenseDate(exp.date || exp.created_at),
      'Submitted At': formatSubmissionDateTime(exp.created_at),
      'Item / Seva': exp.title,
      'Comments / Notes': exp.comments || '-',
      'Payer': exp.payer_name,
      'Amount (₹)': Number(exp.amount),
      'Receipts Attached': parseReceiptUrls(exp.bill_url).length,
      'Status': exp.status,
      'Rejection Reason': exp.rejection_reason || '-',
    }));

    exportTableToExcel(
      exportData,
      `My_Prabhupada_Expenses_${activeDevotee?.group_name ? activeDevotee.group_name.replace(/\s+/g, '_') : 'Guest'}`,
      'Prabhupada Expenses'
    );

    showToast({
      type: 'success',
      title: 'Export Successful',
      message: 'Prabhupada Appearance Day expenses exported in current sorted order.',
    });
  };

  const handleExportJanmashtamiExpenses = () => {
    if (sortedMyJanmashtamiExpenses.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Expenses to Export',
        message: 'There are no submitted Janmashtami expenses to export.',
      });
      return;
    }

    const exportData = sortedMyJanmashtamiExpenses.map(exp => ({
      'Expense Date': formatExpenseDate(exp.date || exp.created_at),
      'Submitted At': formatSubmissionDateTime(exp.created_at),
      'Item / Seva': exp.title,
      'Comments / Notes': exp.comments || '-',
      'Payer': exp.payer_name,
      'Amount (₹)': Number(exp.amount),
      'Receipts Attached': parseReceiptUrls(exp.bill_url).length,
      'Status': exp.status,
      'Rejection Reason': exp.rejection_reason || '-',
    }));

    exportTableToExcel(
      exportData,
      `My_Janmashtami_Expenses_${activeDevotee?.group_name ? activeDevotee.group_name.replace(/\s+/g, '_') : 'Guest'}`,
      'Janmashtami Expenses'
    );

    showToast({
      type: 'success',
      title: 'Export Successful',
      message: 'Janmashtami expenses exported in current sorted order.',
    });
  };

  // Form submit for Prabhupada Appearance Day
  const handleFormSubmit = async (e: React.FormEvent) => {
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
    const defaultPayer = getDefaultPayer() || getPrimaryFamilyMemberName(activeDevotee) || guestName || '';
    const resolvedPayer = payerName.trim() || defaultPayer;

    if (!resolvedPayer) {
      showToast({ type: 'warning', title: 'Payer Required', message: 'Please select or enter who made the payment.' });
      return;
    }

    if (!expenseTitle.trim()) {
      showToast({ type: 'warning', title: 'Description Required', message: 'Please enter what was purchased for the festival.' });
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      showToast({ type: 'warning', title: 'Invalid Amount', message: 'Please enter a valid expense amount.' });
      return;
    }

    if (receiptFiles.length === 0) {
      showToast({
        type: 'warning',
        title: 'Attachment Mandatory',
        message: 'At least 1 bill or receipt attachment is mandatory for festival seva expenses.',
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadedUrls: string[] = [];
      for (const file of receiptFiles) {
        let toUpload = file;
        if (file.type.startsWith('image/')) {
          try {
            toUpload = await compressImage(file, { maxSizeMB: 0.19 });
          } catch (uploadErr) {
            console.warn('Receipt compression fallback:', uploadErr);
          }
        }
        const url = await storageService.uploadReceipt(toUpload);
        uploadedUrls.push(url);
      }

      const formattedBillUrl = formatReceiptUrls(uploadedUrls);

      await submitExpense({
        devotee_id: activeDevotee?.id || null,
        guest_name: !activeDevotee ? guestName || resolvedPayer || 'Anonymous Devotee' : null,
        date: expenseDate,
        cycle_month: expenseDate ? expenseDate.slice(0, 7) : activeMonth,
        type: 'PRABHUPADA_APPEARANCE',
        payer_name: resolvedPayer,
        title: expenseTitle.trim(),
        amount: amountNum,
        comments: expenseComments.trim() || null,
        bill_url: formattedBillUrl,
        status: 'PENDING',
      });

      // Reset form
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseComments('');
      setReceiptFiles([]);
      setExpenseDate(getDefaultExpenseDate(activeMonth));
      setPayerName(getDefaultPayer());
      setActiveLedgerView('appearance_day');
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission Failed',
        message: err.message || 'Could not log Prabhupada Appearance Day expense.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-20">
      {/* 1. Simple, Compact Hero Banner (Space-efficient per user feedback) */}
      <div className="rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-600 p-4 sm:p-5 text-white shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[11px] font-semibold">
              <Crown className="w-3.5 h-3.5 text-amber-200" />
              <span>Srila Prabhupada Appearance Day (Vyasa-Puja)</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Prabhupada Appearance Day Seva Ledger
            </h1>
            <p className="text-xs text-amber-100 max-w-lg leading-snug">
              Isolated festival ledger for Vyasa-Puja purchases (garlands, abhishek items, bhoga, lighting). Not part of monthly meal billing.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="px-3 py-2 rounded-xl bg-black/25 backdrop-blur-xs border border-white/20 text-center">
              <div className="text-[10px] text-amber-200 font-medium">Community Seva</div>
              <div className="text-base sm:text-lg font-extrabold mt-0.5">
                {formatRupee(totalPrabhupadaFund)}
              </div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/20 backdrop-blur-xs border border-white/30 text-center">
              <div className="text-[10px] text-white font-medium">Your Seva</div>
              <div className="text-base sm:text-lg font-extrabold mt-0.5">
                {formatRupee(myPrabhupadaTotal)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Prabhupada Appearance Day Expense Logger Form (Janmashtami form is completely replaced) */}
      <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-2.5 mb-4">
          <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Log Prabhupada Appearance Day Expense
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Record flowers, garlands, abhishek items, 108 bhoga preparations, book distribution, and decor (up to 5 attachments).
            </p>
          </div>
        </div>

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Expense Date */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Expense Date *
              </label>
              <input
                type="date"
                required
                value={expenseDate}
                onChange={e => setExpenseDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 outline-none font-medium"
              />
            </div>

            {/* Payer */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Who Made the Expense?
              </label>
              {activeDevotee ? (
                <select
                  value={payerName || (getFamilyMemberNames(activeDevotee).length === 1 ? getFamilyMemberNames(activeDevotee)[0] : '')}
                  onChange={e => setPayerName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                >
                  {getFamilyMemberNames(activeDevotee).length > 1 && <option value="">Select Member</option>}
                  {getFamilyMemberNames(activeDevotee).map((member: string) => (
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
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 outline-none"
                />
              )}
            </div>

            {/* Title / Item */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Expense Title / Item *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Vyasa-Puja Flowers & Garlands"
                value={expenseTitle}
                onChange={e => setExpenseTitle(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>

            {/* Cost Amount */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Cost Amount (₹) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="e.g. 3500"
                value={expenseAmount}
                onChange={e => setExpenseAmount(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 outline-none font-semibold"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Comments */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
                Seva Details / Comments (Optional)
              </label>
              <textarea
                rows={3}
                placeholder="Details of festival seva, shop/vendor, quantity, items..."
                value={expenseComments}
                onChange={e => setExpenseComments(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs focus:ring-2 focus:ring-amber-500 outline-none resize-none"
              />
            </div>

            {/* Multi-Attachment Upload (Up to 5 Attachments) */}
            <div>
              <MultiAttachmentUpload
                files={receiptFiles}
                onFilesChange={setReceiptFiles}
                maxFiles={5}
                required={true}
                label="Bill / Receipt Attachments"
                sublabel="Attach up to 5 bills (Mandatory for festival expenses)"
                onError={msg => showToast({ type: 'warning', title: 'Attachment Notice', message: msg })}
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="submit"
              variant="saffron"
              size="md"
              isLoading={isUploading}
            >
              <Plus className="w-4 h-4 mr-1" />
              <span>Submit Prabhupada Appearance Day Expense</span>
            </Button>
          </div>
        </form>
      </Card>

      {/* 3. Devotee Expenses Ledger - Devotees can see BOTH Prabhupada Appearance Day & Janmashtami Expenses */}
      <Card className="p-4 sm:p-6 border border-slate-200 dark:border-slate-800 shadow-sm">
        {/* Segmented Switcher for Both Festivals */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 max-w-fit">
            <button
              type="button"
              onClick={() => setActiveLedgerView('appearance_day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeLedgerView === 'appearance_day'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Crown className="w-3.5 h-3.5" />
              <span>Prabhupada Appearance Day ({myPrabhupadaExpenses.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveLedgerView('janmashtami')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeLedgerView === 'janmashtami'
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Janmashtami ({myJanmashtamiExpenses.length})</span>
              <span className="text-[10px] font-semibold px-1 py-0 rounded bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300">
                Completed
              </span>
            </button>
          </div>

          <div className="text-left sm:text-right">
            {activeLedgerView === 'appearance_day' ? (
              <div>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold block">
                  Prabhupada Seva: {formatRupee(myPrabhupadaTotal)}
                  {myPrabhupadaPendingTotal > 0 && '*'}
                </span>
                {myPrabhupadaPendingTotal > 0 && (
                  <span className="text-[10px] text-slate-400">
                    * Includes {formatRupee(myPrabhupadaPendingTotal)} pending approval
                  </span>
                )}
              </div>
            ) : (
              <div>
                <span className="text-xs text-slate-700 dark:text-slate-300 font-bold block">
                  Janmashtami Total: {formatRupee(myJanmashtamiTotal)}
                </span>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                  ✓ Festival Completed
                </span>
              </div>
            )}
          </div>
        </div>

        {/* View 1: Prabhupada Appearance Day Expenses Table */}
        {activeLedgerView === 'appearance_day' && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  My Prabhupada Appearance Day Expenses ({myPrabhupadaExpenses.length})
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Only your submitted Vyasa-Puja festival entries are displayed here.
                </p>
              </div>
              {myPrabhupadaExpenses.length > 0 && (
                <Button
                  type="button"
                  onClick={handleExportPrabhupadaExpenses}
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 py-1 px-2.5 h-auto"
                  title="Export to Excel"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Excel</span>
                </Button>
              )}
            </div>

            {myPrabhupadaExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px]">
                      <SortableHeader
                        label="Expense Date"
                        sortKey="date"
                        currentSortKey={prabhupadaSortConfig?.key}
                        currentDirection={prabhupadaSortConfig?.direction}
                        onSort={requestPrabhupadaSort}
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Submitted At"
                        sortKey="created_at"
                        currentSortKey={prabhupadaSortConfig?.key}
                        currentDirection={prabhupadaSortConfig?.direction}
                        onSort={requestPrabhupadaSort}
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Item / Seva"
                        sortKey="title"
                        currentSortKey={prabhupadaSortConfig?.key}
                        currentDirection={prabhupadaSortConfig?.direction}
                        onSort={requestPrabhupadaSort}
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Payer"
                        sortKey="payer_name"
                        currentSortKey={prabhupadaSortConfig?.key}
                        currentDirection={prabhupadaSortConfig?.direction}
                        onSort={requestPrabhupadaSort}
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Amount"
                        sortKey="amount"
                        currentSortKey={prabhupadaSortConfig?.key}
                        currentDirection={prabhupadaSortConfig?.direction}
                        onSort={requestPrabhupadaSort}
                        align="right"
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Receipts"
                        align="center"
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Status"
                        sortKey="status"
                        currentSortKey={prabhupadaSortConfig?.key}
                        currentDirection={prabhupadaSortConfig?.direction}
                        onSort={requestPrabhupadaSort}
                        align="center"
                        className="py-2.5 px-3"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {sortedMyPrabhupadaExpenses.map((exp: Expense) => {
                      const receiptCount = parseReceiptUrls(exp.bill_url).length;
                      return (
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
                          <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {formatRupee(exp.amount)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {exp.bill_url ? (
                              <button
                                onClick={() => setViewingReceiptUrl(exp.bill_url!)}
                                className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline text-xs font-semibold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View ({receiptCount})</span>
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
                              <Badge variant="danger" size="sm">
                                Rejected
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                No Prabhupada Appearance Day expenses logged by you yet. Use the form above to log your festival seva.
              </div>
            )}
          </div>
        )}

        {/* View 2: Janmashtami Expenses Table (Historical / Completed - No form here) */}
        {activeLedgerView === 'janmashtami' && (
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    My Janmashtami Expenses ({myJanmashtamiExpenses.length})
                  </h4>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                    Completed & Archived
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Janmashtami seva submissions are closed. Devotees can review all their historical festival records below.
                </p>
              </div>
              {myJanmashtamiExpenses.length > 0 && (
                <Button
                  type="button"
                  onClick={handleExportJanmashtamiExpenses}
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 py-1 px-2.5 h-auto"
                  title="Export Janmashtami to Excel"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Excel</span>
                </Button>
              )}
            </div>

            {myJanmashtamiExpenses.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 uppercase font-semibold text-[11px]">
                      <SortableHeader
                        label="Expense Date"
                        sortKey="date"
                        currentSortKey={janmashtamiSortConfig?.key}
                        currentDirection={janmashtamiSortConfig?.direction}
                        onSort={requestJanmashtamiSort}
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Submitted At"
                        sortKey="created_at"
                        currentSortKey={janmashtamiSortConfig?.key}
                        currentDirection={janmashtamiSortConfig?.direction}
                        onSort={requestJanmashtamiSort}
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Item / Seva"
                        sortKey="title"
                        currentSortKey={janmashtamiSortConfig?.key}
                        currentDirection={janmashtamiSortConfig?.direction}
                        onSort={requestJanmashtamiSort}
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Payer"
                        sortKey="payer_name"
                        currentSortKey={janmashtamiSortConfig?.key}
                        currentDirection={janmashtamiSortConfig?.direction}
                        onSort={requestJanmashtamiSort}
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Amount"
                        sortKey="amount"
                        currentSortKey={janmashtamiSortConfig?.key}
                        currentDirection={janmashtamiSortConfig?.direction}
                        onSort={requestJanmashtamiSort}
                        align="right"
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Receipts"
                        align="center"
                        className="py-2.5 px-3"
                      />
                      <SortableHeader
                        label="Status"
                        sortKey="status"
                        currentSortKey={janmashtamiSortConfig?.key}
                        currentDirection={janmashtamiSortConfig?.direction}
                        onSort={requestJanmashtamiSort}
                        align="center"
                        className="py-2.5 px-3"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {sortedMyJanmashtamiExpenses.map((exp: Expense) => {
                      const receiptCount = parseReceiptUrls(exp.bill_url).length;
                      return (
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
                          <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                            {formatRupee(exp.amount)}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {exp.bill_url ? (
                              <button
                                onClick={() => setViewingReceiptUrl(exp.bill_url!)}
                                className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 hover:underline text-xs font-semibold"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>View ({receiptCount})</span>
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
                              <Badge variant="danger" size="sm">
                                Rejected
                              </Badge>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                No Janmashtami festival entries were logged by you.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 4. Other Expenses Navigation Section */}
      <div className="space-y-3 pt-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
            <Wallet className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Other Expenses
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Direct links to regular kitchen offsets, preaching outreach, and cultivation expense forms
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Regular GNH Expense */}
          <div
            onClick={handleNavigateToRegularExpenses}
            role="button"
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleNavigateToRegularExpenses();
              }
            }}
            className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-amber-400 dark:hover:border-amber-500/50 transition-all cursor-pointer select-none"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="w-12 h-12 rounded-xl bg-amber-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 p-1 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <img
                    src="/GNHLogo.png"
                    alt="GNH Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
                  Offset Prasadam
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                  Regular GNH Expense
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Monthly kitchen, sabji, gas cylinder & maintenance purchases
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span>Go to Regular Expenses</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </div>

          {/* Card 2: ARJUNA Expenses */}
          <a
            href="https://tinyurl.com/AGTReimburse"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500/50 transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="w-12 h-12 rounded-xl bg-blue-50/70 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 p-1 flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform overflow-hidden">
                  <img
                    src="/Arjuna_Logo.jpg"
                    alt="ARJUNA Logo"
                    className="w-full h-full object-contain rounded-lg"
                  />
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
                  Reimbursement
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  ARJUNA Expenses
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Youth & campus preaching, community Sunday programs, literature
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Open ARJUNA Form</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </a>

          {/* Card 3: Influential people cultivation */}
          <a
            href="https://forms.gle/batrkRmLYvYQQyfJ9"
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex flex-col justify-between p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500/50 transition-all"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <span className="font-black text-xl tracking-tight leading-none select-none">$</span>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
                  Cultivation
                </span>
              </div>

              <div className="mt-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                  Influential People Cultivation
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  VIP outreach, devotee relationship cultivation, and seva gift reimbursements
                </p>
              </div>
            </div>

            <div className="mt-4 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <span>Open Cultivation Form</span>
              <ExternalLink className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
          </a>
        </div>
      </div>

      {/* Multi-Receipt Viewer Modal */}
      <ReceiptViewerModal
        isOpen={Boolean(viewingReceiptUrl)}
        onClose={() => setViewingReceiptUrl(null)}
        billUrl={viewingReceiptUrl}
        title="Festival Seva Receipts"
      />
    </div>
  );
};

export default AppearanceDayPage;
