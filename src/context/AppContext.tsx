import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Devotee,
  PrasadamCount,
  Expense,
  ExpenseStatus,
  MonthlyLedger,
  DevoteeMonthlySummary,
  ActiveTab,
} from '../types';
import { storageService } from '../services/storageService';
import { getDataEnvironmentInfo } from '../services/supabase';
import {
  getCurrentCycleMonth,
  computeDevoteeMonthlySummaryWithCarryForward,
  MIN_CYCLE_MONTH,
} from '../utils/calculations';
import { findDevoteeByPhone, getFamilyMemberNames } from '../utils/devoteeHelpers';

export interface ToastInfo {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

interface AppContextType {
  // State
  activeMonth: string;
  setActiveMonth: (month: string) => void;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  devotees: Devotee[];
  activeDevotee: Devotee | null;
  loggedInMemberName: string | null;
  guestName: string | null;
  prasadamCounts: PrasadamCount[];
  expenses: Expense[];
  monthlyLedgers: MonthlyLedger[];
  isAdmin: boolean;
  adminPin: string;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  isAdminPinModalOpen: boolean;
  setIsAdminPinModalOpen: (open: boolean) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  toasts: ToastInfo[];
  showToast: (toast: Omit<ToastInfo, 'id'>) => void;
  removeToast: (id: string) => void;

  // Notifications
  isNotificationModalOpen: boolean;
  setIsNotificationModalOpen: (open: boolean) => void;
  userExpenses: Expense[];
  unreadNotificationCount: number;
  readNotificationIds: string[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;

  // Environment & Storage Mode
  isLocalMode: boolean;
  dataEnvironment: ReturnType<typeof getDataEnvironmentInfo>;

  // Summaries
  communityCostPerMember: number;
  currentDevoteeSummary: DevoteeMonthlySummary | null;
  allDevoteeSummaries: DevoteeMonthlySummary[];

  // Actions
  updateCommunityCostPerMember: (newCost: number) => Promise<void>;
  loginWithPhone: (phone: string) => Promise<boolean>;
  loginAsGuest: (name: string) => void;
  logoutDevotee: () => void;
  selectDevoteeAndRedirect: (devotee: Devotee, targetTab?: ActiveTab) => void;
  authenticateAdmin: (pin: string) => Promise<boolean>;
  logoutAdmin: () => void;
  updateAdminPin: (newPin: string) => Promise<void>;
  updatePrasadamCount: (count: PrasadamCount) => Promise<void>;
  batchUpdatePrasadamCounts: (counts: PrasadamCount[]) => Promise<void>;
  updateMonthlyMealCounts: (
    devoteeId: string,
    month: string,
    b: number,
    l: number,
    d: number,
    options?: { silent?: boolean }
  ) => Promise<void>;
  updateFriendMonthlyCounts: (
    devoteeId: string,
    friendName: string,
    month: string,
    b: number,
    l: number,
    d: number,
    options?: { silent?: boolean }
  ) => Promise<void>;
  autoFillCounts: (targetDevoteeId?: string) => Promise<number>;
  submitExpense: (expense: Omit<Expense, 'id' | 'created_at'>) => Promise<Expense>;
  reviewExpense: (id: string, status: ExpenseStatus, reason?: string) => Promise<void>;
  requestSettlement: (amount: number, date: string, notes?: string) => Promise<void>;
  adminVerifySettlement: (devoteeId: string, amount: number, date: string, notes?: string) => Promise<void>;
  adminResetSettlement: (devoteeId: string) => Promise<void>;
  carryOverBalances: (nextMonth: string) => Promise<number>;
  updateDevoteeCarryForward: (devoteeId: string, cycleMonth: string, amount: number) => Promise<void>;
  saveDevotee: (devotee: Devotee) => Promise<void>;
  deleteDevotee: (devoteeId: string) => Promise<void>;
  refreshData: () => Promise<void>;
  resetDatabase: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Environment & Data Mode
  const dataEnvironment = useMemo(() => storageService.getDataEnvironment(), []);
  const isLocalMode = dataEnvironment.isLocal;

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('gnh_theme') as 'light' | 'dark' | null;
    if (savedTheme) return savedTheme;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // URL Query Sync initialization
  const searchParams = new URLSearchParams(window.location.search);
  const rawInitialMonth = searchParams.get('month') || getCurrentCycleMonth();
  const initialMonth = rawInitialMonth < MIN_CYCLE_MONTH ? MIN_CYCLE_MONTH : rawInitialMonth;
  const initialTab = (searchParams.get('tab') as ActiveTab) || 'reports';
  const initialGuest = searchParams.get('guest') || storageService.getActiveGuest();

  // Admin auth: Check if saved in browser storage
  const isInitiallyAdmin = storageService.getAdminAuthenticated();
  const [isAdmin, setIsAdmin] = useState<boolean>(isInitiallyAdmin);
  const [adminPin, setAdminPin] = useState<string>('192108');
  const [communityCostPerMember, setCommunityCostPerMember] = useState<number>(500);

  const [activeMonth, setActiveMonthState] = useState<string>(initialMonth);
  const [activeTab, setActiveTabState] = useState<ActiveTab>(
    initialTab === 'admin' && !isInitiallyAdmin ? 'reports' : initialTab
  );
  const [devotees, setDevotees] = useState<Devotee[]>([]);
  const [activeDevotee, setActiveDevotee] = useState<Devotee | null>(null);
  const [loggedInMemberName, setLoggedInMemberName] = useState<string | null>(null);
  const [guestName, setGuestName] = useState<string | null>(initialGuest);
  const [prasadamCounts, setPrasadamCounts] = useState<PrasadamCount[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyLedgers, setMonthlyLedgers] = useState<MonthlyLedger[]>([]);
  
  const [isLoginModalOpen, setIsLoginModalOpen] = useState<boolean>(false);
  const [isAdminPinModalOpen, setIsAdminPinModalOpen] = useState<boolean>(
    initialTab === 'admin' && !isInitiallyAdmin
  );
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState<boolean>(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('gnh_read_notifs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Apply theme class to document element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('gnh_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  const showToast = useCallback((toast: Omit<ToastInfo, 'id'>) => {
    const id = `${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    setToasts(prev => [...prev, { ...toast, id }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Synchronize state with URL search params
  const updateUrlParams = useCallback((newTab: ActiveTab, month: string, phone: string | null, guest: string | null) => {
    const url = new URL(window.location.href);
    url.searchParams.set('tab', newTab);
    url.searchParams.set('month', month);
    if (phone) {
      url.searchParams.set('phone', phone);
      url.searchParams.delete('guest');
    } else if (guest) {
      url.searchParams.set('guest', guest);
      url.searchParams.delete('phone');
    } else {
      url.searchParams.delete('phone');
      url.searchParams.delete('guest');
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  const setActiveTab = useCallback((tab: ActiveTab) => {
    if (tab === 'admin' && !isAdmin) {
      setIsAdminPinModalOpen(true);
      return;
    }
    setActiveTabState(tab);
    const activePhone = storageService.getActivePhone() || activeDevotee?.phone_number || null;
    updateUrlParams(tab, activeMonth, activePhone, guestName);
  }, [activeMonth, activeDevotee, guestName, isAdmin, updateUrlParams]);

  const setActiveMonth = useCallback((month: string) => {
    const clampedMonth = month < MIN_CYCLE_MONTH ? MIN_CYCLE_MONTH : month;
    setActiveMonthState(clampedMonth);
    const activePhone = storageService.getActivePhone() || activeDevotee?.phone_number || null;
    updateUrlParams(activeTab, clampedMonth, activePhone, guestName);
  }, [activeTab, activeDevotee, guestName, updateUrlParams]);

  // Load core data from storage service
  const refreshData = useCallback(async () => {
    try {
      const [devoteesList, countsList, expensesList, ledgersList, pin, commCost] = await Promise.all([
        storageService.getDevotees(),
        storageService.getPrasadamCounts(),
        storageService.getExpenses(),
        storageService.getMonthlyLedgers(),
        storageService.getSystemConfig('admin_pin_hash', '192108'),
        storageService.getSystemConfig('community_cost_per_member', '500'),
      ]);

      setDevotees(devoteesList);
      setPrasadamCounts(countsList);
      setExpenses(expensesList);
      setMonthlyLedgers(ledgersList);
      setAdminPin(pin || '192108');
      setCommunityCostPerMember(parseInt(commCost, 10) || 500);

      // Set active devotee ONLY if explicitly logged in with phone or guest
      const urlPhone = new URLSearchParams(window.location.search).get('phone');
      const phoneToFind = urlPhone || storageService.getActivePhone() || activeDevotee?.phone_number;
      if (phoneToFind && !guestName) {
        const match = findDevoteeByPhone(devoteesList, phoneToFind);
        if (match) {
          setActiveDevotee(match.devotee);
          setLoggedInMemberName(match.matchedMemberName || (getFamilyMemberNames(match.devotee).length === 1 ? getFamilyMemberNames(match.devotee)[0] : null));
        }
      }
    } catch (err) {
      console.error('Failed to load GNH data:', err);
    }
  }, [activeMonth, activeDevotee?.phone_number, guestName]);

  // Initial load and subscribe to reactive storage changes
  useEffect(() => {
    refreshData();
    const unsubscribe = storageService.subscribe(() => {
      refreshData();
    });
    return () => {
      unsubscribe();
    };
  }, [refreshData]);

  // Compute summaries with multi-month recursive carry forward
  const allDevoteeSummaries = useMemo(() => {
    return devotees.map(devotee => {
      return computeDevoteeMonthlySummaryWithCarryForward(
        devotee,
        activeMonth,
        prasadamCounts,
        expenses,
        monthlyLedgers,
        communityCostPerMember
      );
    });
  }, [devotees, activeMonth, prasadamCounts, expenses, monthlyLedgers, communityCostPerMember]);

  const currentDevoteeSummary = useMemo(() => {
    if (!activeDevotee) return null;
    return computeDevoteeMonthlySummaryWithCarryForward(
      activeDevotee,
      activeMonth,
      prasadamCounts,
      expenses,
      monthlyLedgers,
      communityCostPerMember
    );
  }, [activeDevotee, activeMonth, prasadamCounts, expenses, monthlyLedgers, communityCostPerMember]);

  // User's own expenses (all time) for notifications
  const userExpenses = useMemo(() => {
    if (activeDevotee) {
      return expenses.filter(e => e.devotee_id === activeDevotee.id);
    }
    if (guestName) {
      return expenses.filter(e => e.guest_name === guestName);
    }
    return [];
  }, [expenses, activeDevotee, guestName]);

  const unreadNotificationCount = useMemo(() => {
    return userExpenses.filter(
      e => (e.status === 'APPROVED' || e.status === 'REJECTED') && !readNotificationIds.includes(e.id)
    ).length;
  }, [userExpenses, readNotificationIds]);

  const markNotificationAsRead = useCallback((id: string) => {
    setReadNotificationIds(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem('gnh_read_notifs', JSON.stringify(next));
      return next;
    });
  }, []);

  const markAllNotificationsAsRead = useCallback(() => {
    const allIds = userExpenses.map(e => e.id);
    setReadNotificationIds(prev => {
      const merged = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem('gnh_read_notifs', JSON.stringify(merged));
      return merged;
    });
  }, [userExpenses]);

  // Authentication Handlers
  const loginWithPhone = async (phone: string): Promise<boolean> => {
    const match = findDevoteeByPhone(devotees, phone);
    if (match) {
      setActiveDevotee(match.devotee);
      setLoggedInMemberName(match.matchedMemberName || null);
      setGuestName(null);
      storageService.setActivePhone(match.matchedPhone);
      storageService.setActiveGuest(null);
      updateUrlParams(activeTab, activeMonth, match.matchedPhone, null);
      
      const welcomeTitle = match.matchedMemberName && !match.isPrimary
        ? `Welcome, ${match.matchedMemberName}!`
        : `Welcome, ${match.devotee.group_name}!`;
      const welcomeMsg = match.matchedMemberName && !match.isPrimary
        ? `Logged in as part of ${match.devotee.group_name} with mobile +91 ${match.matchedPhone}`
        : `Logged in with +91 ${match.matchedPhone}`;

      showToast({
        type: 'success',
        title: welcomeTitle,
        message: welcomeMsg,
      });
      return true;
    }
    return false;
  };

  const selectDevoteeAndRedirect = (devotee: Devotee, targetTab: ActiveTab = 'reports') => {
    setActiveDevotee(devotee);
    setLoggedInMemberName(null);
    setGuestName(null);
    storageService.setActivePhone(devotee.phone_number);
    storageService.setActiveGuest(null);
    setActiveTabState(targetTab);
    updateUrlParams(targetTab, activeMonth, devotee.phone_number, null);
    showToast({
      type: 'info',
      title: `Viewing as ${devotee.group_name}`,
      message: `Navigated to ${targetTab} for phone ${devotee.phone_number}`,
    });
  };

  const loginAsGuest = (name: string) => {
    const cleanName = name.trim();
    setGuestName(cleanName);
    setActiveDevotee(null);
    setLoggedInMemberName(null);
    storageService.setActivePhone(null);
    storageService.setActiveGuest(cleanName);
    updateUrlParams(activeTab, activeMonth, null, cleanName);
    showToast({
      type: 'info',
      title: `Welcome Guest Seva!`,
      message: `Signed in as ${cleanName}`,
    });
  };

  const logoutDevotee = () => {
    setActiveDevotee(null);
    setLoggedInMemberName(null);
    setGuestName(null);
    storageService.setActivePhone(null);
    storageService.setActiveGuest(null);
    updateUrlParams('reports', activeMonth, null, null);
    setIsLoginModalOpen(false);
    showToast({
      type: 'info',
      title: 'Logged Out',
      message: 'You have been safely signed out.',
    });
  };

  const authenticateAdmin = async (pin: string): Promise<boolean> => {
    const currentPin = await storageService.getSystemConfig('admin_pin_hash', '192108');
    if (pin.trim() === currentPin.trim()) {
      setIsAdmin(true);
      storageService.setAdminAuthenticated(true); // Save in browser
      setActiveTabState('admin');
      updateUrlParams('admin', activeMonth, activeDevotee?.phone_number || null, guestName);
      showToast({
        type: 'success',
        title: 'Admin Access Granted',
        message: 'Master override and global control unlocked.',
      });
      return true;
    }
    return false;
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    storageService.setAdminAuthenticated(false);
    showToast({
      type: 'info',
      title: 'Admin Mode Locked',
    });
    if (activeTab === 'admin') {
      setActiveTabState('reports');
      updateUrlParams('reports', activeMonth, activeDevotee?.phone_number || null, guestName);
    }
  };

  const updateAdminPin = async (newPin: string) => {
    await storageService.setSystemConfig('admin_pin_hash', newPin.trim());
    setAdminPin(newPin.trim());
    showToast({
      type: 'success',
      title: 'Admin PIN Updated',
      message: `New 6-digit PIN saved.`,
    });
  };

  // Operations
  const updatePrasadamCount = async (count: PrasadamCount) => {
    await storageService.savePrasadamCount(count);
  };

  const batchUpdatePrasadamCounts = async (counts: PrasadamCount[]) => {
    await storageService.batchSavePrasadamCounts(counts);
    showToast({
      type: 'success',
      title: 'Prasadam Counts Saved',
      message: `Updated ${counts.length} day records successfully.`,
    });
  };

  const updateMonthlyMealCounts = async (
    devoteeId: string,
    month: string,
    b: number,
    l: number,
    d: number,
    options?: { silent?: boolean }
  ) => {
    await storageService.saveMonthlyPrasadamCounts(devoteeId, month, b, l, d);
    const updated = await storageService.getPrasadamCounts(month);
    setPrasadamCounts(updated);
    if (!options?.silent) {
      showToast({
        type: 'success',
        title: 'Monthly Counts Saved',
        message: `Saved total: ${b} Breakfasts, ${l} Lunches, ${d} Dinners.`,
      });
    }
  };

  const updateFriendMonthlyCounts = async (
    devoteeId: string,
    friendName: string,
    month: string,
    b: number,
    l: number,
    d: number,
    options?: { silent?: boolean }
  ) => {
    const updatedDevotee = await storageService.saveFriendMonthlyCounts(
      devoteeId,
      friendName,
      month,
      b,
      l,
      d
    );
    if (updatedDevotee) {
      setDevotees(prev => prev.map(d => (d.id === updatedDevotee.id ? updatedDevotee : d)));
      if (activeDevotee?.id === updatedDevotee.id) {
        setActiveDevotee(updatedDevotee);
      }
      if (!options?.silent) {
        showToast({
          type: 'success',
          title: 'Friend Counts Saved',
          message: `Saved counts for ${friendName}: ${b} B, ${l} L, ${d} D.`,
        });
      }
    }
  };

  const autoFillCounts = async (targetDevoteeId?: string): Promise<number> => {
    const count = await storageService.autoFillMissingCounts(activeMonth, targetDevoteeId);
    showToast({
      type: 'success',
      title: 'Auto-Fill Completed',
      message: `Auto-populated ${count} missing day entries with max meal counts.`,
    });
    return count;
  };

  const submitExpense = async (expense: Omit<Expense, 'id' | 'created_at'>): Promise<Expense> => {
    const saved = await storageService.saveExpense(expense);
    setExpenses(prev => [saved, ...prev.filter(e => e.id !== saved.id)]);
    showToast({
      type: 'success',
      title: 'Expense Logged',
      message: `₹${saved.amount} for "${saved.title}" recorded with status ${saved.status}.`,
    });
    return saved;
  };

  const reviewExpense = async (id: string, status: ExpenseStatus, reason?: string) => {
    await storageService.updateExpenseStatus(id, status, reason);
    setExpenses(prev =>
      prev.map(e =>
        e.id === id
          ? {
              ...e,
              status,
              rejection_reason: status === 'REJECTED' ? reason || 'Rejected by Admin' : null,
            }
          : e
      )
    );
    showToast({
      type: status === 'APPROVED' ? 'success' : status === 'REJECTED' ? 'error' : 'info',
      title: `Expense ${status === 'APPROVED' ? 'Approved' : status === 'REJECTED' ? 'Rejected' : 'Pending'}`,
      message: `Expense status changed to ${status}.`,
    });
  };

  const requestSettlement = async (amount: number, date: string, notes?: string) => {
    if (!activeDevotee) return;
    const saved = await storageService.requestDevoteeSettlement(activeDevotee.id, activeMonth, amount, date, notes);
    setMonthlyLedgers(prev => {
      const idx = prev.findIndex(l => l.devotee_id === activeDevotee.id && l.cycle_month === activeMonth);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    showToast({
      type: 'success',
      title: 'Settlement Submitted',
      message: `Reported ₹${amount} payment for verification by Admin.`,
    });
  };

  const adminVerifySettlement = async (devoteeId: string, amount: number, date: string, notes?: string) => {
    const saved = await storageService.verifyAndSettleDevotee(devoteeId, activeMonth, amount, date, notes);
    setMonthlyLedgers(prev => {
      const idx = prev.findIndex(l => l.devotee_id === devoteeId && l.cycle_month === activeMonth);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    showToast({
      type: 'success',
      title: 'Settlement Verified & Settled',
      message: `Marked ₹${amount} as settled.`,
    });
  };

  const adminResetSettlement = async (devoteeId: string) => {
    const saved = await storageService.resetDevoteeSettlement(devoteeId, activeMonth);
    setMonthlyLedgers(prev => {
      const idx = prev.findIndex(l => l.devotee_id === devoteeId && l.cycle_month === activeMonth);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    showToast({
      type: 'warning',
      title: 'Settlement Reset',
      message: `Status reverted to Unsettled.`,
    });
  };

  const carryOverBalances = async (nextMonth: string): Promise<number> => {
    const balanceList = allDevoteeSummaries.map(s => ({
      devoteeId: s.devotee.id,
      finalBalance: s.final_balance,
    }));

    const count = await storageService.carryOverBalancesToNextMonth(activeMonth, nextMonth, balanceList);
    showToast({
      type: 'success',
      title: 'Balances Rolled Over',
      message: `Transferred carry-over balances for ${count} devotees into ${nextMonth}.`,
    });
    return count;
  };

  const updateDevoteeCarryForward = async (devoteeId: string, cycleMonth: string, amount: number) => {
    const saved = await storageService.saveDevoteeCarryForward(devoteeId, cycleMonth, amount);
    setMonthlyLedgers(prev => {
      const idx = prev.findIndex(l => l.devotee_id === devoteeId && l.cycle_month === cycleMonth);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    showToast({
      type: 'success',
      title: 'Carry Forward Updated',
      message: `Carry forward adjusted to ₹${amount}.`,
    });
  };

  const saveDevotee = async (devotee: Devotee) => {
    const saved = await storageService.saveDevotee(devotee);
    setDevotees(prev => {
      const idx = prev.findIndex(d => (saved.id && d.id === saved.id) || d.phone_number === saved.phone_number);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [...prev, saved];
    });
    showToast({
      type: 'success',
      title: 'Devotee Saved',
      message: `${devotee.group_name} saved successfully.`,
    });
  };

  const deleteDevotee = async (devoteeId: string) => {
    await storageService.deleteDevotee(devoteeId);
    setDevotees(prev => prev.filter(d => d.id !== devoteeId));
    showToast({
      type: 'warning',
      title: 'Devotee Removed',
      message: 'Devotee has been removed.',
    });
  };

  const updateCommunityCostPerMember = async (newCost: number) => {
    const clamped = Math.max(0, newCost);
    await storageService.setSystemConfig('community_cost_per_member', clamped.toString());
    setCommunityCostPerMember(clamped);
    showToast({
      type: 'success',
      title: 'Settings Updated',
      message: `Community Cost per family member updated to ₹${clamped}.`,
    });
  };

  const resetDatabase = () => {
    storageService.resetDatabaseToDefaults();
    showToast({
      type: 'warning',
      title: 'Database Reset',
      message: 'Restored initial sample devotees and records.',
    });
  };

  return (
    <AppContext.Provider
      value={{
        activeMonth,
        setActiveMonth,
        activeTab,
        setActiveTab,
        devotees,
        activeDevotee,
        loggedInMemberName,
        guestName,
        prasadamCounts,
        expenses,
        monthlyLedgers,
        isAdmin,
        adminPin,
        isLoginModalOpen,
        setIsLoginModalOpen,
        isAdminPinModalOpen,
        setIsAdminPinModalOpen,
        theme,
        toggleTheme,
        toasts,
        showToast,
        removeToast,
        isNotificationModalOpen,
        setIsNotificationModalOpen,
        userExpenses,
        unreadNotificationCount,
        readNotificationIds,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        communityCostPerMember,
        updateCommunityCostPerMember,
        currentDevoteeSummary,
        allDevoteeSummaries,
        loginWithPhone,
        loginAsGuest,
        logoutDevotee,
        selectDevoteeAndRedirect,
        authenticateAdmin,
        logoutAdmin,
        updateAdminPin,
        updatePrasadamCount,
        batchUpdatePrasadamCounts,
        updateMonthlyMealCounts,
        updateFriendMonthlyCounts,
        autoFillCounts,
        submitExpense,
        reviewExpense,
        requestSettlement,
        adminVerifySettlement,
        adminResetSettlement,
        carryOverBalances,
        updateDevoteeCarryForward,
        saveDevotee,
        deleteDevotee,
        refreshData,
        resetDatabase,
        isLocalMode,
        dataEnvironment,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
