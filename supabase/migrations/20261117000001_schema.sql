-- =====================================================================
-- FINANCE HUB — Schema principal
-- Valores monetários: numeric(14,2). Nunca float.
-- Toda entidade financeira pertence a um núcleo familiar (household)
-- e possui um responsável (owner_id), escopo (individual/compartilhado)
-- e visibilidade (household = os dois veem / private = só o responsável).
-- =====================================================================

-- ---------- Tipos ----------
create type public.member_role as enum ('owner', 'member');
create type public.ownership_scope as enum ('individual', 'shared');
create type public.visibility_level as enum ('household', 'private');
create type public.account_type as enum ('checking', 'savings', 'cash', 'digital', 'investment', 'other');
create type public.transaction_kind as enum ('income', 'expense', 'invoice_payment', 'adjustment');
create type public.transaction_status as enum ('paid', 'pending');
create type public.payment_method as enum ('pix', 'debit', 'credit_card', 'cash', 'bank_slip', 'transfer', 'other');
create type public.category_kind as enum ('income', 'expense');
create type public.recurrence_frequency as enum ('weekly', 'biweekly', 'monthly', 'bimonthly', 'quarterly', 'semiannual', 'annual');
create type public.recurring_status as enum ('active', 'paused', 'canceled');
create type public.instance_status as enum ('pending', 'paid', 'skipped');
create type public.debt_type as enum ('loan', 'financing', 'installment_purchase', 'personal', 'family', 'agreement', 'other');
create type public.debt_status as enum ('active', 'paid_off', 'canceled');
create type public.goal_status as enum ('active', 'completed', 'archived');
create type public.notification_type as enum (
  'bill_due_soon', 'bill_overdue', 'card_closing', 'invoice_due',
  'budget_warning', 'budget_exceeded', 'goal_reached', 'debt_installment_due'
);

-- ---------- Utilitários ----------
create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Dia p_day dentro do mês de p_month, limitado ao último dia do mês (31 -> 28/29/30).
create or replace function public.month_day(p_month date, p_day int) returns date
language sql immutable as $$
  select date_trunc('month', p_month)::date
    + (least(p_day, extract(day from (date_trunc('month', p_month) + interval '1 month - 1 day'))::int) - 1);
$$;

-- ---------- Núcleo familiar ----------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  currency char(3) not null default 'BRL',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '' check (char_length(full_name) <= 80),
  avatar_url text,
  household_id uuid references public.households (id) on delete set null,
  theme text not null default 'system' check (theme in ('light', 'dark', 'system')),
  notification_prefs jsonb not null default '{}'::jsonb,
  monthly_income_target numeric(14,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members (user_id);

-- Funções de autorização (security definer evita recursão de RLS)
create or replace function public.is_household_member(p_household uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = auth.uid()
  );
$$;

create or replace function public.is_user_in_household(p_household uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members
    where household_id = p_household and user_id = p_user
  );
$$;

create or replace function public.can_view(p_household uuid, p_owner uuid, p_visibility public.visibility_level)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_household_member(p_household)
     and (p_visibility = 'household' or p_owner = auth.uid());
$$;

-- ---------- Categorias ----------
create table public.transaction_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  kind public.category_kind not null,
  icon text not null default 'circle',
  color text not null default '#7A8190',
  is_system boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (household_id, kind, name),
  unique (household_id, id)
);

-- ---------- Contas financeiras ----------
create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  institution text,
  type public.account_type not null default 'checking',
  initial_balance numeric(14,2) not null default 0,
  color text not null default '#4969E8',
  owner_id uuid not null references auth.users (id),
  scope public.ownership_scope not null default 'individual',
  visibility public.visibility_level not null default 'household',
  include_in_total boolean not null default true,
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);
create index accounts_household_idx on public.accounts (household_id);

-- ---------- Cartões de crédito ----------
create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  bank text,
  brand text not null default 'visa' check (brand in ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other')),
  last4 char(4) check (last4 ~ '^[0-9]{4}$'),
  credit_limit numeric(14,2) not null check (credit_limit >= 0),
  closing_day int not null check (closing_day between 1 and 31),
  due_day int not null check (due_day between 1 and 31),
  color text not null default '#1B2A6B',
  owner_id uuid not null references auth.users (id),
  scope public.ownership_scope not null default 'individual',
  visibility public.visibility_level not null default 'household',
  is_demo boolean not null default false,
  archived_at timestamptz,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);
create index credit_cards_household_idx on public.credit_cards (household_id);

create table public.credit_card_invoices (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  card_id uuid not null,
  reference_month date not null check (extract(day from reference_month) = 1),
  closing_date date not null,
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (card_id, reference_month),
  unique (household_id, id),
  foreign key (household_id, card_id) references public.credit_cards (household_id, id) on delete cascade
);
create index credit_card_invoices_due_idx on public.credit_card_invoices (household_id, due_date);

-- ---------- Contas fixas / recorrentes ----------
create table public.recurring_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  kind public.category_kind not null default 'expense',
  amount numeric(14,2) not null check (amount > 0),
  category_id uuid,
  account_id uuid,
  payment_method public.payment_method not null default 'pix',
  frequency public.recurrence_frequency not null default 'monthly',
  due_day int not null default 10 check (due_day between 1 and 31),
  start_date date not null default current_date,
  end_date date,
  status public.recurring_status not null default 'active',
  owner_id uuid not null references auth.users (id),
  scope public.ownership_scope not null default 'shared',
  visibility public.visibility_level not null default 'household',
  notes text,
  is_demo boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (household_id, id),
  foreign key (household_id, category_id) references public.transaction_categories (household_id, id),
  foreign key (household_id, account_id) references public.accounts (household_id, id)
);
create index recurring_household_idx on public.recurring_transactions (household_id);

create table public.recurring_instances (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  recurring_id uuid not null,
  original_due_date date not null,
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  status public.instance_status not null default 'pending',
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- chave de idempotência: impede cobrança duplicada mesmo após adiar o vencimento
  unique (recurring_id, original_due_date),
  unique (household_id, id),
  foreign key (household_id, recurring_id) references public.recurring_transactions (household_id, id) on delete cascade
);
create index recurring_instances_due_idx on public.recurring_instances (household_id, due_date);

-- ---------- Dívidas ----------
create table public.debts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  creditor text,
  type public.debt_type not null default 'other',
  original_amount numeric(14,2) not null check (original_amount > 0),
  interest_rate numeric(7,4) not null default 0 check (interest_rate >= 0), -- % ao mês
  installments_count int not null check (installments_count between 1 and 600),
  installment_amount numeric(14,2) not null check (installment_amount > 0),
  contract_date date not null default current_date,
  first_due_date date not null,
  priority int not null default 2 check (priority between 1 and 3),
  status public.debt_status not null default 'active',
  paid_off_at date,
  owner_id uuid not null references auth.users (id),
  scope public.ownership_scope not null default 'individual',
  visibility public.visibility_level not null default 'household',
  notes text,
  is_demo boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);
create index debts_household_idx on public.debts (household_id);

create table public.debt_installments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  debt_id uuid not null,
  number int not null check (number > 0),
  due_date date not null,
  amount numeric(14,2) not null check (amount > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (debt_id, number),
  unique (household_id, id),
  foreign key (household_id, debt_id) references public.debts (household_id, id) on delete cascade
);
create index debt_installments_due_idx on public.debt_installments (household_id, due_date);

-- ---------- Movimentações ----------
-- kind:
--   income          receita (afeta saldo da conta quando paga)
--   expense         despesa (conta OU cartão; no cartão não afeta saldo, só a fatura)
--   invoice_payment pagamento de fatura (afeta saldo, NUNCA conta como despesa)
--   adjustment      ajuste manual de saldo identificado (valor com sinal)
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  kind public.transaction_kind not null,
  status public.transaction_status not null default 'paid',
  description text not null check (char_length(description) between 1 and 120),
  amount numeric(14,2) not null,
  category_id uuid,
  date date not null default current_date,      -- data da compra / recebimento (competência)
  due_date date,                                -- vencimento, quando aplicável
  paid_at date,
  account_id uuid,
  credit_card_id uuid,
  invoice_id uuid,
  payment_method public.payment_method,
  owner_id uuid not null references auth.users (id),
  scope public.ownership_scope not null default 'individual',
  visibility public.visibility_level not null default 'household',
  notes text check (char_length(notes) <= 1000),
  installment_group uuid,
  installment_number int,
  installment_total int,
  recurring_instance_id uuid,
  debt_id uuid,
  debt_installment_id uuid,
  reversal_of uuid references public.transactions (id),
  is_demo boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, category_id) references public.transaction_categories (household_id, id),
  foreign key (household_id, account_id) references public.accounts (household_id, id),
  foreign key (household_id, credit_card_id) references public.credit_cards (household_id, id) on delete cascade,
  foreign key (household_id, invoice_id) references public.credit_card_invoices (household_id, id) on delete cascade,
  foreign key (household_id, recurring_instance_id) references public.recurring_instances (household_id, id) on delete set null (recurring_instance_id),
  foreign key (household_id, debt_id) references public.debts (household_id, id) on delete cascade,
  foreign key (household_id, debt_installment_id) references public.debt_installments (household_id, id) on delete set null (debt_installment_id),
  -- valores positivos, exceto ajustes (que carregam sinal)
  check ((kind = 'adjustment' and amount <> 0) or (kind <> 'adjustment' and amount > 0)),
  -- compra no cartão: é despesa e não toca saldo de conta
  check (credit_card_id is null or (kind = 'expense' and account_id is null)),
  -- pagamento de fatura: sempre sai de uma conta e aponta para a fatura
  check (kind <> 'invoice_payment' or (invoice_id is not null and account_id is not null)),
  -- algo realizado (pago) precisa de conta ou cartão
  check (status = 'pending' or account_id is not null or credit_card_id is not null or debt_installment_id is not null),
  check (kind <> 'adjustment' or (account_id is not null and status = 'paid')),
  check (installment_number is null or (installment_number between 1 and installment_total))
);
create index transactions_household_date_idx on public.transactions (household_id, date desc) where deleted_at is null;
create index transactions_account_idx on public.transactions (account_id) where deleted_at is null;
create index transactions_card_idx on public.transactions (credit_card_id) where deleted_at is null;
create index transactions_due_idx on public.transactions (household_id, due_date) where status = 'pending' and deleted_at is null;
create unique index transactions_recurring_instance_uniq on public.transactions (recurring_instance_id)
  where recurring_instance_id is not null and deleted_at is null;

-- ---------- Compras no cartão ----------
create table public.credit_card_purchases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  card_id uuid not null,
  transaction_id uuid not null unique,
  total_amount numeric(14,2) not null check (total_amount > 0),
  installments_count int not null default 1 check (installments_count between 1 and 48),
  purchase_date date not null,
  created_at timestamptz not null default now(),
  unique (household_id, id),
  foreign key (household_id, card_id) references public.credit_cards (household_id, id) on delete cascade,
  foreign key (household_id, transaction_id) references public.transactions (household_id, id) on delete cascade
);

create table public.credit_card_installments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  purchase_id uuid not null,
  invoice_id uuid not null,
  number int not null check (number > 0),
  amount numeric(14,2) not null check (amount > 0),
  unique (purchase_id, number),
  foreign key (household_id, purchase_id) references public.credit_card_purchases (household_id, id) on delete cascade,
  foreign key (household_id, invoice_id) references public.credit_card_invoices (household_id, id) on delete cascade
);
create index cc_installments_invoice_idx on public.credit_card_installments (invoice_id);

-- ---------- Transferências ----------
create table public.transfers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_account_id uuid not null,
  to_account_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  date date not null default current_date,
  description text,
  is_demo boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_account_id <> to_account_id),
  foreign key (household_id, from_account_id) references public.accounts (household_id, id),
  foreign key (household_id, to_account_id) references public.accounts (household_id, id)
);
create index transfers_household_idx on public.transfers (household_id, date desc);

-- ---------- Orçamentos ----------
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null,
  amount numeric(14,2) not null check (amount > 0),
  alert_threshold int not null default 80 check (alert_threshold between 1 and 100),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, category_id),
  foreign key (household_id, category_id) references public.transaction_categories (household_id, id) on delete cascade
);

-- ---------- Metas ----------
create table public.financial_goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  description text,
  target_amount numeric(14,2) not null check (target_amount > 0),
  target_date date,
  icon text not null default 'target',
  color text not null default '#4969E8',
  status public.goal_status not null default 'active',
  owner_id uuid not null references auth.users (id),
  scope public.ownership_scope not null default 'shared',
  visibility public.visibility_level not null default 'household',
  is_demo boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, id)
);

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  goal_id uuid not null,
  amount numeric(14,2) not null check (amount <> 0), -- negativo = resgate
  date date not null default current_date,
  note text,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (household_id, goal_id) references public.financial_goals (household_id, id) on delete cascade
);

-- ---------- Notificações ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.notification_type not null,
  title text not null,
  body text,
  link text,
  dedupe_key text not null,
  channel text not null default 'in_app' check (channel in ('in_app', 'email', 'whatsapp')),
  delivered_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- Anexos ----------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  transaction_id uuid not null,
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes int check (size_bytes <= 5242880),
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (household_id, transaction_id) references public.transactions (household_id, id) on delete cascade
);

-- ---------- Auditoria ----------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  household_id uuid,
  user_id uuid,
  table_name text not null,
  record_id uuid,
  action text not null,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_household_idx on public.audit_logs (household_id, created_at desc);

-- ---------- Triggers updated_at ----------
do $$
declare t text;
begin
  foreach t in array array['households','profiles','accounts','credit_cards','credit_card_invoices',
    'recurring_transactions','recurring_instances','debts','debt_installments','transactions',
    'budgets','financial_goals']
  loop
    execute format('create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ---------- Integridade: responsável precisa pertencer à família ----------
create or replace function public.enforce_owner_in_household() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.household_members where household_id = new.household_id and user_id = new.owner_id) then
    raise exception 'O responsável precisa ser membro do núcleo familiar' using errcode = '23514';
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['accounts','credit_cards','recurring_transactions','debts','transactions','financial_goals']
  loop
    execute format('create trigger %I_owner_check before insert or update of owner_id, household_id on public.%I for each row execute function public.enforce_owner_in_household()', t, t);
  end loop;
end $$;

-- ---------- Auditoria (operações sensíveis) ----------
create or replace function public.audit_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
begin
  insert into public.audit_logs (household_id, user_id, table_name, record_id, action, old_data, new_data)
  values (
    (v_row ->> 'household_id')::uuid,
    auth.uid(),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array['transactions','transfers','accounts','credit_cards','credit_card_invoices',
    'debts','recurring_transactions','goal_contributions','household_members']
  loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_trigger()', t, t);
  end loop;
end $$;
