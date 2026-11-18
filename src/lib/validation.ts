import { z } from "zod";

const uuid = z.string().uuid("Seleção inválida");
const optionalUuid = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .pipe(z.string().uuid().nullable());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida");
const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .pipe(isoDate.nullable());
const money = z.coerce
  .number({ invalid_type_error: "Valor inválido" })
  .finite()
  .positive("Informe um valor maior que zero")
  .max(999_999_999, "Valor muito alto")
  .transform((v) => Math.round(v * 100) / 100);
const text = (max: number, msg = "Campo obrigatório") => z.string().trim().min(1, msg).max(max, `Máximo de ${max} caracteres`);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const scope = z.enum(["individual", "shared"]);
export const visibility = z.enum(["household", "private"]);
export const paymentMethod = z.enum(["pix", "debit", "credit_card", "cash", "bank_slip", "transfer", "other"]);
export const frequency = z.enum(["weekly", "biweekly", "monthly", "bimonthly", "quarterly", "semiannual", "annual"]);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida");

export const transactionSchema = z
  .object({
    id: optionalUuid,
    kind: z.enum(["income", "expense"]),
    description: text(120, "Informe a descrição"),
    amount: money,
    category_id: optionalUuid,
    date: isoDate,
    due_date: optionalDate,
    status: z.enum(["paid", "pending"]),
    account_id: optionalUuid,
    credit_card_id: optionalUuid,
    payment_method: paymentMethod.nullable().optional(),
    owner_id: uuid,
    scope,
    visibility,
    installments: z.coerce.number().int().min(1).max(48).default(1),
    repeat: z.union([z.literal("none"), frequency]).default("none"),
    notes: optionalText(1000),
  })
  .superRefine((v, ctx) => {
    const isCard = v.kind === "expense" && v.payment_method === "credit_card";
    if (isCard && !v.credit_card_id) ctx.addIssue({ code: "custom", path: ["credit_card_id"], message: "Selecione o cartão" });
    if (!isCard && v.status === "paid" && !v.account_id)
      ctx.addIssue({ code: "custom", path: ["account_id"], message: "Selecione a conta" });
    if (isCard && v.repeat !== "none")
      ctx.addIssue({ code: "custom", path: ["repeat"], message: "Para assinaturas no cartão, lance cada compra mensalmente" });
    if (v.installments > 1 && v.repeat !== "none")
      ctx.addIssue({ code: "custom", path: ["installments"], message: "Escolha parcelamento ou recorrência" });
  });
export type TransactionInput = z.input<typeof transactionSchema>;

export const accountSchema = z.object({
  id: optionalUuid,
  name: text(60, "Informe o nome"),
  institution: optionalText(60),
  type: z.enum(["checking", "savings", "cash", "digital", "investment", "other"]),
  initial_balance: z.coerce.number().finite().transform((v) => Math.round(v * 100) / 100),
  color,
  owner_id: uuid,
  scope,
  visibility,
  include_in_total: z.boolean().default(true),
});
export type AccountInput = z.input<typeof accountSchema>;

export const transferSchema = z
  .object({
    from_account_id: uuid,
    to_account_id: uuid,
    amount: money,
    date: isoDate,
    description: optionalText(120),
  })
  .refine((v) => v.from_account_id !== v.to_account_id, { path: ["to_account_id"], message: "Escolha contas diferentes" });

export const adjustmentSchema = z.object({
  account_id: uuid,
  target_balance: z.coerce.number().finite(),
  date: isoDate,
  description: optionalText(120),
});

export const cardSchema = z.object({
  id: optionalUuid,
  name: text(60, "Informe o nome"),
  bank: optionalText(60),
  brand: z.enum(["visa", "mastercard", "elo", "amex", "hipercard", "other"]),
  last4: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null))
    .pipe(z.string().regex(/^\d{4}$/, "Use 4 dígitos").nullable()),
  credit_limit: money,
  closing_day: z.coerce.number().int().min(1).max(31),
  due_day: z.coerce.number().int().min(1).max(31),
  color,
  owner_id: uuid,
  scope,
  visibility,
});
export type CardInput = z.input<typeof cardSchema>;

export const invoicePaymentSchema = z.object({
  invoice_id: uuid,
  account_id: uuid,
  amount: money,
  date: isoDate,
});

export const recurringSchema = z.object({
  id: optionalUuid,
  name: text(80, "Informe o nome"),
  kind: z.enum(["income", "expense"]),
  amount: money,
  category_id: optionalUuid,
  account_id: optionalUuid,
  payment_method: paymentMethod.exclude(["credit_card"]),
  frequency,
  due_day: z.coerce.number().int().min(1).max(31),
  start_date: isoDate,
  end_date: optionalDate,
  owner_id: uuid,
  scope,
  visibility,
  notes: optionalText(500),
});
export type RecurringInput = z.input<typeof recurringSchema>;

export const payInstanceSchema = z.object({
  instance_id: uuid,
  account_id: uuid,
  amount: money,
  date: isoDate,
});

export const debtSchema = z
  .object({
    name: text(80, "Informe o nome"),
    creditor: optionalText(80),
    type: z.enum(["loan", "financing", "installment_purchase", "personal", "family", "agreement", "other"]),
    original_amount: money,
    interest_rate: z.coerce.number().min(0).max(100).default(0),
    installments_count: z.coerce.number().int().min(1).max(600),
    installment_amount: money,
    contract_date: isoDate,
    first_due_date: isoDate,
    paid_installments: z.coerce.number().int().min(0).default(0),
    priority: z.coerce.number().int().min(1).max(3),
    owner_id: uuid,
    scope,
    visibility,
    notes: optionalText(500),
  })
  .refine((v) => v.paid_installments <= v.installments_count, {
    path: ["paid_installments"],
    message: "Maior que o total de parcelas",
  });
export type DebtInput = z.input<typeof debtSchema>;

export const debtPaymentSchema = z.object({
  installment_id: uuid,
  account_id: uuid,
  amount: money,
  date: isoDate,
});

export const amortizationSchema = z.object({
  debt_id: uuid,
  account_id: uuid,
  amount: money,
  date: isoDate,
  strategy: z.enum(["last", "next"]),
});

export const goalSchema = z.object({
  id: optionalUuid,
  name: text(80, "Informe o nome"),
  description: optionalText(300),
  target_amount: money,
  target_date: optionalDate,
  icon: z.string().max(40),
  color,
  owner_id: uuid,
  scope,
  visibility,
});
export type GoalInput = z.input<typeof goalSchema>;

export const contributionSchema = z.object({
  goal_id: uuid,
  amount: z.coerce
    .number()
    .finite()
    .refine((v) => v !== 0, "Informe um valor")
    .transform((v) => Math.round(v * 100) / 100),
  date: isoDate,
  note: optionalText(200),
});

export const budgetSchema = z.object({
  id: optionalUuid,
  category_id: uuid,
  amount: money,
  alert_threshold: z.coerce.number().int().min(1).max(100).default(80),
});

export const categorySchema = z.object({
  id: optionalUuid,
  name: text(40, "Informe o nome"),
  kind: z.enum(["income", "expense"]),
  icon: z.string().max(40),
  color,
});

export const profileSchema = z.object({
  full_name: text(80, "Informe seu nome"),
  theme: z.enum(["light", "dark", "system"]),
});

export const householdSchema = z.object({ name: text(80, "Informe o nome") });

export const signUpSchema = z
  .object({
    full_name: text(80, "Informe seu nome"),
    email: z.string().trim().email("E-mail inválido"),
    password: z
      .string()
      .min(8, "Mínimo de 8 caracteres")
      .regex(/[A-Za-z]/, "Inclua letras")
      .regex(/\d/, "Inclua números"),
    confirm: z.string(),
    invite_code: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v.toUpperCase() : undefined)),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem" });

export const signInSchema = z.object({
  email: z.string().trim().email("E-mail inválido"),
  password: z.string().min(1, "Informe a senha"),
});

export const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Mínimo de 8 caracteres")
      .regex(/[A-Za-z]/, "Inclua letras")
      .regex(/\d/, "Inclua números"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "As senhas não conferem" });

export function firstError(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue?.message ?? "Dados inválidos";
}
