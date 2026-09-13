import { Devotee, PrasadamCount, Expense, ExpenseStatus, ExpenseType, MonthlyLedger } from '../types';
import { INITIAL_DEVOTEES } from '../data/seedDevotees';
import { supabase, isSupabaseConfigured, isLocalDataMode, getDataEnvironmentInfo } from './supabase';
import { calculateDevoteeMaxCounts, getAllDatesInMonth } from '../utils/calculations';
import { normalizeFamilyMembers } from '../utils/devoteeHelpers';
import { fileToBase64 } from '../utils/imageCompressor';

// Storage keys namespace mapper (Local mode uses 'gnh_local_' to ensure zero leakage with Production)
const BASE_STORAGE_KEYS = {
  DEVOTEES: 'devotees',
  PRASADAM_COUNTS: 'prasadam_counts',
  EXPENSES: 'expenses',
  MONTHLY_LEDGERS: 'monthly_ledgers',
  SYSTEM_CONFIG: 'system_config',
  ACTIVE_DEVOTEE_PHONE: 'active_phone',
  ACTIVE_GUEST_NAME: 'active_guest',
  ADMIN_AUTH: 'admin_auth',
  ACTIVE_MONTH: 'active_month',
  SCHEMA_VERSION: 'schema_version',
};

const STORAGE_KEYS: Record<keyof typeof BASE_STORAGE_KEYS, string> = new Proxy(BASE_STORAGE_KEYS, {
  get(target, prop: string) {
    if (prop in target) {
      const prefix = isLocalDataMode() ? 'gnh_local_' : 'gnh_';
      return `${prefix}${target[prop as keyof typeof BASE_STORAGE_KEYS]}`;
    }
    return undefined;
  },
}) as Record<keyof typeof BASE_STORAGE_KEYS, string>;

const CURRENT_SCHEMA_VERSION = '2026_08_clean_v2';

// Initial Seed System Config
const DEFAULT_CONFIG: Record<string, string> = {
  admin_pin_hash: '192108',
  breakfast_rate: '40',
  lunch_rate: '80',
  dinner_rate: '40',
  community_cost_per_member: '500',
};

function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

class StorageService {
  private initialized = false;

  constructor() {
    this.init();
  }

  private init() {
    if (this.initialized) return;

    const savedVersion = localStorage.getItem(STORAGE_KEYS.SCHEMA_VERSION);

    if (savedVersion !== CURRENT_SCHEMA_VERSION) {
      // Clean slate initialization: Seed updated devotees, zero expenses, zero counts, zero ledgers
      localStorage.setItem(STORAGE_KEYS.DEVOTEES, JSON.stringify(INITIAL_DEVOTEES));
      localStorage.setItem(STORAGE_KEYS.PRASADAM_COUNTS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.MONTHLY_LEDGERS, JSON.stringify([]));
      localStorage.setItem(STORAGE_KEYS.SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
    } else {
      const existingDevotees = localStorage.getItem(STORAGE_KEYS.DEVOTEES);
      if (!existingDevotees) {
        localStorage.setItem(STORAGE_KEYS.DEVOTEES, JSON.stringify(INITIAL_DEVOTEES));
      }

      const existingCounts = localStorage.getItem(STORAGE_KEYS.PRASADAM_COUNTS);
      if (!existingCounts) {
        localStorage.setItem(STORAGE_KEYS.PRASADAM_COUNTS, JSON.stringify([]));
      }

      const existingExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
      if (!existingExpenses) {
        localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify([]));
      }

      const existingLedgers = localStorage.getItem(STORAGE_KEYS.MONTHLY_LEDGERS);
      if (!existingLedgers) {
        localStorage.setItem(STORAGE_KEYS.MONTHLY_LEDGERS, JSON.stringify([]));
      }
    }

    const existingConfig = localStorage.getItem(STORAGE_KEYS.SYSTEM_CONFIG);
    if (!existingConfig) {
      localStorage.setItem(STORAGE_KEYS.SYSTEM_CONFIG, JSON.stringify(DEFAULT_CONFIG));
    }

    this.initialized = true;
  }

  // --- DEVOTEES ---
  async getDevotees(): Promise<Devotee[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('devotees').select('*').order('group_name');
        if (!error && data && data.length > 0) {
          const normalized = data.map((d: any) => ({
            ...d,
            family_members: normalizeFamilyMembers(d),
          }));
          localStorage.setItem(STORAGE_KEYS.DEVOTEES, JSON.stringify(normalized));
          return normalized as Devotee[];
        }
      } catch (err) {
        console.warn('Supabase getDevotees failed, using localStorage fallback', err);
      }
    }

    const local = localStorage.getItem(STORAGE_KEYS.DEVOTEES);
    const parsed: Devotee[] = local ? JSON.parse(local) : INITIAL_DEVOTEES;
    return parsed.map(d => ({
      ...d,
      family_members: normalizeFamilyMembers(d),
    }));
  }

  async saveDevotee(devotee: Devotee): Promise<Devotee> {
    const devotees = await this.getDevotees();
    const cleanPhone = devotee.phone_number.replace(/\D/g, '').slice(-10);
    const index = devotees.findIndex(d => (devotee.id && d.id === devotee.id) || d.phone_number === cleanPhone);

    const isValidUUID = (str?: string | null) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    const existingId = index >= 0 ? devotees[index].id : undefined;
    const resolvedId = (devotee.id && isValidUUID(devotee.id))
      ? devotee.id
      : (existingId && isValidUUID(existingId) ? existingId : generateUUID());

    const record: Devotee = {
      ...devotee,
      id: resolvedId,
      phone_number: cleanPhone,
      group_name: devotee.group_name.trim(),
      family_members: normalizeFamilyMembers(devotee),
      community_cost: typeof devotee.community_cost === 'number' ? devotee.community_cost : undefined,
      is_admin: Boolean(devotee.is_admin),
      created_at: index >= 0 ? (devotees[index].created_at || new Date().toISOString()) : new Date().toISOString(),
    };

    let updated: Devotee[];
    if (index >= 0) {
      updated = [...devotees];
      updated[index] = record;
    } else {
      updated = [...devotees, record];
    }

    localStorage.setItem(STORAGE_KEYS.DEVOTEES, JSON.stringify(updated));

    if (isSupabaseConfigured() && supabase) {
      try {
        const payload: Record<string, any> = {
          phone_number: record.phone_number,
          group_name: record.group_name,
          family_members: record.family_members,
          is_admin: record.is_admin,
          created_at: record.created_at,
        };

        if (record.id && isValidUUID(record.id)) {
          payload.id = record.id;
        }

        const { data, error } = await supabase
          .from('devotees')
          .upsert(payload, { onConflict: 'id' })
          .select()
          .single();

        if (!error && data) {
          record.id = data.id;
          const latestRaw = localStorage.getItem(STORAGE_KEYS.DEVOTEES);
          const latestDevotees: Devotee[] = latestRaw ? JSON.parse(latestRaw) : [];
          const idx = latestDevotees.findIndex(d => (record.id && d.id === record.id) || d.phone_number === record.phone_number);
          if (idx >= 0) {
            latestDevotees[idx] = { ...latestDevotees[idx], ...record, id: data.id };
            localStorage.setItem(STORAGE_KEYS.DEVOTEES, JSON.stringify(latestDevotees));
          }
        } else if (error) {
          console.warn('Supabase saveDevotee error:', error.message || error);
          throw new Error(error.message || 'Failed to save devotee in database.');
        }
      } catch (err: any) {
        console.warn('Supabase saveDevotee sync exception', err);
        throw err;
      }
    }

    this.notifySubscribers();
    return record;
  }

  async deleteDevotee(devoteeId: string): Promise<void> {
    const devotees = await this.getDevotees();
    const updatedDevotees = devotees.filter(d => d.id !== devoteeId);
    localStorage.setItem(STORAGE_KEYS.DEVOTEES, JSON.stringify(updatedDevotees));

    // Cascade delete related records locally
    const rawCounts = localStorage.getItem(STORAGE_KEYS.PRASADAM_COUNTS);
    if (rawCounts) {
      const counts: PrasadamCount[] = JSON.parse(rawCounts);
      localStorage.setItem(STORAGE_KEYS.PRASADAM_COUNTS, JSON.stringify(counts.filter(c => c.devotee_id !== devoteeId)));
    }

    const rawExpenses = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (rawExpenses) {
      const expenses: Expense[] = JSON.parse(rawExpenses);
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses.filter(e => e.devotee_id !== devoteeId)));
    }

    const rawLedgers = localStorage.getItem(STORAGE_KEYS.MONTHLY_LEDGERS);
    if (rawLedgers) {
      const ledgers: MonthlyLedger[] = JSON.parse(rawLedgers);
      localStorage.setItem(STORAGE_KEYS.MONTHLY_LEDGERS, JSON.stringify(ledgers.filter(l => l.devotee_id !== devoteeId)));
    }

    if (isSupabaseConfigured() && supabase) {
      try {
        await Promise.allSettled([
          supabase.from('prasadam_counts').delete().eq('devotee_id', devoteeId),
          supabase.from('expenses').delete().eq('devotee_id', devoteeId),
          supabase.from('monthly_ledgers').delete().eq('devotee_id', devoteeId),
          supabase.from('devotees').delete().eq('id', devoteeId),
        ]);
      } catch (err) {
        console.warn('Supabase deleteDevotee cascade error', err);
      }
    }

    this.notifySubscribers();
  }

  // --- PRASADAM COUNTS ---
  async getPrasadamCounts(cycleMonth?: string): Promise<PrasadamCount[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('prasadam_counts').select('*');
        if (cycleMonth) {
          const [yStr, mStr] = cycleMonth.split('-');
          const lastDay = new Date(parseInt(yStr, 10), parseInt(mStr, 10), 0).getDate();
          const lastDayStr = lastDay.toString().padStart(2, '0');
          query = query.gte('date', `${cycleMonth}-01`).lte('date', `${cycleMonth}-${lastDayStr}`);
        }
        const { data, error } = await query;
        if (!error && data) {
          return data as PrasadamCount[];
        }
      } catch (err) {
        console.warn('Supabase getPrasadamCounts failed, using localStorage fallback', err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEYS.PRASADAM_COUNTS);
    const counts: PrasadamCount[] = raw ? JSON.parse(raw) : [];
    if (cycleMonth) {
      return counts.filter(c => c.date.startsWith(cycleMonth));
    }
    return counts;
  }

  async savePrasadamCount(count: PrasadamCount): Promise<PrasadamCount> {
    const allCounts = await this.getPrasadamCounts();
    const key = `${count.devotee_id}_${count.date}`;
    const index = allCounts.findIndex(c => `${c.devotee_id}_${c.date}` === key);

    const record: PrasadamCount = {
      ...count,
      id: count.id || `cnt-${count.devotee_id}-${count.date}`,
      updated_at: new Date().toISOString(),
    };

    let updated: PrasadamCount[];
    if (index >= 0) {
      updated = [...allCounts];
      updated[index] = record;
    } else {
      updated = [...allCounts, record];
    }

    localStorage.setItem(STORAGE_KEYS.PRASADAM_COUNTS, JSON.stringify(updated));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('prasadam_counts').upsert({
          devotee_id: record.devotee_id,
          date: record.date,
          breakfast_count: record.breakfast_count,
          lunch_count: record.lunch_count,
          dinner_count: record.dinner_count,
          is_auto_filled: record.is_auto_filled,
          updated_at: record.updated_at,
        });
      } catch (err) {
        console.warn('Supabase savePrasadamCount error', err);
      }
    }

    this.notifySubscribers();
    return record;
  }

  async batchSavePrasadamCounts(counts: PrasadamCount[]): Promise<void> {
    const allCounts = await this.getPrasadamCounts();
    const countMap = new Map(allCounts.map(c => [`${c.devotee_id}_${c.date}`, c]));

    counts.forEach(c => {
      countMap.set(`${c.devotee_id}_${c.date}`, {
        ...c,
        id: c.id || `cnt-${c.devotee_id}-${c.date}`,
        updated_at: new Date().toISOString(),
      });
    });

    const updated = Array.from(countMap.values());
    localStorage.setItem(STORAGE_KEYS.PRASADAM_COUNTS, JSON.stringify(updated));

    if (isSupabaseConfigured() && supabase) {
      try {
        const payload = counts.map(c => ({
          devotee_id: c.devotee_id,
          date: c.date,
          breakfast_count: c.breakfast_count,
          lunch_count: c.lunch_count,
          dinner_count: c.dinner_count,
          is_auto_filled: c.is_auto_filled,
          updated_at: new Date().toISOString(),
        }));
        await supabase.from('prasadam_counts').upsert(payload, { onConflict: 'devotee_id,date' });
      } catch (err) {
        console.warn('Supabase batchSavePrasadamCounts error', err);
      }
    }

    this.notifySubscribers();
  }

  /**
   * Directly save monthly aggregate meal counts by distributing evenly across the month's days
   */
  async saveMonthlyPrasadamCounts(
    devoteeId: string,
    cycleMonth: string,
    totalB: number,
    totalL: number,
    totalD: number
  ): Promise<void> {
    const monthDates = getAllDatesInMonth(cycleMonth);
    const numDays = monthDates.length;
    const clampedB = Math.max(0, Math.round(totalB));
    const clampedL = Math.max(0, Math.round(totalL));
    const clampedD = Math.max(0, Math.round(totalD));

    const records: PrasadamCount[] = monthDates.map((dateStr, i) => {
      const b = Math.floor(clampedB / numDays) + (i < (clampedB % numDays) ? 1 : 0);
      const l = Math.floor(clampedL / numDays) + (i < (clampedL % numDays) ? 1 : 0);
      const d = Math.floor(clampedD / numDays) + (i < (clampedD % numDays) ? 1 : 0);

      return {
        id: `cnt-${devoteeId}-${dateStr}`,
        devotee_id: devoteeId,
        date: dateStr,
        breakfast_count: b,
        lunch_count: l,
        dinner_count: d,
        is_auto_filled: false,
        updated_at: new Date().toISOString(),
      };
    });

    await this.batchSavePrasadamCounts(records);
  }

  /**
   * Save monthly meal counts for a specific Friend participant under a devotee group
   */
  async saveFriendMonthlyCounts(
    devoteeId: string,
    friendName: string,
    cycleMonth: string,
    totalB: number,
    totalL: number,
    totalD: number
  ): Promise<Devotee | null> {
    const devotees = await this.getDevotees();
    const index = devotees.findIndex(d => d.id === devoteeId);
    if (index < 0) return null;

    const devotee = devotees[index];
    const members = normalizeFamilyMembers(devotee);
    const friendIndex = members.findIndex(
      m => m.name.toLowerCase().trim() === friendName.toLowerCase().trim() && m.is_friend
    );
    if (friendIndex < 0) return null;

    const friend = members[friendIndex];
    const existingMonthly = friend.monthly_counts || {};
    friend.monthly_counts = {
      ...existingMonthly,
      [cycleMonth]: {
        breakfast: Math.max(0, Math.round(totalB)),
        lunch: Math.max(0, Math.round(totalL)),
        dinner: Math.max(0, Math.round(totalD)),
      },
    };

    members[friendIndex] = friend;
    const updatedDevotee: Devotee = { ...devotee, family_members: members };
    return this.saveDevotee(updatedDevotee);
  }

  /**
   * Auto-fill unentered days in the active month with max entered slot counts
   */
  async autoFillMissingCounts(cycleMonth: string, targetDevoteeId?: string): Promise<number> {
    const devotees = await this.getDevotees();
    const allCounts = await this.getPrasadamCounts(cycleMonth);
    const monthDates = getAllDatesInMonth(cycleMonth);

    const targetDevotees = targetDevoteeId
      ? devotees.filter(d => d.id === targetDevoteeId)
      : devotees;

    const newCountsToSave: PrasadamCount[] = [];

    targetDevotees.forEach(devotee => {
      const devoteeCounts = allCounts.filter(c => c.devotee_id === devotee.id);
      const existingDateMap = new Map(devoteeCounts.map(c => [c.date, c]));
      const { maxB, maxL, maxD } = calculateDevoteeMaxCounts(devoteeCounts);

      monthDates.forEach(dateStr => {
        const existing = existingDateMap.get(dateStr);
        // Only auto-fill if completely unrecorded or if it was previously auto-filled
        // Explicit 0-count entries (e.g. fasting days) entered by the user are preserved
        if (!existing || existing.is_auto_filled) {
          newCountsToSave.push({
            id: existing?.id || `cnt-${devotee.id}-${dateStr}`,
            devotee_id: devotee.id,
            date: dateStr,
            breakfast_count: maxB,
            lunch_count: maxL,
            dinner_count: maxD,
            is_auto_filled: true,
            updated_at: new Date().toISOString(),
          });
        }
      });
    });

    if (newCountsToSave.length > 0) {
      await this.batchSavePrasadamCounts(newCountsToSave);
    }

    return newCountsToSave.length;
  }

  // --- EXPENSES ---
  async getExpenses(cycleMonth?: string): Promise<Expense[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('expenses').select('*').order('created_at', { ascending: false });
        if (cycleMonth) {
          query = query.or(`cycle_month.eq.${cycleMonth},type.eq.JANMASHTAMI,type.eq.PRABHUPADA_APPEARANCE`);
        }
        const { data, error } = await query;
        if (!error && data) {
          const mapped: Expense[] = data.map((d: any) => {
            let status: ExpenseStatus = d.status || 'PENDING';
            let rejection_reason = d.rejection_reason || null;
            let type: ExpenseType = d.type || 'REGULAR';
            let comments: string | null = d.comments || null;

            if (d.rejection_reason === '__PENDING__' || d.rejection_reason === 'PENDING_APPROVAL') {
              status = 'PENDING';
              rejection_reason = null;
            }

            // Restore PRABHUPADA_APPEARANCE if saved with fallback comment tag
            if (comments && comments.includes('[PRABHUPADA_APPEARANCE]')) {
              type = 'PRABHUPADA_APPEARANCE';
              comments = comments.replace('[PRABHUPADA_APPEARANCE]', '').trim() || null;
            }

            return {
              ...d,
              type,
              status,
              comments,
              rejection_reason,
              date: d.date || (d.created_at ? d.created_at.slice(0, 10) : undefined),
            };
          });
          localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(mapped));
          return mapped;
        }
      } catch (err) {
        console.warn('Supabase getExpenses failed, fallback to local', err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    const expenses: Expense[] = raw ? JSON.parse(raw) : [];
    const normalized: Expense[] = expenses.map(e => {
      let status: ExpenseStatus = e.status || 'PENDING';
      let rejection_reason = e.rejection_reason || null;
      let type: ExpenseType = e.type || 'REGULAR';
      let comments: string | null = e.comments || null;

      if (e.rejection_reason === '__PENDING__' || e.rejection_reason === 'PENDING_APPROVAL') {
        status = 'PENDING';
        rejection_reason = null;
      }

      if (comments && comments.includes('[PRABHUPADA_APPEARANCE]')) {
        type = 'PRABHUPADA_APPEARANCE';
        comments = comments.replace('[PRABHUPADA_APPEARANCE]', '').trim() || null;
      }

      return {
        ...e,
        type,
        status,
        comments,
        rejection_reason,
        date: e.date || (e.created_at ? e.created_at.slice(0, 10) : undefined),
      };
    });
    if (cycleMonth) {
      return normalized.filter(
        e => e.cycle_month === cycleMonth || (e.date && e.date.startsWith(cycleMonth)) || e.type === 'JANMASHTAMI' || e.type === 'PRABHUPADA_APPEARANCE'
      );
    }
    return normalized;
  }

  async saveExpense(expense: Omit<Expense, 'id' | 'created_at'> & { id?: string }): Promise<Expense> {
    const allExpenses = await this.getExpenses();
    const expenseDate = expense.date || new Date().toISOString().slice(0, 10);
    const cycleMonth = expense.cycle_month || expenseDate.slice(0, 7);

    const newExpense: Expense = {
      ...expense,
      id: expense.id || generateUUID(),
      date: expenseDate,
      cycle_month: cycleMonth,
      created_at: new Date().toISOString(),
      status: expense.status || 'PENDING',
    };

    const updated = [newExpense, ...allExpenses.filter(e => e.id !== newExpense.id)];
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(updated));

    if (isSupabaseConfigured() && supabase) {
      try {
        const { error } = await supabase.from('expenses').upsert(newExpense, { onConflict: 'id' });
        if (error) {
          console.warn('Supabase saveExpense error, trying fallback:', error);
          
          let candidateToSave: any = { ...newExpense };

          // If remote enum doesn't support 'PRABHUPADA_APPEARANCE' yet, fallback to saving with 'JANMASHTAMI' and a tag
          if (newExpense.type === 'PRABHUPADA_APPEARANCE' && (error.code === '22P02' || error.message?.includes('PRABHUPADA_APPEARANCE') || error.message?.includes('expense_type'))) {
            candidateToSave = {
              ...candidateToSave,
              type: 'JANMASHTAMI',
              comments: `[PRABHUPADA_APPEARANCE] ${newExpense.comments || ''}`.trim(),
            };
          }

          // If remote enum doesn't support 'PENDING' yet, fallback to saving with status 'APPROVED' and rejection_reason '__PENDING__'
          if (error.message?.includes('PENDING') || error.code === '22P02') {
            candidateToSave = {
              ...candidateToSave,
              status: 'APPROVED',
              rejection_reason: '__PENDING__',
            };
          }

          const { error: err2 } = await supabase.from('expenses').upsert(candidateToSave, { onConflict: 'id' });
          if (err2 && (err2.message?.includes('date') || err2.code === '42703')) {
            const { date, ...withoutDate } = candidateToSave;
            await supabase.from('expenses').upsert(withoutDate, { onConflict: 'id' });
          }
        }
      } catch (err) {
        console.warn('Supabase saveExpense error', err);
      }
    }

    this.notifySubscribers();
    return newExpense;
  }

  async updateExpenseStatus(
    id: string,
    status: ExpenseStatus,
    rejection_reason?: string | null
  ): Promise<void> {
    const allExpenses = await this.getExpenses();
    const index = allExpenses.findIndex(e => e.id === id);
    if (index >= 0) {
      const finalRejectionReason = status === 'REJECTED'
        ? rejection_reason || 'Rejected by Admin'
        : null;

      allExpenses[index] = {
        ...allExpenses[index],
        status,
        rejection_reason: finalRejectionReason,
      };
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(allExpenses));

      if (isSupabaseConfigured() && supabase) {
        try {
          const { error } = await supabase.from('expenses').update({
            status,
            rejection_reason: finalRejectionReason,
          }).eq('id', id);

          if (error && (error.message?.includes('PENDING') || error.code === '22P02') && status === 'PENDING') {
            // Fallback for pending if enum lacks 'PENDING'
            await supabase.from('expenses').update({
              status: 'APPROVED',
              rejection_reason: '__PENDING__',
            }).eq('id', id);
          }
        } catch (err) {
          console.warn('Supabase updateExpenseStatus error', err);
        }
      }

      this.notifySubscribers();
    }
  }

  // --- MONTHLY LEDGERS & SETTLEMENTS ---
  async getMonthlyLedgers(cycleMonth?: string): Promise<MonthlyLedger[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        let query = supabase.from('monthly_ledgers').select('*');
        if (cycleMonth) {
          query = query.eq('cycle_month', cycleMonth);
        }
        const { data, error } = await query;
        if (!error && data) {
          const raw = localStorage.getItem(STORAGE_KEYS.MONTHLY_LEDGERS);
          const allLedgers: MonthlyLedger[] = raw ? JSON.parse(raw) : [];
          if (cycleMonth) {
            const otherMonths = allLedgers.filter(l => l.cycle_month !== cycleMonth);
            localStorage.setItem(STORAGE_KEYS.MONTHLY_LEDGERS, JSON.stringify([...otherMonths, ...data]));
          } else {
            localStorage.setItem(STORAGE_KEYS.MONTHLY_LEDGERS, JSON.stringify(data));
          }
          return data as MonthlyLedger[];
        }
      } catch (err) {
        console.warn('Supabase getMonthlyLedgers error', err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEYS.MONTHLY_LEDGERS);
    const ledgers: MonthlyLedger[] = raw ? JSON.parse(raw) : [];
    if (cycleMonth) {
      return ledgers.filter(l => l.cycle_month === cycleMonth);
    }
    return ledgers;
  }

  /**
   * Save manual carry forward amount for a devotee in a cycle month
   */
  async saveDevoteeCarryForward(devoteeId: string, cycleMonth: string, amount: number): Promise<MonthlyLedger> {
    const ledgers = await this.getMonthlyLedgers(cycleMonth);
    const existing = ledgers.find(l => l.devotee_id === devoteeId);
    const updated: MonthlyLedger = {
      id: existing?.id,
      devotee_id: devoteeId,
      cycle_month: cycleMonth,
      carried_forward_amount: Number(amount || 0),
      settlement_amount_reported: existing ? existing.settlement_amount_reported : 0,
      settlement_date_reported: existing ? existing.settlement_date_reported : null,
      settlement_status: existing ? existing.settlement_status : 'UNSETTLED',
      admin_notes: '[OVERRIDE_CF] Manually adjusted by Admin',
    };
    return await this.saveMonthlyLedger(updated);
  }

  async saveMonthlyLedger(ledger: MonthlyLedger): Promise<MonthlyLedger> {
    const raw = localStorage.getItem(STORAGE_KEYS.MONTHLY_LEDGERS);
    const allLedgers: MonthlyLedger[] = raw ? JSON.parse(raw) : [];

    const key = `${ledger.devotee_id}_${ledger.cycle_month}`;
    const index = allLedgers.findIndex(l => `${l.devotee_id}_${l.cycle_month}` === key);

    const isValidUUID = (str?: string | null) =>
      Boolean(str && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str));

    const existingId = index >= 0 ? allLedgers[index].id : undefined;
    const resolvedId = (ledger.id && isValidUUID(ledger.id))
      ? ledger.id
      : (existingId && isValidUUID(existingId) ? existingId : generateUUID());

    const record: MonthlyLedger = {
      ...ledger,
      id: resolvedId,
      carried_forward_amount: Number(ledger.carried_forward_amount || 0),
      settlement_amount_reported: Number(ledger.settlement_amount_reported || 0),
      settlement_date_reported: ledger.settlement_date_reported || null,
      settlement_status: ledger.settlement_status || 'UNSETTLED',
      admin_notes: ledger.admin_notes !== undefined ? ledger.admin_notes : null,
    };

    let updated: MonthlyLedger[];
    if (index >= 0) {
      updated = [...allLedgers];
      updated[index] = record;
    } else {
      updated = [...allLedgers, record];
    }

    localStorage.setItem(STORAGE_KEYS.MONTHLY_LEDGERS, JSON.stringify(updated));

    if (isSupabaseConfigured() && supabase) {
      try {
        const payload: Record<string, any> = {
          devotee_id: record.devotee_id,
          cycle_month: record.cycle_month,
          carried_forward_amount: record.carried_forward_amount,
          settlement_amount_reported: record.settlement_amount_reported,
          settlement_date_reported: record.settlement_date_reported,
          settlement_status: record.settlement_status,
          admin_notes: record.admin_notes,
        };

        if (record.id && isValidUUID(record.id)) {
          payload.id = record.id;
        }

        const { data, error } = await supabase
          .from('monthly_ledgers')
          .upsert(payload, { onConflict: 'devotee_id,cycle_month' })
          .select()
          .single();

        if (!error && data) {
          record.id = data.id;
          const latestRaw = localStorage.getItem(STORAGE_KEYS.MONTHLY_LEDGERS);
          const latestLedgers: MonthlyLedger[] = latestRaw ? JSON.parse(latestRaw) : [];
          const idx = latestLedgers.findIndex(l => `${l.devotee_id}_${l.cycle_month}` === key);
          if (idx >= 0) {
            latestLedgers[idx] = { ...latestLedgers[idx], id: data.id };
            localStorage.setItem(STORAGE_KEYS.MONTHLY_LEDGERS, JSON.stringify(latestLedgers));
          }
        } else if (error) {
          console.warn('Supabase saveMonthlyLedger error:', error.message || error);
        }
      } catch (err) {
        console.warn('Supabase saveMonthlyLedger error', err);
      }
    }

    this.notifySubscribers();
    return record;
  }

  /**
   * Request settlement by devotee (marks as PENDING_VERIFICATION)
   */
  async requestDevoteeSettlement(
    devoteeId: string,
    cycleMonth: string,
    amount: number,
    date: string,
    notes?: string
  ): Promise<MonthlyLedger> {
    const ledgers = await this.getMonthlyLedgers(cycleMonth);
    const existing = ledgers.find(l => l.devotee_id === devoteeId);

    const updated: MonthlyLedger = {
      id: existing?.id,
      devotee_id: devoteeId,
      cycle_month: cycleMonth,
      carried_forward_amount: existing ? Number(existing.carried_forward_amount || 0) : 0,
      settlement_amount_reported: Number(amount),
      settlement_date_reported: date || new Date().toISOString().slice(0, 10),
      settlement_status: 'PENDING_VERIFICATION',
      admin_notes: notes !== undefined ? notes : (existing?.admin_notes || ''),
    };

    return await this.saveMonthlyLedger(updated);
  }

  /**
   * Admin approves / settles devotee balance
   */
  async verifyAndSettleDevotee(
    devoteeId: string,
    cycleMonth: string,
    amount: number,
    date: string,
    notes?: string
  ): Promise<MonthlyLedger> {
    const ledgers = await this.getMonthlyLedgers(cycleMonth);
    const existing = ledgers.find(l => l.devotee_id === devoteeId);

    const updated: MonthlyLedger = {
      id: existing?.id,
      devotee_id: devoteeId,
      cycle_month: cycleMonth,
      carried_forward_amount: existing ? Number(existing.carried_forward_amount || 0) : 0,
      settlement_amount_reported: Number(amount),
      settlement_date_reported: date || new Date().toISOString().slice(0, 10),
      settlement_status: 'SETTLED',
      admin_notes: notes !== undefined ? notes : (existing?.admin_notes || 'Verified by Admin'),
    };

    return await this.saveMonthlyLedger(updated);
  }

  /**
   * Admin resets settlement to UNSETTLED
   */
  async resetDevoteeSettlement(
    devoteeId: string,
    cycleMonth: string
  ): Promise<MonthlyLedger> {
    const ledgers = await this.getMonthlyLedgers(cycleMonth);
    const existing = ledgers.find(l => l.devotee_id === devoteeId);

    const updated: MonthlyLedger = {
      id: existing?.id,
      devotee_id: devoteeId,
      cycle_month: cycleMonth,
      carried_forward_amount: existing ? Number(existing.carried_forward_amount || 0) : 0,
      settlement_amount_reported: 0,
      settlement_date_reported: null,
      settlement_status: 'UNSETTLED',
      admin_notes: existing?.admin_notes || '',
    };

    return await this.saveMonthlyLedger(updated);
  }

  /**
   * Carry forward balances to next month
   */
  async carryOverBalancesToNextMonth(
    currentMonth: string,
    nextMonth: string,
    summaries: { devoteeId: string; finalBalance: number }[]
  ): Promise<number> {
    const nextLedgers = await this.getMonthlyLedgers(nextMonth);
    const nextMap = new Map(nextLedgers.map(l => [l.devotee_id, l]));

    for (const item of summaries) {
      const existingNext = nextMap.get(item.devoteeId);
      const hasExistingSettlement = Boolean(existingNext && existingNext.settlement_amount_reported > 0);
      const updated: MonthlyLedger = {
        id: existingNext?.id,
        devotee_id: item.devoteeId,
        cycle_month: nextMonth,
        carried_forward_amount: Number(item.finalBalance || 0), // roll forward final balance
        settlement_amount_reported: hasExistingSettlement ? existingNext!.settlement_amount_reported : 0,
        settlement_date_reported: hasExistingSettlement ? existingNext!.settlement_date_reported : null,
        settlement_status: hasExistingSettlement ? existingNext!.settlement_status : 'UNSETTLED',
        admin_notes: existingNext?.admin_notes || `Carried forward ₹${item.finalBalance} from ${currentMonth}`,
      };
      await this.saveMonthlyLedger(updated);
    }

    return summaries.length;
  }

  // --- SYSTEM CONFIG & ADMIN PIN ---
  async getSystemConfig(key: string, defaultValue: string = ''): Promise<string> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase.from('system_config').select('value').eq('key', key).single();
        if (!error && data) {
          return data.value;
        }
      } catch (err) {
        console.warn('Supabase getSystemConfig error', err);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEYS.SYSTEM_CONFIG);
    const config: Record<string, string> = raw ? JSON.parse(raw) : DEFAULT_CONFIG;
    return config[key] || defaultValue || DEFAULT_CONFIG[key] || '';
  }

  async setSystemConfig(key: string, value: string): Promise<void> {
    const raw = localStorage.getItem(STORAGE_KEYS.SYSTEM_CONFIG);
    const config: Record<string, string> = raw ? JSON.parse(raw) : DEFAULT_CONFIG;
    config[key] = value;
    localStorage.setItem(STORAGE_KEYS.SYSTEM_CONFIG, JSON.stringify(config));

    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('system_config').upsert({ key, value });
      } catch (err) {
        console.warn('Supabase setSystemConfig error', err);
      }
    }

    this.notifySubscribers();
  }

  /**
   * Upload receipt to Supabase Storage or convert to Base64 data URL
   */
  async uploadReceipt(file: File): Promise<string> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const filename = `${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
        const { data, error } = await supabase.storage.from('bills').upload(filename, file, {
          cacheControl: '3600',
          upsert: false,
        });

        if (!error && data) {
          const { data: publicUrlData } = supabase.storage.from('bills').getPublicUrl(filename);
          return publicUrlData.publicUrl;
        }
      } catch (err) {
        console.warn('Supabase storage upload failed, falling back to base64 encoding', err);
      }
    }

    // Fallback: Store as base64 string
    return await fileToBase64(file);
  }

  // --- LOCAL PERSISTENCE HELPERS ---
  getActivePhone(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_DEVOTEE_PHONE);
  }

  setActivePhone(phone: string | null): void {
    if (phone) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_DEVOTEE_PHONE, phone);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_DEVOTEE_PHONE);
    }
  }

  getActiveGuest(): string | null {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_GUEST_NAME);
  }

  setActiveGuest(name: string | null): void {
    if (name) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_GUEST_NAME, name);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_GUEST_NAME);
    }
  }

  getAdminAuthenticated(): boolean {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === 'true';
  }

  setAdminAuthenticated(auth: boolean): void {
    if (auth) {
      localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, 'true');
    } else {
      localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
    }
  }

  getDataEnvironment() {
    return getDataEnvironmentInfo();
  }

  resetDatabaseToDefaults(): void {
    localStorage.removeItem(STORAGE_KEYS.DEVOTEES);
    localStorage.removeItem(STORAGE_KEYS.PRASADAM_COUNTS);
    localStorage.removeItem(STORAGE_KEYS.EXPENSES);
    localStorage.removeItem(STORAGE_KEYS.MONTHLY_LEDGERS);
    localStorage.removeItem(STORAGE_KEYS.SYSTEM_CONFIG);
    localStorage.removeItem(STORAGE_KEYS.SCHEMA_VERSION);
    this.initialized = false;
    this.init();
    this.notifySubscribers();
  }

  // Reactive listeners
  private listeners: (() => void)[] = [];

  subscribe(listener: () => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifySubscribers() {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (err) {
        console.error('Subscriber notification error', err);
      }
    });
  }
}

export const storageService = new StorageService();
