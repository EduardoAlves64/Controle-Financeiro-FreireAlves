export type Scope = "individual" | "shared";
export type Visibility = "household" | "private";
export type AccountType = "checking" | "savings" | "cash" | "digital" | "investment" | "other";
export type TransactionKind = "income" | "expense" | "invoice_payment" | "adjustment";
export type TransactionStatus = "paid" | "pending";
export type PaymentMethod = "pix" | "debit" | "credit_card" | "cash" | "bank_slip" | "transfer" | "other";
export type CategoryKind = "income" | "expense";
export type Frequency = "weekly" | "biweekly" | "monthly" | "bimonthly" | "quarterly" | "semiannual" | "annual";
export type RecurringStatus = "active" | "paused" | "canceled";
export type InstanceStatus = "pending" | "paid" | "skipped";
export type InvoiceStatus = "open" | "closed" | "paid" | "overdue" | "empty";
export type DebtType = "loan" | "financing" | "installment_purchase" | "personal" | "family" | "agreement" | "other";
export type DebtStatus = "active" | "paid_off" | "canceled";
export type GoalStatus = "active" | "completed" | "archived";
export type Money = number | string;

export interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  household_id: string | null;
  theme: "light" | "dark" | "system";
  notification_prefs: Record<string, boolean>;
}

export interface Household {
  id: string;
  name: string;
  invite_code: string;
}

export interface Member {
  user_id: string;
  role: "owner" | "member";
  full_name: string;
  avatar_url: string | null;
}

export interface Category {
  id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  is_system: boolean;
  archived_at: string | null;
}

interface Owned {
  owner_id: string;
  scope: Scope;
  visibility: Visibility;
  is_demo: boolean;
}

export interface Account extends Owned {
  id: string;
  name: string;
  institution: string | null;
  type: AccountType;
  initial_balance: Money;
  color: string;
  include_in_total: boolean;
  archived_at: string | null;
  balance?: number;
}

export interface Transaction extends Owned {
  id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  description: string;
  amount: Money;
  category_id: string | null;
  date: string;
  due_date: string | null;
  paid_at: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  invoice_id: string | null;
  payment_method: PaymentMethod | null;
  notes: string | null;
  installment_group: string | null;
  installment_number: number | null;
  installment_total: number | null;
  recurring_instance_id: string | null;
  debt_id: string | null;
  debt_installment_id: string | null;
  created_at: string;
}

export interface CreditCard extends Owned {
  id: string;
  name: string;
  bank: string | null;
  brand: string;
  last4: string | null;
  credit_limit: Money;
  closing_day: number;
  due_day: number;
  color: string;
  archived_at: string | null;
}

export interface Invoice {
  id: string;
  card_id: string;
  reference_month: string;
  closing_date: string;
  due_date: string;
  total: Money;
  paid_amount: Money;
  status: InvoiceStatus;
}

export interface RecurringTransaction extends Owned {
  id: string;
  name: string;
  kind: CategoryKind;
  amount: Money;
  category_id: string | null;
  account_id: string | null;
  payment_method: PaymentMethod;
  frequency: Frequency;
  due_day: number;
  start_date: string;
  end_date: string | null;
  status: RecurringStatus;
  notes: string | null;
}

export interface RecurringInstance {
  id: string;
  recurring_id: string;
  original_due_date: string;
  due_date: string;
  amount: Money;
  status: InstanceStatus;
  paid_at: string | null;
}

export interface Debt extends Owned {
  id: string;
  name: string;
  creditor: string | null;
  type: DebtType;
  original_amount: Money;
  interest_rate: Money;
  installments_count: number;
  installment_amount: Money;
  contract_date: string;
  first_due_date: string;
  priority: 1 | 2 | 3;
  status: DebtStatus;
  paid_off_at: string | null;
  notes: string | null;
  created_at: string;
  total_to_pay: Money;
  paid_total: Money;
  outstanding: Money;
  paid_count: number;
  pending_count: number;
  next_due_date: string | null;
  next_amount: Money | null;
  last_due_date: string | null;
}

export interface DebtInstallment {
  id: string;
  debt_id: string;
  number: number;
  due_date: string;
  amount: Money;
  paid_amount: Money;
  last_paid_at: string | null;
  status: "paid" | "pending" | "overdue";
}

export interface Budget {
  id: string;
  category_id: string;
  amount: Money;
  alert_threshold: number;
  is_demo: boolean;
}

export interface Goal extends Owned {
  id: string;
  name: string;
  description: string | null;
  target_amount: Money;
  target_date: string | null;
  icon: string;
  color: string;
  status: GoalStatus;
  created_at: string;
}

export interface GoalContribution {
  id: string;
  goal_id: string;
  amount: Money;
  date: string;
  note: string | null;
}

export interface Transfer {
  id: string;
  from_account_id: string;
  to_account_id: string;
  amount: Money;
  date: string;
  description: string | null;
  is_demo: boolean;
}

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };
