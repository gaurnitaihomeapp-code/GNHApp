import React, { useState, useMemo } from 'react';
import {
  ShieldCheck,
  Users,
  IndianRupee,
  Send,
  Download,
  Settings,
  Edit,
  CheckCircle2,
  Lock,
  RefreshCw,
  Plus,
  Search,
  MessageSquare,
  Copy,
  Key,
  Database,
  Eye,
  Trash2,
  ExternalLink,
  Receipt,
  Sparkles,
  Crown,
  Check,
  X,
  Calendar,
  Info,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { Devotee, DevoteeMonthlySummary, Expense, PrasadamCount, FamilyMember } from '../types';
import {
  formatRupee,
  formatMonthName,
  calculateMealsCost,
  getAllDatesInMonth,
  getCutoffFormattedDate,
  generateCustomReminderMessage,
  formatDevoteeName,
  getNextCycleMonth,
  formatExpenseDate,
  formatSubmissionDateTime,
} from '../utils/calculations';
import {
  normalizeFamilyMembers,
  getFamilyMemberNames,
  getPureFamilyMembers,
  getFriendMembers,
  getAllDevoteePhones,
  formatDevoteeFamilyDisplay,
  cleanPhoneNumber,
} from '../utils/devoteeHelpers';
import { exportToExcel, exportToPDF, exportTableToExcel } from '../utils/exportHelpers';
import { SortableHeader } from '../components/common/SortableHeader';
import { ReceiptViewerModal } from '../components/common/ReceiptViewerModal';
import { parseReceiptUrls } from '../utils/receiptHelpers';
import { useTableSort } from '../hooks/useTableSort';

type AdminTab = 'matrix' | 'expenses' | 'regular-expenses' | 'janmashtami-expenses' | 'settlement' | 'whatsapp' | 'devotees' | 'settings';

export const AdminPage: React.FC = () => {
  const {
    activeMonth,
    allDevoteeSummaries,
    devotees,
    expenses,
    prasadamCounts,
    isAdmin,
    setIsAdminPinModalOpen,
    logoutAdmin,
    selectDevoteeAndRedirect,
    reviewExpense,
    adminVerifySettlement,
    adminResetSettlement,
    carryOverBalances,
    updateDevoteeCarryForward,
    autoFillCounts,
    updatePrasadamCount,
    saveDevotee,
    deleteDevotee,
    updateAdminPin,
    communityCostPerMember,
    updateCommunityCostPerMember,
    resetDatabase,
    showToast,
    isLocalMode,
  } = useApp();

  const [activeAdminTab, setActiveAdminTab] = useState<AdminTab>('matrix');
  const [searchTerm, setSearchTerm] = useState('');
  const [settlementFilter, setSettlementFilter] = useState<'ALL' | 'PENDING' | 'SETTLED' | 'UNSETTLED'>('ALL');

  // Devotee Matrix Drawer / Inline Matrix Modal
  const [selectedDevoteeForEdit, setSelectedDevoteeForEdit] = useState<Devotee | null>(null);

  // Expense Rejection Modal
  const [rejectingExpense, setRejectingExpense] = useState<Expense | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Expenses Subcategory State
  const [expenseSubcategory, setExpenseSubcategory] = useState<'REGULAR' | 'JANMASHTAMI'>('REGULAR');

  // Status Filters for Expenses
  const [regularStatusFilter, setRegularStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');
  const [janmashtamiStatusFilter, setJanmashtamiStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('ALL');

  // Carry Forward Adjustment Modal
  const [editingCarryForwardDevotee, setEditingCarryForwardDevotee] = useState<DevoteeMonthlySummary | null>(null);
  const [carryForwardAmountInput, setCarryForwardAmountInput] = useState('');

  const handleOpenEditCarryForward = (s: DevoteeMonthlySummary) => {
    setEditingCarryForwardDevotee(s);
    setCarryForwardAmountInput(s.carried_forward.toString());
  };

  const handleSaveCarryForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCarryForwardDevotee) return;
    const amount = parseFloat(carryForwardAmountInput);
    if (isNaN(amount)) {
      showToast({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Please enter a valid numeric amount.',
      });
      return;
    }
    await updateDevoteeCarryForward(editingCarryForwardDevotee.devotee.id, activeMonth, amount);
    setEditingCarryForwardDevotee(null);
  };

  // Direct Settle Modal
  const [settlingDevotee, setSettlingDevotee] = useState<DevoteeMonthlySummary | null>(null);
  const [directSettleAmount, setDirectSettleAmount] = useState('');
  const [directSettleDate, setDirectSettleDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [directSettleNotes, setDirectSettleNotes] = useState('');

  const handleOpenDirectSettle = (s: DevoteeMonthlySummary) => {
    setSettlingDevotee(s);
    if (s.settlement_reported > 0) {
      setDirectSettleAmount(s.settlement_reported.toString());
    } else if (s.final_balance > 0) {
      setDirectSettleAmount(s.final_balance.toString());
    } else {
      const gross = s.prasadam_cost - s.approved_expenses + s.carried_forward;
      setDirectSettleAmount(gross > 0 ? gross.toString() : '0');
    }
    setDirectSettleDate(s.settlement_date_reported || new Date().toISOString().slice(0, 10));
    setDirectSettleNotes(s.settlement_status === 'SETTLED' ? 'Verified by Admin' : 'Settled via Admin Panel');
  };

  // Devotee Edit/Create Modal
  const [isDevoteeModalOpen, setIsDevoteeModalOpen] = useState(false);
  const [editingDevotee, setEditingDevotee] = useState<Devotee | null>(null);
  const [devoteeGroupName, setDevoteeGroupName] = useState('');
  const [devoteePhone, setDevoteePhone] = useState('');
  const [devoteeCommunityCost, setDevoteeCommunityCost] = useState<string>('500');
  const [familyRows, setFamilyRows] = useState<{
    id?: string;
    name: string;
    phone_number: string;
    is_friend: boolean;
    community_cost: string;
    monthly_counts?: Record<string, { breakfast: number; lunch: number; dinner: number }>;
  }[]>([
    { name: '', phone_number: '', is_friend: false, community_cost: '' },
  ]);

  // PIN change state
  const [newPinInput, setNewPinInput] = useState('');

  // Community Cost setting state
  const [communityCostInput, setCommunityCostInput] = useState(communityCostPerMember.toString());

  React.useEffect(() => {
    setCommunityCostInput(communityCostPerMember.toString());
  }, [communityCostPerMember]);

  const handleUpdateCommunityCost = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(communityCostInput);
    if (isNaN(val) || val < 0) {
      showToast({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Please enter a valid positive number for Community Cost.',
      });
      return;
    }
    await updateCommunityCostPerMember(val);
  };

  // Filter summaries based on search (matches group name, primary phone, member names, and member phones)
  const filteredSummaries = useMemo(() => {
    return allDevoteeSummaries.filter(s => {
      const q = searchTerm.toLowerCase();
      const familyNames = getFamilyMemberNames(s.devotee);
      const allPhones = getAllDevoteePhones(s.devotee);
      return (
        s.devotee.group_name.toLowerCase().includes(q) ||
        s.devotee.phone_number.includes(q) ||
        allPhones.some(p => p.includes(q)) ||
        familyNames.some(m => m.toLowerCase().includes(q))
      );
    });
  }, [allDevoteeSummaries, searchTerm]);

  // Helper to extract month strictly from Date of Expense (e.date or fallback created_at)
  const getExpenseMonth = (e: Expense): string => {
    const rawDate = e.date || (e.created_at ? e.created_at.slice(0, 10) : '');
    return rawDate.slice(0, 7);
  };

  // Month-filtered expenses strictly for activeMonth based on Date of Expense
  const monthExpenses = useMemo(() => {
    return expenses.filter(e => getExpenseMonth(e) === activeMonth);
  }, [expenses, activeMonth]);

  // Separate Regular and Janmashtami expenses strictly for activeMonth
  const regularExpenses = useMemo(() => {
    return monthExpenses.filter(e => e.type === 'REGULAR');
  }, [monthExpenses]);

  // Festival expenses (Prabhupada Appearance Day & Janmashtami) are NOT categorized by month - showing expenses for all time
  const [festivalTypeFilter, setFestivalTypeFilter] = useState<'ALL' | 'PRABHUPADA_APPEARANCE' | 'JANMASHTAMI'>('ALL');
  const [adminViewingReceiptUrl, setAdminViewingReceiptUrl] = useState<string | null>(null);

  const festivalExpenses = useMemo(() => {
    return expenses.filter(e => {
      if (festivalTypeFilter === 'ALL') {
        return e.type === 'PRABHUPADA_APPEARANCE' || e.type === 'JANMASHTAMI';
      }
      return e.type === festivalTypeFilter;
    });
  }, [expenses, festivalTypeFilter]);

  const janmashtamiExpenses = useMemo(() => {
    return expenses.filter(e => e.type === 'JANMASHTAMI');
  }, [expenses]);

  const filteredRegularExpenses = useMemo(() => {
    return regularExpenses.filter(e => {
      if (regularStatusFilter !== 'ALL' && e.status !== regularStatusFilter) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      const devotee = devotees.find(d => d.id === e.devotee_id);
      const devoteeName = devotee ? formatDevoteeName(devotee).toLowerCase() : '';
      return (
        e.title.toLowerCase().includes(q) ||
        e.payer_name.toLowerCase().includes(q) ||
        devoteeName.includes(q) ||
        (e.comments && e.comments.toLowerCase().includes(q))
      );
    });
  }, [regularExpenses, regularStatusFilter, searchTerm, devotees]);

  const filteredJanmashtamiExpenses = useMemo(() => {
    return festivalExpenses.filter(e => {
      if (janmashtamiStatusFilter !== 'ALL' && e.status !== janmashtamiStatusFilter) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      const devotee = devotees.find(d => d.id === e.devotee_id);
      const devoteeName = devotee ? formatDevoteeName(devotee).toLowerCase() : '';
      return (
        e.title.toLowerCase().includes(q) ||
        e.payer_name.toLowerCase().includes(q) ||
        devoteeName.includes(q) ||
        (e.comments && e.comments.toLowerCase().includes(q))
      );
    });
  }, [festivalExpenses, janmashtamiStatusFilter, searchTerm, devotees]);

  // Regular Expense Financial Totals for Active Month
  const totalRegularAmount = useMemo(() => {
    return regularExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [regularExpenses]);

  const approvedRegularAmount = useMemo(() => {
    return regularExpenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + Number(e.amount), 0);
  }, [regularExpenses]);

  const pendingRegularAmount = useMemo(() => {
    return regularExpenses.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + Number(e.amount), 0);
  }, [regularExpenses]);

  const rejectedRegularAmount = useMemo(() => {
    return regularExpenses.filter(e => e.status === 'REJECTED').reduce((sum, e) => sum + Number(e.amount), 0);
  }, [regularExpenses]);

  const pendingRegularCount = useMemo(() => {
    return regularExpenses.filter(e => e.status === 'PENDING').length;
  }, [regularExpenses]);

  // Janmashtami Expense Financial Totals for Active Month
  const totalJanmashtamiAmount = useMemo(() => {
    return janmashtamiExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  }, [janmashtamiExpenses]);

  const approvedJanmashtamiAmount = useMemo(() => {
    return janmashtamiExpenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + Number(e.amount), 0);
  }, [janmashtamiExpenses]);

  const pendingJanmashtamiAmount = useMemo(() => {
    return janmashtamiExpenses.filter(e => e.status === 'PENDING').reduce((sum, e) => sum + Number(e.amount), 0);
  }, [janmashtamiExpenses]);

  const rejectedJanmashtamiAmount = useMemo(() => {
    return janmashtamiExpenses.filter(e => e.status === 'REJECTED').reduce((sum, e) => sum + Number(e.amount), 0);
  }, [janmashtamiExpenses]);

  const pendingJanmashtamiCount = useMemo(() => {
    return janmashtamiExpenses.filter(e => e.status === 'PENDING').length;
  }, [janmashtamiExpenses]);

  const totalCommunityPendingExpenses = useMemo(() => {
    return allDevoteeSummaries.reduce((sum, s) => sum + (s.pending_expenses || 0), 0);
  }, [allDevoteeSummaries]);

  // Overall totals across community
  const totalPrasadamCost = useMemo(() => {
    return allDevoteeSummaries.reduce((sum, s) => sum + s.prasadam_cost, 0);
  }, [allDevoteeSummaries]);

  const totalApprovedExpenses = useMemo(() => {
    return allDevoteeSummaries.reduce((sum, s) => sum + s.approved_expenses, 0);
  }, [allDevoteeSummaries]);

  const totalPendingReceivable = useMemo(() => {
    return allDevoteeSummaries.filter(s => s.final_balance > 0).reduce((sum, s) => sum + s.final_balance, 0);
  }, [allDevoteeSummaries]);

  const totalPendingPayable = useMemo(() => {
    return allDevoteeSummaries.filter(s => s.final_balance < 0).reduce((sum, s) => sum + Math.abs(s.final_balance), 0);
  }, [allDevoteeSummaries]);

  // Pending settlements
  const pendingSettlementSummaries = useMemo(() => {
    return allDevoteeSummaries.filter(s => s.settlement_status === 'PENDING_VERIFICATION');
  }, [allDevoteeSummaries]);

  // If not authenticated as admin
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto py-16 px-4 text-center">
        <div className="w-16 h-16 mx-auto rounded-3xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center p-3 mb-4 text-amber-600 dark:text-amber-400">
          <Lock className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
          Admin Authorization Required
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          Enter the 6-digit administrative security PIN to access master matrix, settlement approvals, and exporter tools.
        </p>
        <Button
          onClick={() => setIsAdminPinModalOpen(true)}
          variant="saffron"
          className="mt-6 w-full"
        >
          <span>Unlock Admin Center</span>
        </Button>
      </div>
    );
  }

  // Handle batch auto-fill for all devotees
  const handleTriggerAutoFillAll = async () => {
    if (!confirm(`Are you sure you want to auto-fill missing meal counts for all devotees for ${formatMonthName(activeMonth)}?`)) return;
    await autoFillCounts();
  };

  // Handle Carry-Over Balances to next month
  const handleCarryOverToNextMonth = async () => {
    const nextMonth = getNextCycleMonth(activeMonth);

    if (!confirm(`Roll forward current balances for ${allDevoteeSummaries.length} devotees into ${formatMonthName(nextMonth)}?`)) return;
    await carryOverBalances(nextMonth);
  };

  // Handle Reject Expense
  const handleConfirmRejection = async () => {
    if (!rejectingExpense) return;
    await reviewExpense(rejectingExpense.id, 'REJECTED', rejectionReason);
    setRejectingExpense(null);
    setRejectionReason('');
  };

  // Handle Direct Settle Submit
  const handleDirectSettleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settlingDevotee) return;
    const amountNum = parseFloat(directSettleAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast({
        type: 'error',
        title: 'Invalid Amount',
        message: 'Please enter a valid settlement amount greater than 0.',
      });
      return;
    }

    await adminVerifySettlement(
      settlingDevotee.devotee.id,
      amountNum,
      directSettleDate,
      directSettleNotes || 'Manually Settled by Admin'
    );

    setSettlingDevotee(null);
    setDirectSettleAmount('');
    setDirectSettleNotes('');
  };

  // Open Devotee Create/Edit
  const handleOpenDevoteeModal = (devotee?: Devotee) => {
    if (devotee) {
      setEditingDevotee(devotee);
      setDevoteeGroupName(devotee.group_name);
      setDevoteePhone(devotee.phone_number);
      setDevoteeCommunityCost(
        typeof devotee.community_cost === 'number'
          ? devotee.community_cost.toString()
          : communityCostPerMember.toString()
      );
      const normalized = normalizeFamilyMembers(devotee);
      setFamilyRows(
        normalized.length > 0
          ? normalized.map(m => ({
              id: m.id,
              name: m.name,
              phone_number: m.phone_number || '',
              is_friend: Boolean(m.is_friend),
              community_cost: typeof m.community_cost === 'number' ? m.community_cost.toString() : '',
              monthly_counts: m.monthly_counts || {},
            }))
          : [{ name: devotee.group_name, phone_number: devotee.phone_number, is_friend: false, community_cost: '' }]
      );
    } else {
      setEditingDevotee(null);
      setDevoteeGroupName('');
      setDevoteePhone('');
      setDevoteeCommunityCost(communityCostPerMember.toString());
      setFamilyRows([{ name: '', phone_number: '', is_friend: false, community_cost: '' }]);
    }
    setIsDevoteeModalOpen(true);
  };

  const handleSaveDevoteeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = cleanPhoneNumber(devoteePhone);
    if (!devoteeGroupName.trim() || cleanPhone.length !== 10) {
      showToast({
        type: 'error',
        title: 'Invalid Input',
        message: 'Please enter a valid group name and 10-digit mobile number.',
      });
      return;
    }

    const parsedGroupCost = parseFloat(devoteeCommunityCost);
    const finalGroupCost = !isNaN(parsedGroupCost) && parsedGroupCost >= 0 ? parsedGroupCost : undefined;

    const validMembers: FamilyMember[] = familyRows
      .filter(r => r.name.trim().length > 0)
      .map(r => {
        const parsedCost = r.community_cost ? parseFloat(r.community_cost) : undefined;
        let memberPhone = cleanPhoneNumber(r.phone_number) || undefined;
        if (editingDevotee && memberPhone === cleanPhoneNumber(editingDevotee.phone_number)) {
          memberPhone = cleanPhone;
        }
        return {
          id: r.id,
          name: r.name.trim(),
          phone_number: memberPhone,
          is_friend: Boolean(r.is_friend),
          community_cost: typeof parsedCost === 'number' && !isNaN(parsedCost) ? Math.max(0, parsedCost) : undefined,
          monthly_counts: r.monthly_counts || {},
        };
      });

    try {
      await saveDevotee({
        id: editingDevotee?.id || undefined as any,
        group_name: devoteeGroupName.trim(),
        phone_number: cleanPhone,
        community_cost: finalGroupCost,
        family_members:
          validMembers.length > 0
            ? validMembers
            : [{ name: devoteeGroupName.trim(), phone_number: cleanPhone, is_friend: false }],
        is_admin: editingDevotee?.is_admin || false,
      });

      showToast({
        type: 'success',
        title: 'Devotee Saved',
        message: `Devotee ${devoteeGroupName.trim()} saved successfully.`,
      });
      setIsDevoteeModalOpen(false);
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Error Saving Devotee',
        message: err.message || 'Failed to save devotee in database.',
      });
    }
  };

  // Handle Admin PIN update
  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(newPinInput)) {
      showToast({
        type: 'error',
        title: 'Invalid PIN',
        message: 'Admin PIN must be exactly 6 numeric digits.',
      });
      return;
    }
    await updateAdminPin(newPinInput);
    setNewPinInput('');
  };

  // Generate WhatsApp Message URL with exact closing date and custom Vaishnava template
  const generateWhatsAppLink = (summary: DevoteeMonthlySummary) => {
    const name = formatDevoteeName(summary.devotee);
    const message = generateCustomReminderMessage(activeMonth, summary.devotee.phone_number, name);
    return `https://wa.me/91${summary.devotee.phone_number}?text=${encodeURIComponent(message)}`;
  };

  const datesForMonth = getAllDatesInMonth(activeMonth);

  // 1. MASTER DEVOTEE LEDGER SORT & EXPORT
  const {
    sortedData: sortedSummaries,
    sortConfig: matrixSortConfig,
    requestSort: requestMatrixSort,
  } = useTableSort<DevoteeMonthlySummary>(filteredSummaries, {
    initialConfig: { key: 'group_name', direction: 'asc' },
    getSortValue: (s, key) => {
      if (key === 'group_name') return formatDevoteeName(s.devotee);
      if (key === 'phone_number') return s.devotee.phone_number;
      if (key === 'total_meals') return s.total_meals;
      if (key === 'meals_cost') return s.meals_cost;
      if (key === 'community_cost') return s.community_cost;
      if (key === 'prasadam_cost') return s.prasadam_cost;
      if (key === 'approved_expenses') return s.approved_expenses;
      if (key === 'carried_forward') return s.carried_forward;
      if (key === 'final_balance') return s.final_balance;
      if (key === 'settlement_status') return s.settlement_status;
      return (s as any)[key];
    },
  });

  const handleExportMasterLedger = () => {
    if (sortedSummaries.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Data to Export',
        message: 'No devotee records match your current search or filter.',
      });
      return;
    }

    const exportData = sortedSummaries.map(s => ({
      'Devotee Group': formatDevoteeName(s.devotee),
      'Family Members': formatDevoteeFamilyDisplay(s.devotee, true),
      'Phone': s.devotee.phone_number,
      'Total Meals': s.total_meals,
      'Breakfast (B)': s.breakfast_total,
      'Lunch (L)': s.lunch_total,
      'Dinner (D)': s.dinner_total,
      'Meals Cost (₹)': s.meals_cost,
      'Community Cost (₹)': s.community_cost,
      'Total Prasadam Cost (₹)': s.prasadam_cost,
      'Approved Expenses (₹)': s.approved_expenses,
      'Pending Expenses (₹)': s.pending_expenses || 0,
      'Carried Forward (₹)': s.carried_forward,
      'Payment Recorded (₹)': s.settlement_reported,
      'Final Balance (₹)': s.final_balance,
      'Balance Status': s.final_balance > 0 ? 'Owes GNH' : s.final_balance < 0 ? 'GNH Owes' : 'Settled',
      'Settlement Status': s.settlement_status,
      'Janmashtami Expenses (₹)': s.janmashtami_expenses,
    }));

    exportTableToExcel(
      exportData,
      `Master_Devotee_Ledger_${activeMonth}_${formatMonthName(activeMonth).replace(/\s+/g, '_')}`,
      'Master Ledger'
    );

    showToast({
      type: 'success',
      title: 'Table Exported',
      message: 'Master devotee ledger exported in current sorted order.',
    });
  };

  // 2. REGULAR EXPENSES SORT & EXPORT
  const {
    sortedData: sortedRegularExpenses,
    sortConfig: regularSortConfig,
    requestSort: requestRegularSort,
  } = useTableSort<Expense>(filteredRegularExpenses, {
    initialConfig: { key: 'date', direction: 'desc' },
    getSortValue: (exp, key) => {
      if (key === 'date') return exp.date || exp.created_at;
      if (key === 'created_at') return exp.created_at;
      if (key === 'title') return exp.title;
      if (key === 'payer_name') {
        const devotee = devotees.find(d => d.id === exp.devotee_id);
        return `${exp.payer_name} ${devotee ? formatDevoteeName(devotee) : ''}`;
      }
      if (key === 'amount') return Number(exp.amount);
      if (key === 'status') return exp.status;
      return (exp as any)[key];
    },
  });

  const handleExportRegularExpenses = () => {
    if (sortedRegularExpenses.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Expenses to Export',
        message: 'No regular expenses match your current filters.',
      });
      return;
    }

    const exportData = sortedRegularExpenses.map(exp => {
      const devotee = devotees.find(d => d.id === exp.devotee_id);
      return {
        'Expense Date': formatExpenseDate(exp.date || exp.created_at),
        'Submitted At': formatSubmissionDateTime(exp.created_at),
        'Item / Description': exp.title,
        'Comments': exp.comments || '-',
        'Payer Name': exp.payer_name,
        'Devotee Group / Guest': devotee ? formatDevoteeName(devotee) : (exp.guest_name ? `Guest: ${exp.guest_name}` : 'Unknown'),
        'Amount (₹)': Number(exp.amount),
        'Receipt Attached': exp.bill_url ? 'YES' : 'NO',
        'Status': exp.status,
        'Rejection Reason': exp.rejection_reason || '-',
      };
    });

    exportTableToExcel(
      exportData,
      `Regular_Expenses_${activeMonth}_${regularStatusFilter}`,
      'Regular Expenses'
    );

    showToast({
      type: 'success',
      title: 'Table Exported',
      message: 'Regular expenses exported in current sorted order.',
    });
  };

  // 3. JANMASHTAMI EXPENSES SORT & EXPORT
  const {
    sortedData: sortedJanmashtamiExpenses,
    sortConfig: janmashtamiSortConfig,
    requestSort: requestJanmashtamiSort,
  } = useTableSort<Expense>(filteredJanmashtamiExpenses, {
    initialConfig: { key: 'date', direction: 'desc' },
    getSortValue: (exp, key) => {
      if (key === 'date') return exp.date || exp.created_at;
      if (key === 'created_at') return exp.created_at;
      if (key === 'title') return exp.title;
      if (key === 'payer_name') {
        const devotee = devotees.find(d => d.id === exp.devotee_id);
        return `${exp.payer_name} ${devotee ? formatDevoteeName(devotee) : ''}`;
      }
      if (key === 'amount') return Number(exp.amount);
      if (key === 'status') return exp.status;
      return (exp as any)[key];
    },
  });

  const handleExportJanmashtamiExpenses = () => {
    if (sortedJanmashtamiExpenses.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Expenses to Export',
        message: 'No Janmashtami expenses match your current filters.',
      });
      return;
    }

    const exportData = sortedJanmashtamiExpenses.map(exp => {
      const devotee = devotees.find(d => d.id === exp.devotee_id);
      return {
        'Expense Date': formatExpenseDate(exp.date || exp.created_at),
        'Submitted At': formatSubmissionDateTime(exp.created_at),
        'Item / Description': exp.title,
        'Comments': exp.comments || '-',
        'Payer Name': exp.payer_name,
        'Devotee Group / Guest': devotee ? formatDevoteeName(devotee) : (exp.guest_name ? `Guest: ${exp.guest_name}` : 'Unknown'),
        'Amount (₹)': Number(exp.amount),
        'Receipt Attached': exp.bill_url ? 'YES' : 'NO',
        'Status': exp.status,
        'Rejection Reason': exp.rejection_reason || '-',
      };
    });

    exportTableToExcel(
      exportData,
      `Janmashtami_Expenses_AllTime_${janmashtamiStatusFilter}`,
      'Janmashtami Expenses'
    );

    showToast({
      type: 'success',
      title: 'Table Exported',
      message: 'Janmashtami festival expenses exported in current sorted order.',
    });
  };

  // 4. SETTLEMENT TRACKING SORT & EXPORT
  const settlementList = useMemo(() => {
    return filteredSummaries.filter(s => {
      if (settlementFilter === 'PENDING') return s.settlement_status === 'PENDING_VERIFICATION';
      if (settlementFilter === 'SETTLED') return s.settlement_status === 'SETTLED';
      if (settlementFilter === 'UNSETTLED') return s.settlement_status === 'UNSETTLED';
      return true;
    });
  }, [filteredSummaries, settlementFilter]);

  const {
    sortedData: sortedSettlementList,
    sortConfig: settlementSortConfig,
    requestSort: requestSettlementSort,
  } = useTableSort<DevoteeMonthlySummary>(settlementList, {
    initialConfig: { key: 'final_balance', direction: 'desc' },
    getSortValue: (s, key) => {
      if (key === 'group_name') return formatDevoteeName(s.devotee);
      if (key === 'phone_number') return s.devotee.phone_number;
      if (key === 'prasadam_cost') return s.prasadam_cost;
      if (key === 'approved_expenses') return s.approved_expenses;
      if (key === 'carried_forward') return s.carried_forward;
      if (key === 'settlement_reported') return s.settlement_reported;
      if (key === 'settlement_status') return s.settlement_status;
      if (key === 'final_balance') return s.final_balance;
      return (s as any)[key];
    },
  });

  const handleExportSettlementTable = () => {
    if (sortedSettlementList.length === 0) {
      showToast({
        type: 'warning',
        title: 'No Data to Export',
        message: 'No settlement records match your current filter.',
      });
      return;
    }

    const exportData = sortedSettlementList.map(s => ({
      'Devotee Group': formatDevoteeName(s.devotee),
      'Phone': s.devotee.phone_number,
      'Prasadam Cost (₹)': s.prasadam_cost,
      'Approved Expenses (₹)': s.approved_expenses,
      'Carried Forward (₹)': s.carried_forward,
      'Payment Recorded (₹)': s.settlement_reported,
      'Payment Date': s.settlement_date_reported || '-',
      'Payment Notes': (s as any).settlement_notes || '-',
      'Settlement Status': s.settlement_status,
      'Final Balance (₹)': s.final_balance,
      'Status': s.final_balance > 0 ? 'Owes GNH' : s.final_balance < 0 ? 'GNH Owes' : 'Settled',
    }));

    exportTableToExcel(
      exportData,
      `Settlement_Tracking_${activeMonth}_${settlementFilter}`,
      'Settlements'
    );

    showToast({
      type: 'success',
      title: 'Table Exported',
      message: 'Settlement records exported in current sorted order.',
    });
  };

  // 5. DEVOTEE INLINE MATRIX MODAL SORT & EXPORT
  const devoteeDailyEntries = useMemo(() => {
    if (!selectedDevoteeForEdit) return [];
    return datesForMonth.map(dateStr => {
      const entry = prasadamCounts.find(
        (c: PrasadamCount) => c.devotee_id === selectedDevoteeForEdit.id && c.date === dateStr
      );
      const b = entry?.breakfast_count || 0;
      const l = entry?.lunch_count || 0;
      const d = entry?.dinner_count || 0;
      const cost = calculateMealsCost(b, l, d);
      return {
        dateStr,
        b,
        l,
        d,
        cost,
        entry,
      };
    });
  }, [selectedDevoteeForEdit, datesForMonth, prasadamCounts]);

  const {
    sortedData: sortedDevoteeDailyEntries,
    sortConfig: modalSortConfig,
    requestSort: requestModalSort,
  } = useTableSort(devoteeDailyEntries, {
    initialConfig: { key: 'dateStr', direction: 'asc' },
  });

  const handleExportDevoteeDailyMeals = () => {
    if (!selectedDevoteeForEdit || sortedDevoteeDailyEntries.length === 0) return;

    const devoteeName = formatDevoteeName(selectedDevoteeForEdit);
    const exportData = sortedDevoteeDailyEntries.map(item => ({
      'Date': item.dateStr,
      'Day': new Date(item.dateStr).toLocaleDateString('en-US', { weekday: 'short' }),
      'Devotee Group': devoteeName,
      'Breakfast (B)': item.b,
      'Lunch (L)': item.l,
      'Dinner (D)': item.d,
      'Total Meals': item.b + item.l + item.d,
      'Day Cost (₹)': item.cost,
    }));

    exportTableToExcel(
      exportData,
      `Meals_${devoteeName.replace(/\s+/g, '_')}_${activeMonth}`,
      'Daily Meals'
    );

    showToast({
      type: 'success',
      title: 'Table Exported',
      message: 'Daily meals exported in current sorted order.',
    });
  };

  // 6. DEVOTEES DIRECTORY EXPORT
  const handleExportDevoteesDirectory = () => {
    if (devotees.length === 0) return;

    const filteredDevoteesList = devotees.filter(d => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase();
      const name = (d.group_name || '').toLowerCase();
      const phone = (d.phone_number || '').toLowerCase();
      const members = getFamilyMemberNames(d).join(' ').toLowerCase();
      return name.includes(term) || phone.includes(term) || members.includes(term);
    });

    const exportData = filteredDevoteesList.map(d => {
      const pureFamily = getPureFamilyMembers(d);
      const friends = getFriendMembers(d);
      return {
        'Group Name': d.group_name,
        'Display Name': formatDevoteeName(d),
        'Primary Phone': d.phone_number,
        'Is Admin': d.is_admin ? 'YES' : 'NO',
        'Community Cost (₹/member)': typeof d.community_cost === 'number' ? d.community_cost : communityCostPerMember,
        'Family Members Count': pureFamily.length,
        'Family Members': pureFamily.map(m => m.name + (m.phone_number ? ` (${m.phone_number})` : '')).join(', '),
        'Friends Count': friends.length,
        'Friends': friends.map(f => f.name).join(', '),
      };
    });

    exportTableToExcel(
      exportData,
      `Registered_Devotees_Directory`,
      'Devotees'
    );

    showToast({
      type: 'success',
      title: 'Directory Exported',
      message: 'Devotee directory exported to Excel.',
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-28">
      {/* 1. Admin Header & Quick Metrics */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-3xl bg-slate-900 text-white shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Admin Control Center
            </h1>
            <Badge variant="success" size="sm" className="ml-1">
              Active Mode
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Master control for {devotees.length} devotees • Closes: {getCutoffFormattedDate(activeMonth)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => exportToExcel(activeMonth, allDevoteeSummaries, prasadamCounts, expenses)}
            variant="secondary"
            size="sm"
            className="text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-emerald-500" />
            <span>Excel (.xlsx)</span>
          </Button>

          <Button
            onClick={() => exportToPDF(activeMonth, allDevoteeSummaries, expenses)}
            variant="secondary"
            size="sm"
            className="text-xs font-bold"
          >
            <Download className="w-3.5 h-3.5 mr-1 text-rose-500" />
            <span>PDF Statement</span>
          </Button>

          <Button
            onClick={logoutAdmin}
            variant="outline"
            size="sm"
            className="text-xs text-slate-300 border-slate-700 hover:bg-slate-800"
          >
            <Lock className="w-3.5 h-3.5 mr-1" />
            <span>Lock Admin</span>
          </Button>
        </div>
      </div>

      {/* 2. Top Aggregate Financial Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Total Prasadam Cost
          </span>
          <div className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white mt-0.5">
            {formatRupee(totalPrasadamCost)}
          </div>
          <span className="text-[10px] text-slate-400">Community Meal Total</span>
        </Card>

        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Approved Expenses
          </span>
          <div className="text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {formatRupee(totalApprovedExpenses)}
            {totalCommunityPendingExpenses > 0 && '*'}
          </div>
          <span className="text-[10px] text-slate-400">
            {totalCommunityPendingExpenses > 0
              ? `* Includes ${formatRupee(totalCommunityPendingExpenses)} pending approval`
              : 'Regular Seva Purchases'}
          </span>
        </Card>

        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Net Receivable
          </span>
          <div className="text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 mt-0.5">
            {formatRupee(totalPendingReceivable)}
          </div>
          <span className="text-[10px] text-slate-400">Devotees owe GNH</span>
        </Card>

        <Card className="p-4 border border-slate-200 dark:border-slate-800">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            Net Payable (Surplus)
          </span>
          <div className="text-xl sm:text-2xl font-bold text-blue-600 dark:text-blue-400 mt-0.5">
            {formatRupee(totalPendingPayable)}
          </div>
          <span className="text-[10px] text-slate-400">GNH owes Devotees</span>
        </Card>
      </div>

      {/* 3. Sub-Navigation Tabs inside Admin */}
      <div className="flex overflow-x-auto p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl gap-1">
        {[
          { id: 'matrix', label: 'Global Matrix', icon: Users, badge: devotees.length },
          {
            id: 'expenses',
            label: 'Expenses',
            icon: Receipt,
            badge: regularExpenses.length + janmashtamiExpenses.length,
            pendingBadge: pendingRegularCount + pendingJanmashtamiCount,
          },
          { id: 'settlement', label: 'Settlements', icon: IndianRupee, badge: pendingSettlementSummaries.length },
          { id: 'whatsapp', label: 'WhatsApp Reminders', icon: Send, badge: allDevoteeSummaries.filter(s => s.unfilled_days > 0).length },
          { id: 'devotees', label: 'Devotee Roster', icon: Edit },
          { id: 'settings', label: 'Settings & DB', icon: Settings },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive =
            activeAdminTab === tab.id ||
            (tab.id === 'expenses' && (activeAdminTab === 'regular-expenses' || activeAdminTab === 'janmashtami-expenses'));
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveAdminTab(tab.id as AdminTab);
                if (tab.id === 'expenses') {
                  setExpenseSubcategory('REGULAR');
                }
              }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${isActive ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300' : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'}`}>
                  {tab.badge}
                </span>
              )}
              {tab.pendingBadge !== undefined && tab.pendingBadge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white animate-pulse" title={`${tab.pendingBadge} pending approval`}>
                  {tab.pendingBadge} pending
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Search Bar for Views */}
      {(activeAdminTab === 'matrix' || activeAdminTab === 'whatsapp' || activeAdminTab === 'devotees' || activeAdminTab === 'expenses' || activeAdminTab === 'regular-expenses' || activeAdminTab === 'janmashtami-expenses') && (
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={
              activeAdminTab === 'expenses'
                ? `Search ${expenseSubcategory === 'REGULAR' ? 'regular' : 'Janmashtami'} expenses by title, payer, or notes...`
                : activeAdminTab === 'regular-expenses'
                ? "Search regular expenses by title, payer, or notes..."
                : activeAdminTab === 'janmashtami-expenses'
                ? "Search Janmashtami expenses by title, payer, or notes..."
                : "Search by devotee name, phone, or member..."
            }
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-500 outline-none shadow-sm"
          />
        </div>
      )}

      {/* TAB 1: GLOBAL DEVOTEE MATRIX */}
      {activeAdminTab === 'matrix' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Master Devotee Ledger ({filteredSummaries.length} devotees)
              </h3>
              <p className="text-xs text-slate-400">
                Click on any devotee name to view their personal ledger page directly.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportMasterLedger}
                variant="outline"
                size="sm"
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                title="Export currently sorted master ledger to Excel"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                <span>Export Table (.xlsx)</span>
              </Button>

              <Button
                onClick={handleTriggerAutoFillAll}
                variant="secondary"
                size="sm"
                className="text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1 text-amber-500" />
                <span>Auto-Fill All Blank Days</span>
              </Button>

              <Button
                onClick={handleCarryOverToNextMonth}
                variant="secondary"
                size="sm"
                className="text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1 text-blue-500" />
                <span>Carry Over Balances to Next Month</span>
              </Button>
            </div>
          </div>

          <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <SortableHeader
                      label="Devotee (Click to View)"
                      sortKey="group_name"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                    />
                    <SortableHeader
                      label="Phone"
                      sortKey="phone_number"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                    />
                    <SortableHeader
                      label="Meals"
                      sortKey="total_meals"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                      align="center"
                    />
                    <SortableHeader
                      label="Meals Cost"
                      sortKey="meals_cost"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Community Cost"
                      sortKey="community_cost"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Total Prasadam"
                      sortKey="prasadam_cost"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Expenses"
                      sortKey="approved_expenses"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Carry Fwd"
                      sortKey="carried_forward"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Final Balance"
                      sortKey="final_balance"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Status"
                      sortKey="settlement_status"
                      currentSortKey={matrixSortConfig?.key}
                      currentDirection={matrixSortConfig?.direction}
                      onSort={requestMatrixSort}
                      align="center"
                    />
                    <SortableHeader
                      label="Actions"
                      align="center"
                    />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                  {sortedSummaries.map(s => {
                    const displayName = formatDevoteeName(s.devotee);
                    const hasMultiple = s.devotee.family_members && s.devotee.family_members.length > 1;

                    return (
                      <tr key={s.devotee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3">
                          <button
                            type="button"
                            onClick={() => selectDevoteeAndRedirect(s.devotee, 'reports')}
                            className="text-left font-bold text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 group"
                            title="Open user's page"
                          >
                            <span>{displayName}</span>
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          {hasMultiple && (
                            <div className="text-[10px] text-slate-400">
                              {formatDevoteeFamilyDisplay(s.devotee, true)}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300">
                          {s.devotee.phone_number}
                        </td>
                        <td className="py-3 px-3 text-center font-bold">
                          {s.total_meals}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                          {formatRupee(s.meals_cost)}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-600 dark:text-slate-300">
                          {formatRupee(s.community_cost)}
                          <span className="text-[10px] text-slate-400 block">({s.family_member_count}m × ₹{s.community_cost_per_member})</span>
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white">
                          {formatRupee(s.prasadam_cost)}
                        </td>
                        <td className="py-3 px-3 text-right font-bold text-emerald-600 dark:text-emerald-400">
                          {formatRupee(s.approved_expenses)}
                          {s.has_pending_expenses && '*'}
                        </td>
                        <td className="py-3 px-3 text-right font-mono">
                          <button
                            type="button"
                            onClick={() => handleOpenEditCarryForward(s)}
                            className="inline-flex items-center gap-1 hover:underline text-slate-800 dark:text-slate-200 font-mono hover:text-amber-600 dark:hover:text-amber-400 group cursor-pointer"
                            title="Click to adjust Carry Forward"
                          >
                            <span>{formatRupee(s.carried_forward)}</span>
                            <Edit className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        </td>
                        <td className="py-3 px-3 text-right font-extrabold text-sm">
                          <span
                            className={
                              s.final_balance > 0
                                ? 'text-rose-600 dark:text-rose-400'
                                : s.final_balance < 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-slate-400'
                            }
                          >
                            {formatRupee(s.final_balance)}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          {s.settlement_status === 'SETTLED' ? (
                            <Badge variant="success" size="sm">Settled</Badge>
                          ) : s.settlement_status === 'PENDING_VERIFICATION' ? (
                            <Badge variant="warning" size="sm">Pending Approval</Badge>
                          ) : (
                            <Badge variant="outline" size="sm">Unsettled</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <Button
                              onClick={() => setSelectedDevoteeForEdit(s.devotee)}
                              variant="ghost"
                              size="sm"
                              className="text-[11px] py-1 px-2 text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                              title="Edit Daily Matrix"
                            >
                              <Edit className="w-3.5 h-3.5 mr-1" />
                              <span>Matrix</span>
                            </Button>

                            <Button
                              onClick={() => handleOpenDirectSettle(s)}
                              variant="ghost"
                              size="sm"
                              className="text-[11px] py-1 px-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                              title="Direct Settle"
                            >
                              <IndianRupee className="w-3.5 h-3.5 mr-1" />
                              <span>Settle</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footnote for assumed approved pending expenses */}
            {allDevoteeSummaries.some(s => s.has_pending_expenses) && (
              <div className="p-3 bg-amber-500/10 border-t border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  * Note: Amounts with an asterisk include pending expenses assumed as approved, subject to Admin verification.
                </span>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* TAB 2: UNIFIED EXPENSES CATEGORY (WITH REGULAR & JANMASHTAMI SUBCATEGORIES) */}
      {(activeAdminTab === 'expenses' || activeAdminTab === 'regular-expenses' || activeAdminTab === 'janmashtami-expenses') && (
        <div className="space-y-4">
          {/* Subcategory Toggle & Context Month Notice */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-500" />
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Expenses Management
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1">
                <Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span>
                  {expenseSubcategory === 'REGULAR' ? (
                    <>Showing regular expenses for <strong className="text-slate-700 dark:text-slate-300 font-bold">{formatMonthName(activeMonth)}</strong> (filtered by Date of Expense).</>
                  ) : (
                    <>Showing <strong className="text-slate-700 dark:text-slate-300 font-bold">All-Time</strong> Sri Krishna Janmashtami expenses (cumulative festival ledger across all dates, not categorized by month).</>
                  )}
                </span>
              </div>
            </div>

            {/* Subcategory Tabs: Regular vs Janmashtami */}
            <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-800 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setExpenseSubcategory('REGULAR')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  expenseSubcategory === 'REGULAR'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Regular Expenses</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  expenseSubcategory === 'REGULAR'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {regularExpenses.length}
                </span>
                {pendingRegularCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white animate-pulse">
                    {pendingRegularCount} pending
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setExpenseSubcategory('JANMASHTAMI')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  expenseSubcategory === 'JANMASHTAMI'
                    ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Janmashtami Expenses</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  expenseSubcategory === 'JANMASHTAMI'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                }`}>
                  {janmashtamiExpenses.length}
                </span>
                {pendingJanmashtamiCount > 0 && (
                  <span className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-amber-500 text-white animate-pulse">
                    {pendingJanmashtamiCount} pending
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* SUBCATEGORY 1: REGULAR EXPENSES */}
          {expenseSubcategory === 'REGULAR' && (
            <div className="space-y-4">
              {/* Summary Mini-Cards for Regular Expenses */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Regular Seva</span>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                    {formatRupee(totalRegularAmount)}
                  </div>
                  <span className="text-[10px] text-slate-500">{regularExpenses.length} total bills</span>
                </Card>

                <Card className="p-3.5 border border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Offsets</span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                    {formatRupee(approvedRegularAmount)}
                  </div>
                  <span className="text-[10px] text-slate-500">Offsets prasadam bills</span>
                </Card>

                <Card className="p-3.5 border border-slate-200 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Verification</span>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                    {formatRupee(pendingRegularAmount)}
                  </div>
                  <span className="text-[10px] text-slate-500">{pendingRegularCount} awaiting approval</span>
                </Card>

                <Card className="p-3.5 border border-slate-200 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-950/20">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</span>
                  <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
                    {formatRupee(rejectedRegularAmount)}
                  </div>
                  <span className="text-[10px] text-slate-500">{regularExpenses.filter(e => e.status === 'REJECTED').length} rejected</span>
                </Card>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-amber-500" />
                    <span>Regular Expenses Review ({filteredRegularExpenses.length})</span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Monthly groceries, vegetables, and cooking items offsetting prasadam bills.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={handleExportRegularExpenses}
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 py-1 px-2.5 h-auto"
                    title="Export currently filtered and sorted regular expenses to Excel"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                    <span>Export Regular Expenses (.xlsx)</span>
                  </Button>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setRegularStatusFilter(status)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          regularStatusFilter === status
                            ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {status}
                        {status === 'PENDING' && pendingRegularCount > 0 && (
                          <span className="ml-1 px-1 py-0.2 rounded-full text-[9px] bg-amber-500 text-white">
                            {pendingRegularCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b">
                      <tr>
                        <SortableHeader
                          label="Expense Date"
                          sortKey="date"
                          currentSortKey={regularSortConfig?.key}
                          currentDirection={regularSortConfig?.direction}
                          onSort={requestRegularSort}
                        />
                        <SortableHeader
                          label="Submitted At"
                          sortKey="created_at"
                          currentSortKey={regularSortConfig?.key}
                          currentDirection={regularSortConfig?.direction}
                          onSort={requestRegularSort}
                        />
                        <SortableHeader
                          label="Item / Description"
                          sortKey="title"
                          currentSortKey={regularSortConfig?.key}
                          currentDirection={regularSortConfig?.direction}
                          onSort={requestRegularSort}
                        />
                        <SortableHeader
                          label="Payer / Devotee"
                          sortKey="payer_name"
                          currentSortKey={regularSortConfig?.key}
                          currentDirection={regularSortConfig?.direction}
                          onSort={requestRegularSort}
                        />
                        <SortableHeader
                          label="Amount"
                          sortKey="amount"
                          currentSortKey={regularSortConfig?.key}
                          currentDirection={regularSortConfig?.direction}
                          onSort={requestRegularSort}
                          align="right"
                        />
                        <SortableHeader
                          label="Receipt"
                          align="center"
                        />
                        <SortableHeader
                          label="Status"
                          sortKey="status"
                          currentSortKey={regularSortConfig?.key}
                          currentDirection={regularSortConfig?.direction}
                          onSort={requestRegularSort}
                          align="center"
                        />
                        <SortableHeader
                          label="Action"
                          align="center"
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {sortedRegularExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No regular expenses found matching current filter for {formatMonthName(activeMonth)}.
                          </td>
                        </tr>
                      ) : (
                        sortedRegularExpenses.map(exp => {
                          const devotee = devotees.find(d => d.id === exp.devotee_id);
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
                                  <div className="text-[10px] text-slate-400">{exp.comments}</div>
                                )}
                                {exp.rejection_reason && (
                                  <div className="text-[10px] text-rose-500 font-semibold">
                                    Reason: {exp.rejection_reason}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                  {exp.payer_name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {devotee ? formatDevoteeName(devotee) : (exp.guest_name ? `Guest: ${exp.guest_name}` : '-')}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                                {formatRupee(exp.amount)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {exp.bill_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setAdminViewingReceiptUrl(exp.bill_url!)}
                                    className="text-amber-600 dark:text-amber-400 hover:underline font-bold inline-flex items-center gap-1 text-xs"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View ({parseReceiptUrls(exp.bill_url).length})</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge
                                  variant={exp.status === 'APPROVED' ? 'success' : exp.status === 'PENDING' ? 'warning' : 'danger'}
                                  size="sm"
                                >
                                  {exp.status === 'PENDING' ? 'Pending' : exp.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center">
                                {exp.status === 'PENDING' ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      onClick={() => reviewExpense(exp.id, 'APPROVED')}
                                      variant="secondary"
                                      size="sm"
                                      className="text-[10px] py-1 px-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold"
                                      title="Approve expense"
                                    >
                                      <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                      <span>Approve</span>
                                    </Button>
                                    <Button
                                      onClick={() => setRejectingExpense(exp)}
                                      variant="danger"
                                      size="sm"
                                      className="text-[10px] py-1 px-2.5 font-bold"
                                      title="Reject expense"
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      <span>Reject</span>
                                    </Button>
                                  </div>
                                ) : exp.status === 'APPROVED' ? (
                                  <Button
                                    onClick={() => setRejectingExpense(exp)}
                                    variant="danger"
                                    size="sm"
                                    className="text-[10px] py-1 px-2.5 font-bold"
                                    title="Reject expense"
                                  >
                                    <span>Reject</span>
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => reviewExpense(exp.id, 'APPROVED')}
                                    variant="secondary"
                                    size="sm"
                                    className="text-[10px] py-1 px-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold"
                                    title="Re-approve expense"
                                  >
                                    <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                    <span>Re-Approve</span>
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {pendingRegularCount > 0 && (
                  <div className="p-3 bg-amber-500/10 border-t border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      * Note: {pendingRegularCount} pending expense(s) totaling {formatRupee(pendingRegularAmount)} are assumed as approved in calculations until reviewed by Admin.
                    </span>
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* SUBCATEGORY 2: JANMASHTAMI EXPENSES */}
          {expenseSubcategory === 'JANMASHTAMI' && (
            <div className="space-y-4">
              {/* Summary Mini-Cards for Janmashtami */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Card className="p-3.5 border border-amber-200/80 dark:border-amber-800/60 bg-amber-500/5">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Total Festival Seva</span>
                  <div className="text-lg font-black text-slate-900 dark:text-white mt-0.5 font-mono">
                    {formatRupee(totalJanmashtamiAmount)}
                  </div>
                  <span className="text-[10px] text-slate-500">{janmashtamiExpenses.length} festival items</span>
                </Card>

                <Card className="p-3.5 border border-slate-200 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Approved Festival Seva</span>
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                    {formatRupee(approvedJanmashtamiAmount)}
                  </div>
                  <span className="text-[10px] text-slate-500">Decor, flowers & deity seva</span>
                </Card>

                <Card className="p-3.5 border border-slate-200 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Pending Verification</span>
                  <div className="text-lg font-black text-amber-600 dark:text-amber-400 mt-0.5 font-mono">
                    {formatRupee(pendingJanmashtamiAmount)}
                  </div>
                  <span className="text-[10px] text-slate-500">{pendingJanmashtamiCount} awaiting approval</span>
                </Card>

                <Card className="p-3.5 border border-slate-200 dark:border-slate-800 bg-rose-50/50 dark:bg-rose-950/20">
                  <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Rejected</span>
                  <div className="text-lg font-black text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
                    {formatRupee(rejectedJanmashtamiAmount)}
                  </div>
                  <span className="text-[10px] text-slate-500">{janmashtamiExpenses.filter(e => e.status === 'REJECTED').length} rejected</span>
                </Card>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>Special Festival Expenses ({filteredJanmashtamiExpenses.length})</span>
                    <Badge variant="saffron" size="sm" className="text-[10px]">All Time</Badge>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Festival purchases and seva sponsorships for Prabhupada Appearance Day & Janmashtami (all-time isolated accounts).
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Festival Selector Pills */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => setFestivalTypeFilter('ALL')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                        festivalTypeFilter === 'ALL'
                          ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      All Festivals
                    </button>
                    <button
                      type="button"
                      onClick={() => setFestivalTypeFilter('PRABHUPADA_APPEARANCE')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        festivalTypeFilter === 'PRABHUPADA_APPEARANCE'
                          ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <Crown className="w-3 h-3" />
                      <span>Appearance Day</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFestivalTypeFilter('JANMASHTAMI')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                        festivalTypeFilter === 'JANMASHTAMI'
                          ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                      }`}
                    >
                      <span>Janmashtami</span>
                    </button>
                  </div>

                  <Button
                    onClick={handleExportJanmashtamiExpenses}
                    variant="outline"
                    size="sm"
                    className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 py-1 px-2.5 h-auto"
                    title="Export currently filtered and sorted festival expenses to Excel"
                  >
                    <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                    <span>Export Excel (.xlsx)</span>
                  </Button>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
                    {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setJanmashtamiStatusFilter(status)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                          janmashtamiStatusFilter === status
                            ? 'bg-white dark:bg-slate-700 text-amber-600 dark:text-amber-400 shadow-xs'
                            : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                        }`}
                      >
                        {status}
                        {status === 'PENDING' && pendingJanmashtamiCount > 0 && (
                          <span className="ml-1 px-1 py-0.2 rounded-full text-[9px] bg-amber-500 text-white">
                            {pendingJanmashtamiCount}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <Card className="overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b">
                      <tr>
                        <SortableHeader
                          label="Expense Date"
                          sortKey="date"
                          currentSortKey={janmashtamiSortConfig?.key}
                          currentDirection={janmashtamiSortConfig?.direction}
                          onSort={requestJanmashtamiSort}
                        />
                        <SortableHeader
                          label="Submitted At"
                          sortKey="created_at"
                          currentSortKey={janmashtamiSortConfig?.key}
                          currentDirection={janmashtamiSortConfig?.direction}
                          onSort={requestJanmashtamiSort}
                        />
                        <SortableHeader
                          label="Item / Description"
                          sortKey="title"
                          currentSortKey={janmashtamiSortConfig?.key}
                          currentDirection={janmashtamiSortConfig?.direction}
                          onSort={requestJanmashtamiSort}
                        />
                        <SortableHeader
                          label="Payer / Devotee"
                          sortKey="payer_name"
                          currentSortKey={janmashtamiSortConfig?.key}
                          currentDirection={janmashtamiSortConfig?.direction}
                          onSort={requestJanmashtamiSort}
                        />
                        <SortableHeader
                          label="Amount"
                          sortKey="amount"
                          currentSortKey={janmashtamiSortConfig?.key}
                          currentDirection={janmashtamiSortConfig?.direction}
                          onSort={requestJanmashtamiSort}
                          align="right"
                        />
                        <SortableHeader
                          label="Receipt"
                          align="center"
                        />
                        <SortableHeader
                          label="Status"
                          sortKey="status"
                          currentSortKey={janmashtamiSortConfig?.key}
                          currentDirection={janmashtamiSortConfig?.direction}
                          onSort={requestJanmashtamiSort}
                          align="center"
                        />
                        <SortableHeader
                          label="Action"
                          align="center"
                        />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                      {sortedJanmashtamiExpenses.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            No Janmashtami festival expenses found matching current filter (All Time).
                          </td>
                        </tr>
                      ) : (
                        sortedJanmashtamiExpenses.map(exp => {
                          const devotee = devotees.find(d => d.id === exp.devotee_id);
                          return (
                            <tr key={exp.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-3 px-3 text-slate-700 dark:text-slate-300 font-mono font-medium">
                                {formatExpenseDate(exp.date || exp.created_at)}
                              </td>
                              <td className="py-3 px-3 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                                {formatSubmissionDateTime(exp.created_at)}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span>{exp.title}</span>
                                  {exp.type === 'PRABHUPADA_APPEARANCE' ? (
                                    <Badge variant="saffron" size="sm" className="text-[9px] px-1 py-0 flex items-center gap-0.5">
                                      <Crown className="w-2.5 h-2.5" /> Appearance Day
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" size="sm" className="text-[9px] px-1 py-0">Janmashtami</Badge>
                                  )}
                                </div>
                                {exp.comments && (
                                  <div className="text-[10px] text-slate-400">{exp.comments}</div>
                                )}
                                {exp.rejection_reason && (
                                  <div className="text-[10px] text-rose-500 font-semibold">
                                    Reason: {exp.rejection_reason}
                                  </div>
                                )}
                              </td>
                              <td className="py-3 px-3">
                                <div className="font-bold text-slate-800 dark:text-slate-200">
                                  {exp.payer_name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {devotee ? formatDevoteeName(devotee) : (exp.guest_name ? `Guest: ${exp.guest_name}` : '-')}
                                </div>
                              </td>
                              <td className="py-3 px-3 text-right font-bold text-slate-900 dark:text-white font-mono">
                                {formatRupee(exp.amount)}
                              </td>
                              <td className="py-3 px-3 text-center">
                                {exp.bill_url ? (
                                  <button
                                    type="button"
                                    onClick={() => setAdminViewingReceiptUrl(exp.bill_url!)}
                                    className="text-amber-600 dark:text-amber-400 hover:underline font-bold inline-flex items-center gap-1 text-xs"
                                  >
                                    <Eye className="w-3.5 h-3.5" />
                                    <span>View ({parseReceiptUrls(exp.bill_url).length})</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-400">-</span>
                                )}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <Badge
                                  variant={exp.status === 'APPROVED' ? 'success' : exp.status === 'PENDING' ? 'warning' : 'danger'}
                                  size="sm"
                                >
                                  {exp.status === 'PENDING' ? 'Pending' : exp.status}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-center">
                                {exp.status === 'PENDING' ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <Button
                                      onClick={() => reviewExpense(exp.id, 'APPROVED')}
                                      variant="secondary"
                                      size="sm"
                                      className="text-[10px] py-1 px-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold"
                                      title="Approve expense"
                                    >
                                      <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                      <span>Approve</span>
                                    </Button>
                                    <Button
                                      onClick={() => setRejectingExpense(exp)}
                                      variant="danger"
                                      size="sm"
                                      className="text-[10px] py-1 px-2.5 font-bold"
                                      title="Reject expense"
                                    >
                                      <X className="w-3 h-3 mr-1" />
                                      <span>Reject</span>
                                    </Button>
                                  </div>
                                ) : exp.status === 'APPROVED' ? (
                                  <Button
                                    onClick={() => setRejectingExpense(exp)}
                                    variant="danger"
                                    size="sm"
                                    className="text-[10px] py-1 px-2.5 font-bold"
                                    title="Reject expense"
                                  >
                                    <span>Reject</span>
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={() => reviewExpense(exp.id, 'APPROVED')}
                                    variant="secondary"
                                    size="sm"
                                    className="text-[10px] py-1 px-2.5 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 font-bold"
                                    title="Re-approve expense"
                                  >
                                    <Check className="w-3 h-3 mr-1 text-emerald-600" />
                                    <span>Re-Approve</span>
                                  </Button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                {pendingJanmashtamiCount > 0 && (
                  <div className="p-3 bg-amber-500/10 border-t border-amber-500/20 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      * Note: {pendingJanmashtamiCount} pending Janmashtami expense(s) totaling {formatRupee(pendingJanmashtamiAmount)} are awaiting Admin verification.
                    </span>
                  </div>
                )}
              </Card>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SETTLEMENT ENGINE */}
      {activeAdminTab === 'settlement' && (
        <div className="space-y-6">
          {/* Section 1: Pending Settlement Requests */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Pending Devotee Settlement Requests ({pendingSettlementSummaries.length})
                </h3>
                <p className="text-xs text-slate-400">
                  Payments reported by devotees awaiting administrator verification.
                </p>
              </div>
            </div>

            {pendingSettlementSummaries.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingSettlementSummaries.map(s => (
                  <Card key={s.devotee.id} className="p-4 border-2 border-amber-500/40 bg-amber-50/20 dark:bg-amber-950/20 shadow-xs">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-base text-slate-900 dark:text-white">
                          {formatDevoteeName(s.devotee)}
                        </h4>
                        <p className="text-xs text-slate-500 font-mono">📱 +91 {s.devotee.phone_number}</p>
                      </div>
                      <Badge variant="warning">Verification Pending</Badge>
                    </div>

                    <div className="my-3 p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex justify-between items-center text-xs">
                      <div>
                        <div className="text-slate-400 font-medium">Reported Paid Amount:</div>
                        <div className="text-xl font-extrabold text-purple-600 dark:text-purple-400 mt-0.5">
                          {formatRupee(s.settlement_reported)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-slate-400 font-medium">Payment Date:</div>
                        <div className="font-bold text-slate-700 dark:text-slate-200 mt-0.5">
                          {s.settlement_date_reported || 'Today'}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={() => adminVerifySettlement(s.devotee.id, s.settlement_reported, s.settlement_date_reported || new Date().toISOString().slice(0, 10), 'Verified & Approved')}
                        variant="saffron"
                        size="sm"
                        className="flex-1 text-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        <span>Verify & Settle</span>
                      </Button>

                      <Button
                        onClick={() => handleOpenDirectSettle(s)}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        title="Edit Amount / Date"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        <span>Edit</span>
                      </Button>

                      <Button
                        onClick={() => {
                          if (confirm(`Reject/Reset settlement request for ${formatDevoteeName(s.devotee)}?`)) {
                            adminResetSettlement(s.devotee.id);
                          }
                        }}
                        variant="ghost"
                        size="sm"
                        className="text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        title="Reject & Revert to Unsettled"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" />
                        <span>Reset</span>
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-6 text-center text-xs text-slate-400 border border-dashed">
                ✨ No pending settlement verification requests at this time.
              </Card>
            )}
          </div>

          {/* Section 2: All Devotees Settlement Master Ledger */}
          <div className="pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Devotee Settlements Master Ledger ({formatMonthName(activeMonth)})
                </h3>
                <p className="text-xs text-slate-400">
                  Directly record payments, adjust settlements, or verify balances for any devotee group.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  onClick={handleExportSettlementTable}
                  variant="outline"
                  size="sm"
                  className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 py-1 px-2.5 h-auto"
                  title="Export currently filtered and sorted settlement records to Excel"
                >
                  <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                  <span>Export Settlement Table (.xlsx)</span>
                </Button>

                {/* Status Filter Tabs */}
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setSettlementFilter('ALL')}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors ${settlementFilter === 'ALL' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    All ({allDevoteeSummaries.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementFilter('PENDING')}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors ${settlementFilter === 'PENDING' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    Pending ({allDevoteeSummaries.filter(s => s.settlement_status === 'PENDING_VERIFICATION').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementFilter('SETTLED')}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors ${settlementFilter === 'SETTLED' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    Settled ({allDevoteeSummaries.filter(s => s.settlement_status === 'SETTLED').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettlementFilter('UNSETTLED')}
                    className={`px-2.5 py-1.5 rounded-lg transition-colors ${settlementFilter === 'UNSETTLED' ? 'bg-rose-500 text-white shadow-xs' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                  >
                    Unsettled ({allDevoteeSummaries.filter(s => s.settlement_status === 'UNSETTLED').length})
                  </button>
                </div>
              </div>
            </div>

            <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <SortableHeader
                        label="Devotee Group"
                        sortKey="group_name"
                        currentSortKey={settlementSortConfig?.key}
                        currentDirection={settlementSortConfig?.direction}
                        onSort={requestSettlementSort}
                      />
                      <SortableHeader
                        label="Phone"
                        sortKey="phone_number"
                        currentSortKey={settlementSortConfig?.key}
                        currentDirection={settlementSortConfig?.direction}
                        onSort={requestSettlementSort}
                      />
                      <SortableHeader
                        label="Prasadam Cost"
                        sortKey="prasadam_cost"
                        currentSortKey={settlementSortConfig?.key}
                        currentDirection={settlementSortConfig?.direction}
                        onSort={requestSettlementSort}
                        align="right"
                      />
                      <SortableHeader
                        label="Expenses"
                        sortKey="approved_expenses"
                        currentSortKey={settlementSortConfig?.key}
                        currentDirection={settlementSortConfig?.direction}
                        onSort={requestSettlementSort}
                        align="right"
                      />
                      <SortableHeader
                        label="Carry Fwd"
                        sortKey="carried_forward"
                        currentSortKey={settlementSortConfig?.key}
                        currentDirection={settlementSortConfig?.direction}
                        onSort={requestSettlementSort}
                        align="right"
                      />
                      <SortableHeader
                        label="Payment Recorded"
                        sortKey="settlement_reported"
                        currentSortKey={settlementSortConfig?.key}
                        currentDirection={settlementSortConfig?.direction}
                        onSort={requestSettlementSort}
                        align="right"
                      />
                      <SortableHeader
                        label="Settlement Status"
                        sortKey="settlement_status"
                        currentSortKey={settlementSortConfig?.key}
                        currentDirection={settlementSortConfig?.direction}
                        onSort={requestSettlementSort}
                        align="center"
                      />
                      <SortableHeader
                        label="Final Balance"
                        sortKey="final_balance"
                        currentSortKey={settlementSortConfig?.key}
                        currentDirection={settlementSortConfig?.direction}
                        onSort={requestSettlementSort}
                        align="right"
                      />
                      <SortableHeader
                        label="Action"
                        align="center"
                      />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {sortedSettlementList.map(s => (
                        <tr key={s.devotee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="py-3 px-3 font-bold text-slate-900 dark:text-white">
                            {formatDevoteeName(s.devotee)}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-500">
                            {s.devotee.phone_number}
                          </td>
                          <td className="py-3 px-3 text-right font-medium">
                            {formatRupee(s.prasadam_cost)}
                          </td>
                          <td className="py-3 px-3 text-right text-emerald-600 dark:text-emerald-400 font-medium">
                            {formatRupee(s.approved_expenses)}
                          </td>
                          <td className="py-3 px-3 text-right font-mono">
                            <button
                              type="button"
                              onClick={() => handleOpenEditCarryForward(s)}
                              className="inline-flex items-center gap-1 hover:underline text-slate-800 dark:text-slate-200 font-mono hover:text-amber-600 dark:hover:text-amber-400 group cursor-pointer"
                              title="Click to adjust Carry Forward"
                            >
                              <span>{formatRupee(s.carried_forward)}</span>
                              <Edit className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </button>
                          </td>
                          <td className="py-3 px-3 text-right font-bold text-purple-600 dark:text-purple-400">
                            {formatRupee(s.settlement_reported)}
                            {s.settlement_date_reported && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {s.settlement_date_reported}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            {s.settlement_status === 'SETTLED' ? (
                              <Badge variant="success" size="sm">Settled</Badge>
                            ) : s.settlement_status === 'PENDING_VERIFICATION' ? (
                              <Badge variant="warning" size="sm">Pending</Badge>
                            ) : (
                              <Badge variant="outline" size="sm">Unsettled</Badge>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-extrabold text-sm">
                            <span
                              className={
                                s.final_balance > 0
                                  ? 'text-rose-600 dark:text-rose-400'
                                  : s.final_balance < 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-slate-400'
                              }
                            >
                              {formatRupee(s.final_balance)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                onClick={() => handleOpenDirectSettle(s)}
                                variant="saffron"
                                size="sm"
                                className="text-[11px] py-1 px-2.5"
                                title="Record Settlement"
                              >
                                <IndianRupee className="w-3.5 h-3.5 mr-1" />
                                <span>{s.settlement_status === 'SETTLED' ? 'Edit Settle' : 'Settle'}</span>
                              </Button>

                              {s.settlement_status !== 'UNSETTLED' && (
                                <Button
                                  onClick={() => {
                                    if (confirm(`Reset settlement to UNSETTLED for ${formatDevoteeName(s.devotee)}?`)) {
                                      adminResetSettlement(s.devotee.id);
                                    }
                                  }}
                                  variant="ghost"
                                  size="sm"
                                  className="text-[11px] py-1 px-1.5 text-slate-400 hover:text-rose-500"
                                  title="Reset to Unsettled"
                                >
                                  <RefreshCw className="w-3 h-3" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 4: WHATSAPP REMINDERS */}
      {activeAdminTab === 'whatsapp' && (
        <div className="space-y-5">
          {/* Header & Broadcast Message Template */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                WhatsApp Reminders & Broadcast
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Deadline: <span className="font-semibold text-amber-600 dark:text-amber-400">{getCutoffFormattedDate(activeMonth)}</span> (N-2 days of month).
              </p>
            </div>

            <Button
              onClick={() => {
                const broadcastText = generateCustomReminderMessage(activeMonth);
                navigator.clipboard.writeText(broadcastText);
                showToast({
                  type: 'success',
                  title: 'Template Copied!',
                  message: 'Broadcast message copied to clipboard.',
                });
              }}
              variant="outline"
              size="sm"
              className="text-xs font-bold self-start sm:self-auto border-emerald-500/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
            >
              <Copy className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              <span>Copy Broadcast Template</span>
            </Button>
          </div>

          {/* Template Preview Card */}
          <Card className="p-4 bg-slate-50/80 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl">
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Message Preview
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                Deadline: {getCutoffFormattedDate(activeMonth)}
              </span>
            </div>
            <pre className="text-xs font-sans text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {generateCustomReminderMessage(activeMonth, '<phoneNumber>')}
            </pre>
          </Card>

          {/* Devotee Reminder Cards */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Individual Devotee Reminders ({filteredSummaries.length})
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredSummaries.map(s => {
                const hasMissing = s.unfilled_days > 0;
                const waLink = generateWhatsAppLink(s);
                const devoteeName = formatDevoteeName(s.devotee);

                return (
                  <Card
                    key={s.devotee.id}
                    className={`p-4 border transition-all ${
                      hasMissing
                        ? 'border-amber-300 dark:border-amber-800/80 bg-amber-50/10'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-sm text-slate-900 dark:text-white">
                          {formatDevoteeName(s.devotee)}
                        </div>
                        <div className="text-xs text-slate-500 font-mono">
                          📱 +91 {s.devotee.phone_number}
                        </div>
                      </div>

                      {hasMissing ? (
                        <Badge variant="warning" size="sm">
                          {s.unfilled_days} Unfilled Days
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm">
                          All Days Filled
                        </Badge>
                      )}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Send WhatsApp Reminder</span>
                      </a>

                      <Button
                        onClick={() => {
                          const text = generateCustomReminderMessage(
                            activeMonth,
                            s.devotee.phone_number,
                            devoteeName
                          );
                          navigator.clipboard.writeText(text);
                          showToast({
                            type: 'success',
                            title: 'Copied Message',
                            message: `Copied personalized message for ${devoteeName}`,
                          });
                        }}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        title="Copy personalized text"
                      >
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        <span>Copy</span>
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: DEVOTEES & GUEST MANAGEMENT */}
      {activeAdminTab === 'devotees' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Registered Devotees ({devotees.length})
            </h3>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                onClick={handleExportDevoteesDirectory}
                variant="outline"
                size="sm"
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                title="Export complete devotee directory to Excel"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                <span>Export Devotees (.xlsx)</span>
              </Button>
              <Button
                onClick={() => handleOpenDevoteeModal()}
                variant="saffron"
                size="sm"
                className="text-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Add Devotee</span>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {devotees
              .filter(d => {
                if (!searchTerm.trim()) return true;
                const term = searchTerm.toLowerCase();
                const name = (d.group_name || '').toLowerCase();
                const phone = (d.phone_number || '').toLowerCase();
                const members = getFamilyMemberNames(d).join(' ').toLowerCase();
                return name.includes(term) || phone.includes(term) || members.includes(term);
              })
              .map(d => {
                const displayName = formatDevoteeName(d);
                const pureFamily = getPureFamilyMembers(d);
                const friends = getFriendMembers(d);
                const hasMultiple = d.family_members && d.family_members.length > 1;
                const activeGroupCost = typeof d.community_cost === 'number' ? d.community_cost : communityCostPerMember;

                return (
                  <Card key={d.id} className="p-4 border border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                          {displayName}
                        </span>
                        {d.is_admin && <Badge variant="saffron" size="sm">Admin</Badge>}
                      </div>
                      <div className="text-xs font-mono text-slate-500 mt-1">
                        📱 +91 {d.phone_number} • <span className="font-bold text-amber-600 dark:text-amber-400">₹{activeGroupCost}/member</span>
                      </div>
                      {hasMultiple && (
                        <div className="text-xs text-slate-600 dark:text-slate-400 mt-2 space-y-1">
                          <div><strong>Family ({pureFamily.length}):</strong> {pureFamily.map(m => m.name).join(', ') || displayName}</div>
                          {friends.length > 0 && (
                            <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                              <strong>Friends ({friends.length}):</strong> {friends.map(f => f.name).join(', ')}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1">
                      <Button
                        onClick={() => selectDevoteeAndRedirect(d, 'reports')}
                        variant="ghost"
                        size="sm"
                        className="text-xs py-1 px-2 text-slate-600 dark:text-slate-300"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        <span>View</span>
                      </Button>

                      <div className="flex items-center gap-1">
                        <Button
                          onClick={() => handleOpenDevoteeModal(d)}
                          variant="ghost"
                          size="sm"
                          className="text-xs py-1 px-2 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          <span>Edit</span>
                        </Button>

                        <Button
                          onClick={() => {
                            if (confirm(`Are you sure you want to remove devotee "${displayName}"?`)) {
                              deleteDevotee(d.id);
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          className="text-xs py-1 px-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          title="Delete Devotee"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </Card>
                );
              })}
          </div>
        </div>
      )}

      {/* TAB 6: SETTINGS & DATABASE */}
      {activeAdminTab === 'settings' && (
        <div className="max-w-2xl space-y-6">
          {/* Community Cost & Rate Settings */}
          <Card className="p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-1.5">
              <IndianRupee className="w-4 h-4 text-amber-500" />
              <span>Community Cost Per Family Member</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
              Fixed community cost levied to each registered devotee family member in monthly prasadam calculations. Current active rate: <strong className="text-amber-600 dark:text-amber-400 font-mono">₹{communityCostPerMember}</strong> / member (Default: ₹500).
            </p>
            <form onSubmit={handleUpdateCommunityCost} className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  step="10"
                  required
                  placeholder="e.g. 500"
                  value={communityCostInput}
                  onChange={e => setCommunityCostInput(e.target.value)}
                  className="w-full pl-8 pr-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold outline-none"
                />
              </div>
              <Button type="submit" variant="saffron" size="sm">
                Save Rate
              </Button>
            </form>
          </Card>

          {/* Admin PIN Changer */}
          <Card className="p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
              <Key className="w-4 h-4 text-amber-500" />
              <span>Change 6-Digit Admin PIN</span>
            </h4>
            <p className="text-xs text-slate-400 mb-3">
              Enter a new 6-digit numeric PIN to update administrative authorization.
            </p>
            <form onSubmit={handleUpdatePin} className="flex gap-2">
              <input
                type="password"
                maxLength={6}
                placeholder="New 6-Digit PIN"
                value={newPinInput}
                onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ''))}
                className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-mono tracking-widest outline-none"
              />
              <Button type="submit" variant="saffron" size="sm">
                Update PIN
              </Button>
            </form>
          </Card>

          {/* Environment & Data Source Status */}
          <Card className={`p-5 border ${isLocalMode ? 'border-amber-200 dark:border-amber-900/50 bg-amber-50/10' : 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/10'}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${isLocalMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    Data Environment: {isLocalMode ? 'Local Isolated Mode' : 'Production Supabase Cloud'}
                  </h4>
                  <Badge variant={isLocalMode ? 'saffron' : 'success'} size="sm">
                    {isLocalMode ? 'Local Storage (Dev)' : 'Cloud PostgreSQL (Live)'}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {isLocalMode
                    ? 'Operating in local developer mode. All devotees, prasadam counts, and expenses are saved exclusively in your local browser storage (gnh_local_*). Live Production data is safe and protected.'
                    : 'Connected to live Production Supabase database. Real-time updates are active.'}
                </p>
              </div>
            </div>
          </Card>

          {/* Database Reset & Seeding Tool */}
          <Card className="p-5 border border-rose-200 dark:border-rose-900 bg-rose-50/10">
            <h4 className="text-sm font-bold text-rose-600 dark:text-rose-400 flex items-center gap-2 mb-2">
              <Database className="w-4 h-4" />
              <span>{isLocalMode ? 'Reset Local Test Data to Seed Defaults' : 'Reset / Restore Initial Seed Data'}</span>
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {isLocalMode
                ? 'Restores the 14 Vaishnava devotees roster from seed configuration in your local storage and resets all local meal counts and expenses to zero.'
                : 'Restores the registered Vaishnava devotee roster from seed configuration and resets all meal counts and expenses to zero.'}
            </p>
            <Button
              onClick={() => {
                const msg = isLocalMode
                  ? 'Are you sure you want to reset local test data back to default seed roster?'
                  : 'Are you sure you want to reset data to defaults?';
                if (confirm(msg)) {
                  resetDatabase();
                  showToast({
                    type: 'success',
                    title: 'Database Reset',
                    message: isLocalMode ? 'Local test data reset to initial seed defaults.' : 'Database reset to seed defaults.',
                  });
                }
              }}
              variant="danger"
              size="sm"
            >
              <Trash2 className="w-3.5 h-3.5 mr-1" />
              <span>{isLocalMode ? 'Reset Local Data to Defaults' : 'Reset Database to Defaults'}</span>
            </Button>
          </Card>
        </div>
      )}

      {/* DEVOTEE INLINE MATRIX MODAL (ADMIN OVERRIDE) */}
      <Modal
        isOpen={Boolean(selectedDevoteeForEdit)}
        onClose={() => setSelectedDevoteeForEdit(null)}
        title={`Admin Override: ${selectedDevoteeForEdit ? formatDevoteeName(selectedDevoteeForEdit) : ''}`}
        description="Inline meal count editor. Admin edits bypass all closure lock restrictions."
        maxWidth="3xl"
      >
        {selectedDevoteeForEdit && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="text-xs text-slate-500">
                Primary Phone: {selectedDevoteeForEdit.phone_number} {selectedDevoteeForEdit.family_members.length > 1 ? `• Family: ${formatDevoteeFamilyDisplay(selectedDevoteeForEdit, true)}` : ''}
              </div>
              <Button
                type="button"
                onClick={handleExportDevoteeDailyMeals}
                variant="outline"
                size="sm"
                className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 py-1 px-2.5 h-auto self-start sm:self-auto"
                title="Export this devotee's meal counts for the month"
              >
                <Download className="w-3.5 h-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                <span>Export (.xlsx)</span>
              </Button>
            </div>

            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 font-bold border-b z-10">
                <tr>
                  <SortableHeader
                    label="Date"
                    sortKey="dateStr"
                    currentSortKey={modalSortConfig?.key}
                    currentDirection={modalSortConfig?.direction}
                    onSort={requestModalSort}
                    className="py-2 px-2"
                  />
                  <SortableHeader
                    label="B (₹40)"
                    sortKey="b"
                    currentSortKey={modalSortConfig?.key}
                    currentDirection={modalSortConfig?.direction}
                    onSort={requestModalSort}
                    align="center"
                    className="py-2 px-2"
                  />
                  <SortableHeader
                    label="L (₹80)"
                    sortKey="l"
                    currentSortKey={modalSortConfig?.key}
                    currentDirection={modalSortConfig?.direction}
                    onSort={requestModalSort}
                    align="center"
                    className="py-2 px-2"
                  />
                  <SortableHeader
                    label="D (₹40)"
                    sortKey="d"
                    currentSortKey={modalSortConfig?.key}
                    currentDirection={modalSortConfig?.direction}
                    onSort={requestModalSort}
                    align="center"
                    className="py-2 px-2"
                  />
                  <SortableHeader
                    label="Day Cost"
                    sortKey="cost"
                    currentSortKey={modalSortConfig?.key}
                    currentDirection={modalSortConfig?.direction}
                    onSort={requestModalSort}
                    align="right"
                    className="py-2 px-2"
                  />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedDevoteeDailyEntries.map(({ dateStr, b, l, d, cost, entry }) => {
                  return (
                    <tr key={dateStr}>
                      <td className="py-1.5 px-2 font-mono font-bold">{dateStr.slice(8)} {new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short' })}</td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={b === 0 ? '' : b}
                          placeholder="0"
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            updatePrasadamCount({
                              id: entry?.id,
                              devotee_id: selectedDevoteeForEdit.id,
                              date: dateStr,
                              breakfast_count: val,
                              lunch_count: l,
                              dinner_count: d,
                              is_auto_filled: false,
                            });
                          }}
                          className="w-12 text-center py-1 bg-slate-50 dark:bg-slate-800 border rounded font-bold"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={l === 0 ? '' : l}
                          placeholder="0"
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            updatePrasadamCount({
                              id: entry?.id,
                              devotee_id: selectedDevoteeForEdit.id,
                              date: dateStr,
                              breakfast_count: b,
                              lunch_count: val,
                              dinner_count: d,
                              is_auto_filled: false,
                            });
                          }}
                          className="w-12 text-center py-1 bg-slate-50 dark:bg-slate-800 border rounded font-bold"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-center">
                        <input
                          type="number"
                          min="0"
                          value={d === 0 ? '' : d}
                          placeholder="0"
                          onChange={e => {
                            const val = parseInt(e.target.value) || 0;
                            updatePrasadamCount({
                              id: entry?.id,
                              devotee_id: selectedDevoteeForEdit.id,
                              date: dateStr,
                              breakfast_count: b,
                              lunch_count: l,
                              dinner_count: val,
                              is_auto_filled: false,
                            });
                          }}
                          className="w-12 text-center py-1 bg-slate-50 dark:bg-slate-800 border rounded font-bold"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right font-bold text-slate-800 dark:text-slate-200">
                        {formatRupee(cost)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Modal>

      {/* REJECT EXPENSE MODAL */}
      <Modal
        isOpen={Boolean(rejectingExpense)}
        onClose={() => setRejectingExpense(null)}
        title="Reject Expense Submission"
        description="Specify a reason for rejecting this expense so the devotee can see why."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
              Rejection Reason *
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Duplicate bill, receipt illegible, or personal item included..."
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              className="w-full p-3 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm outline-none resize-none"
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setRejectingExpense(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleConfirmRejection}
              className="flex-1"
            >
              Confirm Rejection
            </Button>
          </div>
        </div>
      </Modal>

      {/* DIRECT SETTLE MODAL */}
      <Modal
        isOpen={Boolean(settlingDevotee)}
        onClose={() => setSettlingDevotee(null)}
        title={`Direct Settlement: ${settlingDevotee ? formatDevoteeName(settlingDevotee.devotee) : ''}`}
        description="Manually record full or partial payment settlement for this group."
      >
        <form onSubmit={handleDirectSettleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Settled Amount (₹)
            </label>
            <input
              type="number"
              step="0.01"
              required
              value={directSettleAmount}
              onChange={e => setDirectSettleAmount(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl font-bold text-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Settlement Date
            </label>
            <input
              type="date"
              required
              value={directSettleDate}
              onChange={e => setDirectSettleDate(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Admin Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Received via GPay / Cash"
              value={directSettleNotes}
              onChange={e => setDirectSettleNotes(e.target.value)}
              className="w-full px-4 py-2 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setSettlingDevotee(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" variant="saffron" className="flex-1">
              Mark as Settled
            </Button>
          </div>
        </form>
      </Modal>

      {/* DEVOTEE EDIT / CREATE MODAL */}
      <Modal
        isOpen={isDevoteeModalOpen}
        onClose={() => setIsDevoteeModalOpen(false)}
        title={editingDevotee ? 'Edit Devotee' : 'Add New Devotee'}
      >
        <form onSubmit={handleSaveDevoteeSubmit} className="space-y-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Name / Group Name *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ram Das"
              value={devoteeGroupName}
              onChange={e => setDevoteeGroupName(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              10-Digit Phone Number *
            </label>
            <input
              type="tel"
              required
              maxLength={10}
              placeholder="e.g. 9876543201"
              value={devoteePhone}
              onChange={e => setDevoteePhone(e.target.value.replace(/\D/g, ''))}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-mono outline-none"
            />
          </div>

          {/* Group Community Cost */}
          <div>
            <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">
              Group Default Community Cost (₹ / participant)
            </label>
            <input
              type="number"
              min="0"
              placeholder={`Default: ₹${communityCostPerMember}`}
              value={devoteeCommunityCost}
              onChange={e => setDevoteeCommunityCost(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border rounded-xl text-sm font-mono outline-none"
            />
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Default community fee levied per participant. Leave empty to use system default (₹{communityCostPerMember}).
            </span>
          </div>

          {/* Family & Friends Section */}
          <div className="pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200">
                Family & Friends Participants ({familyRows.length})
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFamilyRows(prev => [...prev, { name: '', phone_number: '', is_friend: false, community_cost: '' }])}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Family Member</span>
                </button>
                <span className="text-slate-300 dark:text-slate-700">•</span>
                <button
                  type="button"
                  onClick={() => setFamilyRows(prev => [...prev, { name: '', phone_number: '', is_friend: true, community_cost: '' }])}
                  className="text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Friend</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mb-3">
              Friends have their meal counts filled and calculated separately from family members. You can click the badge to toggle between Family and Friend anytime.
            </p>

            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {familyRows.map((row, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-xl border flex flex-col gap-2 transition-all ${
                    row.is_friend
                      ? 'bg-emerald-50/20 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800/80'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {/* Name */}
                    <div className="flex-1">
                      <input
                        type="text"
                        placeholder={row.is_friend ? `Friend ${idx + 1} Name` : `Family Member ${idx + 1} Name`}
                        value={row.name}
                        onChange={e => {
                          const val = e.target.value;
                          setFamilyRows(prev => {
                            const updated = [...prev];
                            updated[idx] = { ...updated[idx], name: val };
                            return updated;
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs outline-none"
                      />
                    </div>

                    {/* Mobile */}
                    <div className="w-28 sm:w-36">
                      <input
                        type="tel"
                        maxLength={10}
                        placeholder="Mobile"
                        value={row.phone_number}
                        onChange={e => {
                          const val = e.target.value.replace(/\D/g, '');
                          setFamilyRows(prev => {
                            const updated = [...prev];
                            updated[idx] = { ...updated[idx], phone_number: val };
                            return updated;
                          });
                        }}
                        className="w-full px-2.5 py-1.5 bg-white dark:bg-slate-800 border rounded-lg text-xs font-mono outline-none"
                      />
                    </div>

                    {/* Type Switcher: Family vs Friend */}
                    <button
                      type="button"
                      title="Click to toggle between Family and Friend"
                      onClick={() => {
                        setFamilyRows(prev => {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], is_friend: !updated[idx].is_friend };
                          return updated;
                        });
                      }}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors flex items-center gap-1 shrink-0 ${
                        row.is_friend
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-400'
                          : 'bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-400'
                      }`}
                    >
                      {row.is_friend ? '🤝 Friend' : '👨‍👩‍👧 Family'}
                    </button>

                    {familyRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setFamilyRows(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Individual Community Cost input */}
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pl-1">
                    <span>Individual Community Cost (₹):</span>
                    <input
                      type="number"
                      min="0"
                      placeholder={`Inherit (${devoteeCommunityCost || communityCostPerMember})`}
                      value={row.community_cost}
                      onChange={e => {
                        const val = e.target.value;
                        setFamilyRows(prev => {
                          const updated = [...prev];
                          updated[idx] = { ...updated[idx], community_cost: val };
                          return updated;
                        });
                      }}
                      className="w-24 px-2 py-0.5 bg-white dark:bg-slate-800 border rounded text-[11px] font-mono outline-none text-slate-800 dark:text-slate-200"
                    />
                    <span className="text-[10px] text-slate-400">(optional override)</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsDevoteeModalOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" variant="saffron" className="flex-1">
              Save Devotee
            </Button>
          </div>
        </form>
      </Modal>

      {/* Carry Forward Adjustment Modal */}
      <Modal
        isOpen={Boolean(editingCarryForwardDevotee)}
        onClose={() => setEditingCarryForwardDevotee(null)}
        title={`Adjust Carry Forward: ${editingCarryForwardDevotee ? formatDevoteeName(editingCarryForwardDevotee.devotee) : ''}`}
      >
        <form onSubmit={handleSaveCarryForward} className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Set or adjust the opening Carry Forward balance for <strong>{formatMonthName(activeMonth)}</strong>. Positive amount means devotee owes previous balance; negative amount means surplus credit.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Carry Forward Amount (₹) *
            </label>
            <input
              type="number"
              step="any"
              required
              value={carryForwardAmountInput}
              onChange={e => setCarryForwardAmountInput(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-amber-500 outline-none"
              placeholder="e.g. 1500 or -200"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">
              Default is calculated automatically from previous month's final balance.
            </span>
          </div>

          <div className="flex gap-2 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingCarryForwardDevotee(null)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" variant="saffron" className="flex-1">
              Save Carry Forward
            </Button>
          </div>
        </form>
      </Modal>

      {/* Multi-Receipt Viewer Modal */}
      <ReceiptViewerModal
        isOpen={Boolean(adminViewingReceiptUrl)}
        onClose={() => setAdminViewingReceiptUrl(null)}
        billUrl={adminViewingReceiptUrl}
        title="Expense Receipt Attachments"
      />
    </div>
  );
};
