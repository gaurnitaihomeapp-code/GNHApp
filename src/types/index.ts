export type MealType = 'breakfast' | 'lunch' | 'dinner';

export type ExpenseType = 'REGULAR' | 'JANMASHTAMI' | 'PRABHUPADA_APPEARANCE';
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type SettlementState = 'UNSETTLED' | 'PENDING_VERIFICATION' | 'SETTLED';

export interface FamilyMember {
  id?: string;
  name: string;
  phone_number?: string; // Optional: 10-digit mobile or empty/blank
  is_friend?: boolean; // When true, count and calculations are kept separate
  community_cost?: number; // Optional custom community cost override for this participant
  monthly_counts?: Record<string, { breakfast: number; lunch: number; dinner: number }>; // cycle_month -> counts
}

export interface Devotee {
  id: string;
  phone_number: string;
  group_name: string;
  family_members: (string | FamilyMember)[];
  community_cost?: number; // Optional custom community cost per participant for this group
  is_admin?: boolean;
  created_at?: string;
}

export interface PrasadamCount {
  id?: string;
  devotee_id: string;
  date: string; // 'YYYY-MM-DD'
  breakfast_count: number;
  lunch_count: number;
  dinner_count: number;
  is_auto_filled: boolean;
  updated_at?: string;
}

export interface Expense {
  id: string;
  devotee_id: string | null;
  guest_name?: string | null;
  date?: string; // 'YYYY-MM-DD' Expense Date
  type: ExpenseType;
  payer_name: string;
  title: string;
  amount: number;
  comments?: string | null;
  bill_url?: string | null;
  status: ExpenseStatus;
  rejection_reason?: string | null;
  cycle_month: string; // 'YYYY-MM'
  created_at: string;
}

export interface MonthlyLedger {
  id?: string;
  devotee_id: string;
  cycle_month: string; // 'YYYY-MM'
  carried_forward_amount: number;
  settlement_amount_reported: number;
  settlement_date_reported: string | null;
  settlement_status: SettlementState;
  admin_notes?: string | null;
}

export interface SystemConfig {
  key: string;
  value: string;
}

export interface FriendSummary {
  name: string;
  phone_number?: string;
  breakfast_total: number;
  lunch_total: number;
  dinner_total: number;
  total_meals: number;
  meals_cost: number;
  community_cost: number;
  total_cost: number; // meals_cost + community_cost
}

export interface DevoteeMonthlySummary {
  devotee: Devotee;
  cycle_month: string;
  breakfast_total: number;
  lunch_total: number;
  dinner_total: number;
  total_meals: number;
  meals_cost: number;
  family_member_count: number;
  community_cost_per_member: number;
  community_cost: number;
  prasadam_cost: number; // Combined Meals Cost + Community Cost (Family + Friends)
  approved_expenses: number;
  rejected_expenses: number;
  pending_expenses: number;
  has_pending_expenses: boolean;
  current_month_net: number; // Prasadam Cost - (Approved + Assumed Pending Expenses)
  carried_forward: number;
  settlement_reported: number;
  settlement_status: SettlementState;
  settlement_date_reported: string | null;
  final_balance: number; // Current Month Net + Carried Forward - Settlement Reported
  unfilled_days: number;
  is_locked: boolean;
  janmashtami_expenses: number;
  prabhupada_expenses: number;
  // Separate Breakdown for Family vs Friends
  family_meals_cost?: number;
  family_community_cost?: number;
  family_prasadam_cost?: number;
  friends_summaries?: FriendSummary[];
  friends_total_cost?: number;
}

export type ActiveTab = 'reports' | 'prasadam' | 'appearance_day' | 'janmashtami' | 'admin';
