import type { AccountType, DebtType, Frequency, PaymentMethod } from "./types";

export const APP_NAME = "Finance Hub";

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  checking: "Conta corrente",
  savings: "Poupança",
  cash: "Dinheiro",
  digital: "Conta digital",
  investment: "Investimentos",
  other: "Outros",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  pix: "Pix",
  debit: "Débito",
  credit_card: "Cartão de crédito",
  cash: "Dinheiro",
  bank_slip: "Boleto",
  transfer: "Transferência",
  other: "Outro",
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  weekly: "Semanal",
  biweekly: "Quinzenal",
  monthly: "Mensal",
  bimonthly: "Bimestral",
  quarterly: "Trimestral",
  semiannual: "Semestral",
  annual: "Anual",
};

/** Multiplicador para estimar o custo mensal equivalente */
export const FREQUENCY_PER_MONTH: Record<Frequency, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  bimonthly: 1 / 2,
  quarterly: 1 / 3,
  semiannual: 1 / 6,
  annual: 1 / 12,
};

export const DEBT_TYPE_LABEL: Record<DebtType, string> = {
  loan: "Empréstimo",
  financing: "Financiamento",
  installment_purchase: "Compra parcelada",
  personal: "Dívida pessoal",
  family: "Empréstimo de familiar",
  agreement: "Acordo de pagamento",
  other: "Outra",
};

export const CARD_BRANDS = [
  { value: "visa", label: "Visa" },
  { value: "mastercard", label: "Mastercard" },
  { value: "elo", label: "Elo" },
  { value: "amex", label: "American Express" },
  { value: "hipercard", label: "Hipercard" },
  { value: "other", label: "Outra" },
] as const;

export const PRIORITY_LABEL: Record<number, string> = { 1: "Alta", 2: "Média", 3: "Baixa" };

export const NOTIFICATION_TYPES = [
  { key: "bill_due_soon", label: "Contas próximas do vencimento" },
  { key: "bill_overdue", label: "Contas vencidas" },
  { key: "card_closing", label: "Cartões próximos do fechamento" },
  { key: "invoice_due", label: "Faturas próximas do vencimento" },
  { key: "budget_warning", label: "Orçamento próximo do limite" },
  { key: "budget_exceeded", label: "Orçamento ultrapassado" },
  { key: "goal_reached", label: "Metas atingidas" },
  { key: "debt_installment_due", label: "Parcelas de dívidas a vencer" },
] as const;

export const COLOR_SWATCHES = [
  "#4969E8", "#16A36A", "#E05252", "#E08A2E", "#7C5CE0", "#0EA5A4", "#D946A8", "#1B2A6B", "#C2410C", "#64748B",
];
