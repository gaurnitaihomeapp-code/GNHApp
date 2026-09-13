import { PrasadamCount, Expense, MonthlyLedger, Devotee, DevoteeMonthlySummary, FriendSummary } from '../types';
import { getFamilyMemberNames, getPureFamilyMembers, getFriendMembers } from './devoteeHelpers';

export const PRASADAM_RATES = {
  breakfast: 40,
  lunch: 80,
  dinner: 40,
} as const;

/**
 * Returns the total days in a given YYYY-MM month string
 */
export function getDaysInMonth(cycleMonth: string): number {
  const [yearStr, monthStr] = cycleMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-indexed
  return new Date(year, month, 0).getDate();
}

/**
 * Returns an array of date strings 'YYYY-MM-DD' for the month
 */
export function getAllDatesInMonth(cycleMonth: string): string[] {
  const [yearStr, monthStr] = cycleMonth.split('-');
  const daysCount = getDaysInMonth(cycleMonth);
  const dates: string[] = [];
  for (let d = 1; d <= daysCount; d++) {
    const dayFormatted = d.toString().padStart(2, '0');
    dates.push(`${yearStr}-${monthStr}-${dayFormatted}`);
  }
  return dates;
}

/**
 * Calculates the Cutoff Date/Time:
 * 8:00 PM (20:00) on the N-2 day of the given month (2 days before month end).
 * e.g., for August (31 days, N=31) -> Aug 29 at 20:00:00.
 */
export function getCutoffDateTime(cycleMonth: string): Date {
  const [yearStr, monthStr] = cycleMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const totalDays = new Date(year, month, 0).getDate();
  const cutoffDay = totalDays - 2;

  // Month is 0-indexed in JS Date constructor
  return new Date(year, month - 1, cutoffDay, 20, 0, 0, 0);
}

/**
 * Returns exact formatted Cutoff Date string, e.g. "29 Aug 2026, 8:00 PM"
 */
export function getCutoffFormattedDate(cycleMonth: string): string {
  const cutoff = getCutoffDateTime(cycleMonth);
  const day = cutoff.getDate();
  const monthName = cutoff.toLocaleDateString('en-US', { month: 'short' });
  const year = cutoff.getFullYear();
  return `${day} ${monthName} ${year}, 8:00 PM`;
}

/**
 * Returns exact formatted Cutoff Day string, e.g. "29 Aug 2026"
 */
export function getCutoffDayFormatted(cycleMonth: string): string {
  const cutoff = getCutoffDateTime(cycleMonth);
  const day = cutoff.getDate();
  const monthName = cutoff.toLocaleDateString('en-US', { month: 'short' });
  const year = cutoff.getFullYear();
  return `${day} ${monthName} ${year}`;
}

/**
 * Returns exact formatted Cash Settlement Day string: N-1 day of the month, e.g. "30 Aug 2026"
 */
export function getCashSettlementDayFormatted(cycleMonth: string): string {
  const [yearStr, monthStr] = cycleMonth.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const totalDays = new Date(year, month, 0).getDate();
  const settlementDay = totalDays - 1; // N-1 day of the month
  const date = new Date(year, month - 1, settlementDay);
  const day = date.getDate();
  const monthName = date.toLocaleDateString('en-US', { month: 'short' });
  const yearNum = date.getFullYear();
  return `${day} ${monthName} ${yearNum}`;
}

/**
 * Formats an expense date string ('YYYY-MM-DD') into a human-readable format like "18 Aug 2026"
 */
export function formatExpenseDate(dateStr?: string | null): string {
  if (!dateStr) return '-';
  try {
    const cleanDate = dateStr.slice(0, 10);
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        const dayFormatted = d.getDate();
        const monthName = d.toLocaleDateString('en-US', { month: 'short' });
        const yearFormatted = d.getFullYear();
        return `${dayFormatted} ${monthName} ${yearFormatted}`;
      }
    }
  } catch {
    // fallback
  }
  return dateStr.slice(0, 10);
}

/**
 * Formats an ISO submission timestamp into a readable date and time, e.g. "27 Aug 2026, 10:21 AM"
 */
export function formatSubmissionDateTime(isoStr?: string | null): string {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) {
      const day = d.getDate();
      const monthName = d.toLocaleDateString('en-US', { month: 'short' });
      const year = d.getFullYear();
      const timeStr = d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
      return `${day} ${monthName} ${year}, ${timeStr}`;
    }
  } catch {
    // fallback
  }
  return isoStr;
}

/**
 * Generates the custom Vaishnava reminder message for monthly prasadam & expense submissions
 */
export function generateCustomReminderMessage(
  cycleMonth: string,
  phoneNumber: string = '<phoneNumber>',
  devoteeName?: string
): string {
  const exactCutoff = getCutoffFormattedDate(cycleMonth);
  const cashHandoverDay = getCashSettlementDayFormatted(cycleMonth);
  const greeting = devoteeName ? `Hare Krishna ${devoteeName}, PAMHO` : 'Hare Krishna, PAMHO';
  const baseUrl = 'https://gnh-app.vercel.app';

  return `${greeting}
Please update your Prasadam counts and expenses for this month:

Step 1: Enter Details
${baseUrl}/?tab=prasadam&month=${cycleMonth}&phone=${phoneNumber}
Deadline: ${exactCutoff} (Note: If not submitted in time, the app will automatically record a full count.)

Step 2: Check Contribution
${baseUrl}/?tab=reports&month=${cycleMonth}&phone=${phoneNumber}
View your final contribution amount here once your details are entered.

Step 3: Cash Settlement
Please hand over the cash by ${cashHandoverDay}

Kindly ensure these timelines are strictly adhered to so accounts can be finalized smoothly.

YS,
Accounts Incharge`;
}

/**
 * Checks if the cutoff has passed for a given month relative to a specific time
 */
export function isCutoffPassed(cycleMonth: string, now: Date = new Date()): boolean {
  const cutoff = getCutoffDateTime(cycleMonth);
  return now.getTime() >= cutoff.getTime();
}

/**
 * Calculates human-readable countdown to cutoff
 */
export function getCutoffCountdown(cycleMonth: string, now: Date = new Date()): {
  isPassed: boolean;
  text: string;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
} {
  const cutoff = getCutoffDateTime(cycleMonth);
  const diffMs = cutoff.getTime() - now.getTime();

  if (diffMs <= 0) {
    return {
      isPassed: true,
      text: 'Closed (Booking Closed)',
      days: 0,
      hours: 0,
      minutes: 0,
      seconds: 0,
    };
  }

  const seconds = Math.floor((diffMs / 1000) % 60);
  const minutes = Math.floor((diffMs / (1000 * 60)) % 60);
  const hours = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  let text = '';
  if (days > 0) text += `${days}d `;
  text += `${hours}h ${minutes}m ${seconds}s`;

  return {
    isPassed: false,
    text: `Closes in ${text}`,
    days,
    hours,
    minutes,
    seconds,
  };
}

/**
 * Formats devotee name:
 * If 1 family member, doesn't mention "Group".
 */
export function formatDevoteeName(devotee: Devotee): string {
  const names = getFamilyMemberNames(devotee);
  if (names && names.length === 1) {
    return names[0];
  }
  return devotee.group_name;
}

export const DEFAULT_COMMUNITY_COST_PER_MEMBER = 500;

/**
 * Compute raw Meals cost for given counts (Breakfast, Lunch, Dinner)
 */
export function calculateMealsCost(breakfast: number, lunch: number, dinner: number): number {
  return (
    breakfast * PRASADAM_RATES.breakfast +
    lunch * PRASADAM_RATES.lunch +
    dinner * PRASADAM_RATES.dinner
  );
}

/**
 * Compute Total Prasadam cost including meals cost and family member community cost
 */
export function calculatePrasadamCost(
  breakfast: number,
  lunch: number,
  dinner: number,
  memberCount: number = 0,
  communityCostPerMember: number = DEFAULT_COMMUNITY_COST_PER_MEMBER
): number {
  const mealsCost = calculateMealsCost(breakfast, lunch, dinner);
  const communityCost = memberCount * communityCostPerMember;
  return mealsCost + communityCost;
}

/**
 * Compute auto-fill slots for a devotee in a given month:
 * Max entered B, Max entered L, Max entered D.
 * Default to 1 if no entered counts exist.
 */
export function calculateDevoteeMaxCounts(counts: PrasadamCount[]): {
  maxB: number;
  maxL: number;
  maxD: number;
} {
  const enteredCounts = counts.filter(c => !c.is_auto_filled && (c.breakfast_count > 0 || c.lunch_count > 0 || c.dinner_count > 0));
  
  if (enteredCounts.length === 0) {
    return { maxB: 1, maxL: 1, maxD: 1 };
  }

  const maxB = Math.max(...enteredCounts.map(c => c.breakfast_count), 0);
  const maxL = Math.max(...enteredCounts.map(c => c.lunch_count), 0);
  const maxD = Math.max(...enteredCounts.map(c => c.dinner_count), 0);

  return {
    maxB: maxB > 0 ? maxB : 1,
    maxL: maxL > 0 ? maxL : 1,
    maxD: maxD > 0 ? maxD : 1,
  };
}

export const MIN_CYCLE_MONTH = '2026-08';

/**
 * Get all calendar cycle months between startMonth and endMonth inclusive ('YYYY-MM')
 */
export function getMonthsBetween(startMonth: string, endMonth: string): string[] {
  const validStart = startMonth < MIN_CYCLE_MONTH ? MIN_CYCLE_MONTH : startMonth;
  const validEnd = endMonth < validStart ? validStart : endMonth;

  const months: string[] = [];
  const [startYear, startM] = validStart.split('-').map(Number);
  const [endYear, endM] = validEnd.split('-').map(Number);

  let curYear = startYear;
  let curMonth = startM;

  while (curYear < endYear || (curYear === endYear && curMonth <= endM)) {
    months.push(`${curYear}-${curMonth.toString().padStart(2, '0')}`);
    curMonth++;
    if (curMonth > 12) {
      curMonth = 1;
      curYear++;
    }
  }

  return months.length > 0 ? months : [MIN_CYCLE_MONTH];
}

/**
 * Get previous cycle month with minimum boundary clamp
 */
export function getPreviousCycleMonth(cycleMonth: string): string {
  if (cycleMonth <= MIN_CYCLE_MONTH) return MIN_CYCLE_MONTH;
  const [yearStr, monthStr] = cycleMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) - 1;
  if (month < 1) {
    month = 12;
    year -= 1;
  }
  const prev = `${year}-${month.toString().padStart(2, '0')}`;
  return prev < MIN_CYCLE_MONTH ? MIN_CYCLE_MONTH : prev;
}

/**
 * Get next cycle month
 */
export function getNextCycleMonth(cycleMonth: string): string {
  const [yearStr, monthStr] = cycleMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + 1;
  if (month > 12) {
    month = 1;
    year += 1;
  }
  return `${year}-${month.toString().padStart(2, '0')}`;
}

/**
 * Computes full summary for a single devotee for the active month
 */
export function computeDevoteeMonthlySummary(
  devotee: Devotee,
  cycleMonth: string,
  allCounts: PrasadamCount[],
  allExpenses: Expense[],
  ledger?: MonthlyLedger | null,
  communityCostPerMember: number = DEFAULT_COMMUNITY_COST_PER_MEMBER,
  now: Date = new Date(),
  overrideCarriedForward?: number
): DevoteeMonthlySummary {
  const devoteeCounts = allCounts.filter(
    c => c.devotee_id === devotee.id && c.date.startsWith(cycleMonth)
  );

  const monthDates = getAllDatesInMonth(cycleMonth);
  const countMap = new Map(devoteeCounts.map(c => [c.date, c]));

  let breakfast_total = 0;
  let lunch_total = 0;
  let dinner_total = 0;
  let unfilled_days = 0;

  monthDates.forEach(dateStr => {
    const entry = countMap.get(dateStr);
    if (entry) {
      breakfast_total += entry.breakfast_count || 0;
      lunch_total += entry.lunch_count || 0;
      dinner_total += entry.dinner_count || 0;
      if (entry.breakfast_count === 0 && entry.lunch_count === 0 && entry.dinner_count === 0 && !entry.is_auto_filled) {
        unfilled_days++;
      }
    } else {
      unfilled_days++;
    }
  });

  const family_meals_cost = calculateMealsCost(breakfast_total, lunch_total, dinner_total);

  // Participant-level Community Cost Calculation
  const defaultGroupCost = typeof devotee.community_cost === 'number' ? devotee.community_cost : communityCostPerMember;
  const pureFamily = getPureFamilyMembers(devotee);
  let family_community_cost = 0;
  const family_member_count = pureFamily.length > 0 ? pureFamily.length : 1;

  if (pureFamily.length > 0) {
    pureFamily.forEach(member => {
      const memberCost = typeof member.community_cost === 'number' ? member.community_cost : defaultGroupCost;
      family_community_cost += memberCost;
    });
  } else {
    family_community_cost = defaultGroupCost;
  }

  const family_prasadam_cost = family_meals_cost + family_community_cost;

  // Separate Friend Breakdown Calculations
  const friendMembers = getFriendMembers(devotee);
  const friends_summaries: FriendSummary[] = friendMembers.map(friend => {
    const friendCounts = friend.monthly_counts?.[cycleMonth] || { breakfast: 0, lunch: 0, dinner: 0 };
    const b = friendCounts.breakfast || 0;
    const l = friendCounts.lunch || 0;
    const d = friendCounts.dinner || 0;
    const fMeals = b + l + d;
    const fMealsCost = calculateMealsCost(b, l, d);
    const fCommunityCost = typeof friend.community_cost === 'number' ? friend.community_cost : defaultGroupCost;
    const fTotalCost = fMealsCost + fCommunityCost;

    return {
      name: friend.name,
      phone_number: friend.phone_number,
      breakfast_total: b,
      lunch_total: l,
      dinner_total: d,
      total_meals: fMeals,
      meals_cost: fMealsCost,
      community_cost: fCommunityCost,
      total_cost: fTotalCost,
    };
  });

  const friends_total_meals = friends_summaries.reduce((sum, f) => sum + f.total_meals, 0);
  const friends_meals_cost = friends_summaries.reduce((sum, f) => sum + f.meals_cost, 0);
  const friends_community_cost = friends_summaries.reduce((sum, f) => sum + f.community_cost, 0);
  const friends_total_cost = friends_summaries.reduce((sum, f) => sum + f.total_cost, 0);

  // Combined Grand Totals
  const total_meals = (breakfast_total + lunch_total + dinner_total) + friends_total_meals;
  const meals_cost = family_meals_cost + friends_meals_cost;
  const community_cost = family_community_cost + friends_community_cost;
  const prasadam_cost = family_prasadam_cost + friends_total_cost;

  // Filter regular expenses for this devotee and cycle month
  const devoteeRegularExpenses = allExpenses.filter(
    e => e.devotee_id === devotee.id &&
      (e.cycle_month === cycleMonth || (e.date && e.date.startsWith(cycleMonth))) &&
      e.type === 'REGULAR'
  );

  const approved_only = devoteeRegularExpenses
    .filter(e => e.status === 'APPROVED')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const pending_expenses = devoteeRegularExpenses
    .filter(e => e.status === 'PENDING')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const rejected_expenses = devoteeRegularExpenses
    .filter(e => e.status === 'REJECTED')
    .reduce((sum, e) => sum + Number(e.amount), 0);

  const has_pending_expenses = pending_expenses > 0;

  // As far as pending calculations are concerned, assumed that they are approved:
  const assumed_approved_expenses = approved_only + pending_expenses;

  const current_month_net = prasadam_cost - assumed_approved_expenses;
  const carried_forward = overrideCarriedForward !== undefined
    ? Number(overrideCarriedForward || 0)
    : (ledger ? Number(ledger.carried_forward_amount || 0) : 0);
  const settlement_reported = ledger && (ledger.settlement_status === 'SETTLED' || ledger.settlement_status === 'PENDING_VERIFICATION')
    ? Number(ledger.settlement_amount_reported || 0)
    : 0;

  const final_balance = current_month_net + carried_forward - settlement_reported;

  // Filter Janmashtami expenses (treat APPROVED and PENDING as assumed seva)
  const devoteeJanmashtamiExpenses = allExpenses.filter(
    e => e.devotee_id === devotee.id && e.type === 'JANMASHTAMI' && (e.status === 'APPROVED' || e.status === 'PENDING')
  );
  const janmashtami_expenses = devoteeJanmashtamiExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  // Filter Prabhupada Appearance Day expenses (treat APPROVED and PENDING as assumed seva)
  const devoteePrabhupadaExpenses = allExpenses.filter(
    e => e.devotee_id === devotee.id && e.type === 'PRABHUPADA_APPEARANCE' && (e.status === 'APPROVED' || e.status === 'PENDING')
  );
  const prabhupada_expenses = devoteePrabhupadaExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const is_locked = isCutoffPassed(cycleMonth, now);

  return {
    devotee,
    cycle_month: cycleMonth,
    breakfast_total,
    lunch_total,
    dinner_total,
    total_meals,
    meals_cost,
    family_member_count,
    community_cost_per_member: defaultGroupCost,
    community_cost,
    prasadam_cost,
    approved_expenses: assumed_approved_expenses,
    pending_expenses,
    has_pending_expenses,
    rejected_expenses,
    current_month_net,
    carried_forward,
    settlement_reported,
    settlement_status: ledger?.settlement_status || 'UNSETTLED',
    settlement_date_reported: ledger?.settlement_date_reported || null,
    final_balance,
    unfilled_days,
    is_locked,
    janmashtami_expenses,
    prabhupada_expenses,
    family_meals_cost,
    family_community_cost,
    family_prasadam_cost,
    friends_summaries,
    friends_total_cost,
  };
}

/**
 * Computes devotee monthly summary chaining carry forward recursively from MIN_CYCLE_MONTH to activeMonth
 */
export function computeDevoteeMonthlySummaryWithCarryForward(
  devotee: Devotee,
  activeMonth: string,
  allCounts: PrasadamCount[],
  allExpenses: Expense[],
  allLedgers: MonthlyLedger[],
  communityCostPerMember: number = DEFAULT_COMMUNITY_COST_PER_MEMBER,
  now: Date = new Date()
): DevoteeMonthlySummary {
  const targetMonth = activeMonth < MIN_CYCLE_MONTH ? MIN_CYCLE_MONTH : activeMonth;
  const months = getMonthsBetween(MIN_CYCLE_MONTH, targetMonth);
  let runningCarryForward = 0;
  let activeMonthSummary: DevoteeMonthlySummary | null = null;

  for (const m of months) {
    const monthLedger = allLedgers.find(l => l.devotee_id === devotee.id && l.cycle_month === m);
    
    // For MIN_CYCLE_MONTH, opening balance can come from existing ledger if set
    // For subsequent months, check if ledger has a manual override note, otherwise roll forward runningCarryForward
    const isManualOverride = Boolean(monthLedger?.admin_notes && monthLedger.admin_notes.includes('[OVERRIDE_CF]'));
    const carriedForwardForMonth = (m === MIN_CYCLE_MONTH)
      ? Number(monthLedger?.carried_forward_amount || 0)
      : (isManualOverride
        ? Number(monthLedger?.carried_forward_amount || 0)
        : runningCarryForward);

    const summary = computeDevoteeMonthlySummary(
      devotee,
      m,
      allCounts,
      allExpenses,
      monthLedger,
      communityCostPerMember,
      now,
      carriedForwardForMonth
    );

    // The ending final balance rolls forward as the next month's starting carry forward
    runningCarryForward = summary.final_balance;

    if (m === targetMonth) {
      activeMonthSummary = summary;
    }
  }

  return activeMonthSummary || computeDevoteeMonthlySummary(
    devotee,
    targetMonth,
    allCounts,
    allExpenses,
    allLedgers.find(l => l.devotee_id === devotee.id && l.cycle_month === targetMonth),
    communityCostPerMember,
    now
  );
}

/**
 * Format currency with Indian rupee symbol
 */
export function formatRupee(amount: number): string {
  if (!amount || Math.abs(amount) < 0.001) {
    return '₹0';
  }
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(absAmount);

  return `${isNegative ? '-' : ''}₹${formatted}`;
}

/**
 * Month string helper e.g. "2026-08" -> "August 2026"
 */
export function formatMonthName(cycleMonth: string): string {
  const [yearStr, monthStr] = cycleMonth.split('-');
  const date = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Get current cycle month formatted 'YYYY-MM', bounded by MIN_CYCLE_MONTH
 */
export function getCurrentCycleMonth(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const current = `${yyyy}-${mm}`;
  return current < MIN_CYCLE_MONTH ? MIN_CYCLE_MONTH : current;
}

/**
 * Get default expense date: defaults to today if in activeMonth, otherwise 1st of activeMonth
 */
export function getDefaultExpenseDate(activeMonth?: string): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!activeMonth || today.startsWith(activeMonth)) {
    return today;
  }
  return `${activeMonth}-01`;
}
