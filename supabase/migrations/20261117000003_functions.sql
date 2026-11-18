-- =====================================================================
-- FINANCE HUB — Regras de negócio no banco (operações atômicas)
-- Toda função plpgsql roda dentro de uma única transação: ou tudo
-- acontece, ou nada acontece.
-- =====================================================================

-- ---------- Formatação monetária pt-BR (R$ 1.234,56) para textos de alertas ----------
create or replace function public.brl(p_value numeric) returns text
language sql immutable as $$
  select case when p_value < 0 then '-' else '' end
    || 'R$ ' || translate(to_char(abs(p_value), 'FM999,999,999,990.00'), ',.', '.,');
$$;

-- ---------- Categorias padrão ----------
create or replace function public.seed_default_categories(p_household uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.transaction_categories (household_id, name, kind, icon, color, is_system)
  values
    (p_household, 'Salário', 'income', 'briefcase', '#16A36A', true),
    (p_household, 'Freelance', 'income', 'laptop', '#0EA5A4', true),
    (p_household, 'Comissão', 'income', 'percent', '#22A3D6', true),
    (p_household, 'Investimentos', 'income', 'trending-up', '#4969E8', true),
    (p_household, 'Rendimentos', 'income', 'piggy-bank', '#7C5CE0', true),
    (p_household, 'Vendas', 'income', 'shopping-bag', '#E08A2E', true),
    (p_household, 'Outros', 'income', 'circle-plus', '#7A8190', true),
    (p_household, 'Moradia', 'expense', 'house', '#4969E8', true),
    (p_household, 'Alimentação', 'expense', 'utensils', '#E08A2E', true),
    (p_household, 'Supermercado', 'expense', 'shopping-cart', '#16A36A', true),
    (p_household, 'Transporte', 'expense', 'bus', '#22A3D6', true),
    (p_household, 'Combustível', 'expense', 'fuel', '#C2410C', true),
    (p_household, 'Saúde', 'expense', 'heart-pulse', '#E05252', true),
    (p_household, 'Educação', 'expense', 'graduation-cap', '#7C5CE0', true),
    (p_household, 'Lazer', 'expense', 'party-popper', '#D946A8', true),
    (p_household, 'Assinaturas', 'expense', 'repeat', '#0EA5A4', true),
    (p_household, 'Compras pessoais', 'expense', 'shopping-bag', '#B45ED9', true),
    (p_household, 'Vestuário', 'expense', 'shirt', '#DB6B8E', true),
    (p_household, 'Viagens', 'expense', 'plane', '#3B82C4', true),
    (p_household, 'Igreja e doações', 'expense', 'hand-heart', '#A16207', true),
    (p_household, 'Pets', 'expense', 'paw-print', '#8B6B4A', true),
    (p_household, 'Impostos', 'expense', 'landmark', '#64748B', true),
    (p_household, 'Dívidas e empréstimos', 'expense', 'hand-coins', '#9F1239', true),
    (p_household, 'Outros', 'expense', 'circle-ellipsis', '#7A8190', true)
  on conflict (household_id, kind, name) do nothing;
$$;

-- ---------- Cadastro: cria perfil e núcleo familiar (ou entra via convite) ----------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_name text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1));
  v_code text := upper(trim(coalesce(new.raw_user_meta_data ->> 'invite_code', '')));
  v_household uuid;
  v_role public.member_role := 'member';
begin
  insert into public.profiles (id, full_name) values (new.id, left(v_name, 80));

  if v_code <> '' then
    select h.id into v_household from public.households h
    where h.invite_code = v_code
      and (select count(*) from public.household_members m where m.household_id = h.id) < 2;
  end if;

  if v_household is null then
    insert into public.households (name) values (left('Família ' || v_name, 80)) returning id into v_household;
    perform public.seed_default_categories(v_household);
    v_role := 'owner';
  end if;

  insert into public.household_members (household_id, user_id, role) values (v_household, new.id, v_role);
  update public.profiles set household_id = v_household where id = new.id;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Entrar em outro núcleo familiar com código de convite (usuário já cadastrado)
create or replace function public.join_household(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_target uuid;
  v_old uuid;
begin
  if v_user is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  select id into v_target from public.households where invite_code = upper(trim(p_code));
  if v_target is null then raise exception 'Código de convite inválido'; end if;
  if exists (select 1 from public.household_members where household_id = v_target and user_id = v_user) then
    return v_target;
  end if;
  if (select count(*) from public.household_members where household_id = v_target) >= 2 then
    raise exception 'Este núcleo familiar já possui dois membros';
  end if;

  select household_id into v_old from public.profiles where id = v_user;
  if v_old is not null then
    if (select count(*) from public.household_members where household_id = v_old) > 1 then
      raise exception 'Saia do núcleo atual antes de entrar em outro';
    end if;
    delete from public.household_members where household_id = v_old and user_id = v_user;
    delete from public.households where id = v_old; -- núcleo individual anterior (e seus dados) é descartado
  end if;

  insert into public.household_members (household_id, user_id, role) values (v_target, v_user, 'member');
  update public.profiles set household_id = v_target where id = v_user;
  return v_target;
end $$;

create or replace function public.regenerate_invite_code() returns text
language plpgsql security definer set search_path = public as $$
declare v_household uuid; v_code text;
begin
  select household_id into v_household from public.household_members where user_id = auth.uid() and role = 'owner' limit 1;
  if v_household is null then raise exception 'Apenas o titular pode gerar um novo convite' using errcode = '42501'; end if;
  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.households set invite_code = v_code where id = v_household;
  return v_code;
end $$;

-- Encerramento da conta: transfere a titularidade dos itens ao outro membro, ou apaga o núcleo se for o único
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_household uuid;
  v_other uuid;
  t text;
begin
  if v_user is null then raise exception 'Não autenticado' using errcode = '42501'; end if;
  select household_id into v_household from public.profiles where id = v_user;
  select user_id into v_other from public.household_members where household_id = v_household and user_id <> v_user limit 1;

  if v_other is null then
    delete from public.households where id = v_household;
  else
    foreach t in array array['accounts','credit_cards','recurring_transactions','debts','transactions','financial_goals'] loop
      execute format('update public.%I set owner_id = $1, visibility = ''household'' where household_id = $2 and owner_id = $3', t)
        using v_other, v_household, v_user;
    end loop;
    update public.household_members set role = 'owner' where household_id = v_household and user_id = v_other;
  end if;
  delete from auth.users where id = v_user;
end $$;

-- ---------- Integridade das movimentações ----------
create or replace function public.transactions_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_vis public.visibility_level; v_owner uuid;
begin
  -- visibilidade herdada: compra no cartão / pagamento de fatura / pagamento de dívida
  if new.credit_card_id is not null or new.invoice_id is not null then
    select c.visibility, c.owner_id into v_vis, v_owner from public.credit_cards c
    where c.id = coalesce(new.credit_card_id, (select card_id from public.credit_card_invoices where id = new.invoice_id));
    new.visibility := v_vis;
    if v_vis = 'private' then new.owner_id := v_owner; end if;
  elsif new.debt_id is not null then
    select d.visibility, d.owner_id into v_vis, v_owner from public.debts d where d.id = new.debt_id;
    new.visibility := v_vis;
    if v_vis = 'private' then new.owner_id := v_owner; end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.credit_card_id is not null and (
      new.amount <> old.amount or new.date <> old.date
      or new.credit_card_id is distinct from old.credit_card_id
    ) then
      raise exception 'Para alterar valor, data ou cartão de uma compra no cartão, estorne e lance novamente';
    end if;
    if old.kind <> new.kind then
      raise exception 'Não é possível alterar o tipo de uma movimentação';
    end if;
  end if;

  if new.status = 'paid' and new.paid_at is null then new.paid_at := new.date; end if;
  if new.status = 'pending' then new.paid_at := null; end if;
  return new;
end $$;

create trigger transactions_guard before insert or update on public.transactions
  for each row execute function public.transactions_guard();

-- ---------- Saldos (função agregadora; só valores, respeitando quem pode ver a conta) ----------
create or replace function public.account_balances(p_household uuid)
returns table (account_id uuid, balance numeric)
language sql stable security definer set search_path = public as $$
  select a.id,
    (a.initial_balance
      + coalesce((select sum(case t.kind
            when 'income' then t.amount
            when 'expense' then -t.amount
            when 'invoice_payment' then -t.amount
            when 'adjustment' then t.amount end)
          from public.transactions t
          where t.account_id = a.id and t.status = 'paid' and t.deleted_at is null), 0)
      + coalesce((select sum(x.amount) from public.transfers x where x.to_account_id = a.id and x.deleted_at is null), 0)
      - coalesce((select sum(x.amount) from public.transfers x where x.from_account_id = a.id and x.deleted_at is null), 0)
    )::numeric(14,2)
  from public.accounts a
  where a.household_id = p_household
    and public.can_view(a.household_id, a.owner_id, a.visibility);
$$;

-- ---------- Cartões: fatura de referência ----------
-- Compra antes do dia de fechamento entra na fatura do mês; no dia do fechamento ou depois, na do mês seguinte.
create or replace function public.card_invoice_ref(p_closing_day int, p_date date) returns date
language sql immutable as $$
  select case when p_date < public.month_day(p_date, p_closing_day)
    then date_trunc('month', p_date)::date
    else (date_trunc('month', p_date) + interval '1 month')::date end;
$$;

create or replace function public.ensure_invoice(p_card uuid, p_ref date) returns uuid
language plpgsql set search_path = public as $$
declare v_id uuid; v_card public.credit_cards;
begin
  select * into v_card from public.credit_cards where id = p_card;
  if not found then raise exception 'Cartão não encontrado'; end if;
  insert into public.credit_card_invoices (household_id, card_id, reference_month, closing_date, due_date)
  values (
    v_card.household_id, p_card, p_ref,
    public.month_day(p_ref, v_card.closing_day),
    case when v_card.due_day > v_card.closing_day
      then public.month_day(p_ref, v_card.due_day)
      else public.month_day((p_ref + interval '1 month')::date, v_card.due_day) end
  )
  on conflict (card_id, reference_month) do nothing;
  select id into v_id from public.credit_card_invoices where card_id = p_card and reference_month = p_ref;
  return v_id;
end $$;

create or replace view public.v_card_invoices with (security_invoker = true) as
select i.id, i.household_id, i.card_id, i.reference_month, i.closing_date, i.due_date,
  coalesce(inst.total, 0)::numeric(14,2) as total,
  coalesce(pay.paid, 0)::numeric(14,2) as paid_amount,
  case
    when coalesce(inst.total, 0) = 0 then case when current_date >= i.closing_date then 'empty' else 'open' end
    when coalesce(pay.paid, 0) >= inst.total then 'paid'
    when current_date > i.due_date then 'overdue'
    when current_date >= i.closing_date then 'closed'
    else 'open'
  end as status
from public.credit_card_invoices i
left join lateral (
  select sum(ci.amount) as total
  from public.credit_card_installments ci
  join public.credit_card_purchases p on p.id = ci.purchase_id
  join public.transactions t on t.id = p.transaction_id
  where ci.invoice_id = i.id and t.deleted_at is null
) inst on true
left join lateral (
  select sum(t.amount) as paid from public.transactions t
  where t.invoice_id = i.id and t.kind = 'invoice_payment' and t.deleted_at is null
) pay on true;

-- Registra compra no cartão: 1 despesa (na data da compra) + parcelas distribuídas nas faturas.
-- O pagamento da fatura depois NÃO gera nova despesa.
create or replace function public.register_card_purchase(
  p_card uuid, p_description text, p_amount numeric, p_installments int, p_date date,
  p_category uuid, p_owner uuid, p_scope public.ownership_scope,
  p_visibility public.visibility_level default 'household', p_notes text default null, p_is_demo boolean default false
) returns uuid
language plpgsql set search_path = public as $$
declare
  v_card public.credit_cards;
  v_tx uuid; v_purchase uuid; v_ref date; v_inv uuid;
  v_cents bigint; v_base bigint; v_rem bigint; i int;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'Valor inválido'; end if;
  if p_installments is null or p_installments < 1 or p_installments > 48 then raise exception 'Quantidade de parcelas inválida'; end if;
  v_cents := round(p_amount * 100)::bigint;
  if v_cents < p_installments then raise exception 'Valor muito baixo para a quantidade de parcelas'; end if;

  select * into v_card from public.credit_cards where id = p_card and archived_at is null;
  if not found then raise exception 'Cartão não encontrado'; end if;

  insert into public.transactions (household_id, kind, status, description, amount, category_id, date, paid_at,
    credit_card_id, payment_method, owner_id, scope, visibility, notes, installment_total, is_demo)
  values (v_card.household_id, 'expense', 'paid', p_description, round(p_amount, 2), p_category, p_date, p_date,
    p_card, 'credit_card', p_owner, p_scope, p_visibility, p_notes, null, p_is_demo)
  returning id into v_tx;

  insert into public.credit_card_purchases (household_id, card_id, transaction_id, total_amount, installments_count, purchase_date)
  values (v_card.household_id, p_card, v_tx, round(p_amount, 2), p_installments, p_date)
  returning id into v_purchase;

  v_ref := public.card_invoice_ref(v_card.closing_day, p_date);
  v_base := v_cents / p_installments;
  v_rem := v_cents - v_base * p_installments;
  for i in 1..p_installments loop
    v_inv := public.ensure_invoice(p_card, (v_ref + make_interval(months => i - 1))::date);
    insert into public.credit_card_installments (household_id, purchase_id, invoice_id, number, amount)
    values (v_card.household_id, v_purchase, v_inv, i, (v_base + case when i = 1 then v_rem else 0 end)::numeric / 100);
  end loop;
  return v_tx;
end $$;

-- Paga (total ou parcial) uma fatura a partir de uma conta. Movimentação do tipo invoice_payment.
create or replace function public.pay_card_invoice(p_invoice uuid, p_account uuid, p_amount numeric, p_date date default current_date)
returns uuid
language plpgsql set search_path = public as $$
declare
  v_inv record; v_card public.credit_cards; v_tx uuid; v_remaining numeric;
begin
  select * into v_inv from public.v_card_invoices where id = p_invoice;
  if not found then raise exception 'Fatura não encontrada'; end if;
  perform 1 from public.credit_card_invoices where id = p_invoice for update;
  select * into v_card from public.credit_cards where id = v_inv.card_id;
  v_remaining := v_inv.total - v_inv.paid_amount;
  if p_amount is null or p_amount <= 0 then raise exception 'Valor inválido'; end if;
  if v_remaining <= 0 then raise exception 'Esta fatura já está paga'; end if;
  if round(p_amount, 2) > v_remaining then raise exception 'Valor maior que o saldo da fatura (%)', v_remaining; end if;

  insert into public.transactions (household_id, kind, status, description, amount, date, paid_at, account_id,
    invoice_id, payment_method, owner_id, scope, visibility, is_demo)
  values (v_card.household_id, 'invoice_payment', 'paid',
    'Fatura ' || v_card.name || ' ' || to_char(v_inv.reference_month, 'MM/YYYY'),
    round(p_amount, 2), p_date, p_date, p_account, p_invoice, 'bank_slip',
    v_card.owner_id, v_card.scope, v_card.visibility, v_card.is_demo)
  returning id into v_tx;
  return v_tx;
end $$;

-- ---------- Recorrências ----------
create or replace function public.recurrence_dates(
  p_frequency public.recurrence_frequency, p_start date, p_due_day int, p_from date, p_until date
) returns setof date
language plpgsql immutable as $$
declare v_step int; v_d date; k int := 0;
begin
  if p_frequency in ('weekly', 'biweekly') then
    v_step := case when p_frequency = 'weekly' then 7 else 14 end;
    v_d := p_start;
    while v_d <= p_until loop
      if v_d >= p_from then return next v_d; end if;
      v_d := v_d + v_step;
    end loop;
  else
    v_step := case p_frequency when 'monthly' then 1 when 'bimonthly' then 2 when 'quarterly' then 3
                               when 'semiannual' then 6 else 12 end;
    loop
      v_d := public.month_day((date_trunc('month', p_start) + make_interval(months => k * v_step))::date, p_due_day);
      exit when v_d > p_until;
      if v_d >= p_start and v_d >= p_from then return next v_d; end if;
      k := k + 1;
      exit when k > 2400;
    end loop;
  end if;
end $$;

-- Gera ocorrências futuras sem duplicar (chave única recurring_id + original_due_date)
create or replace function public.generate_recurring_instances(p_household uuid, p_until date default (current_date + 62))
returns int
language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not public.is_household_member(p_household) then raise exception 'Acesso negado' using errcode = '42501'; end if;
  insert into public.recurring_instances (household_id, recurring_id, original_due_date, due_date, amount)
  select r.household_id, r.id, d, d, r.amount
  from public.recurring_transactions r
  cross join lateral public.recurrence_dates(
    r.frequency, r.start_date, r.due_day,
    greatest(r.start_date, (date_trunc('month', current_date) - interval '12 months')::date),
    least(coalesce(r.end_date, p_until), p_until)
  ) d
  where r.household_id = p_household and r.status = 'active'
  on conflict (recurring_id, original_due_date) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Marca ocorrência como paga criando a movimentação realizada (atômico, sem duplicidade)
create or replace function public.pay_recurring_instance(
  p_instance uuid, p_account uuid default null, p_amount numeric default null, p_date date default current_date
) returns uuid
language plpgsql set search_path = public as $$
declare v_i public.recurring_instances; v_r public.recurring_transactions; v_tx uuid; v_account uuid;
begin
  select * into v_i from public.recurring_instances where id = p_instance for update;
  if not found then raise exception 'Ocorrência não encontrada'; end if;
  if v_i.status = 'paid' then raise exception 'Esta conta já foi paga'; end if;
  select * into v_r from public.recurring_transactions where id = v_i.recurring_id;
  v_account := coalesce(p_account, v_r.account_id);
  if v_account is null then raise exception 'Informe a conta utilizada no pagamento'; end if;

  insert into public.transactions (household_id, kind, status, description, amount, category_id, date, due_date, paid_at,
    account_id, payment_method, owner_id, scope, visibility, recurring_instance_id, is_demo)
  values (v_r.household_id, v_r.kind::text::public.transaction_kind, 'paid', v_r.name,
    round(coalesce(p_amount, v_i.amount), 2), v_r.category_id, p_date, v_i.due_date, p_date,
    v_account, v_r.payment_method, v_r.owner_id, v_r.scope, v_r.visibility, v_i.id, v_r.is_demo)
  returning id into v_tx;

  update public.recurring_instances
     set status = 'paid', paid_at = p_date, amount = round(coalesce(p_amount, amount), 2)
   where id = p_instance;
  return v_tx;
end $$;

-- Cancelar uma conta fixa remove as ocorrências futuras pendentes (histórico pago é preservado)
create or replace function public.cancel_recurring(p_recurring uuid) returns void
language plpgsql set search_path = public as $$
begin
  update public.recurring_transactions set status = 'canceled', end_date = greatest(start_date, current_date)
   where id = p_recurring;
  if not found then raise exception 'Conta fixa não encontrada'; end if;
  delete from public.recurring_instances
   where recurring_id = p_recurring and status = 'pending' and due_date >= current_date;
end $$;

-- ---------- Dívidas ----------
create or replace view public.v_debt_installments with (security_invoker = true) as
select di.id, di.household_id, di.debt_id, di.number, di.due_date, di.amount,
  coalesce(p.paid, 0)::numeric(14,2) as paid_amount,
  p.last_paid_at,
  case when coalesce(p.paid, 0) >= di.amount then 'paid'
       when current_date > di.due_date then 'overdue'
       else 'pending' end as status
from public.debt_installments di
left join lateral (
  select sum(t.amount) as paid, max(t.date) as last_paid_at
  from public.transactions t
  where t.debt_installment_id = di.id and t.status = 'paid' and t.deleted_at is null
) p on true;

create or replace view public.v_debts with (security_invoker = true) as
select d.*,
  coalesce(s.total_to_pay, 0)::numeric(14,2) as total_to_pay,
  coalesce(s.paid_total, 0)::numeric(14,2) as paid_total,
  greatest(coalesce(s.total_to_pay, 0) - coalesce(s.paid_total, 0), 0)::numeric(14,2) as outstanding,
  coalesce(s.paid_count, 0)::int as paid_count,
  coalesce(s.pending_count, 0)::int as pending_count,
  s.next_due_date, s.next_amount, s.last_due_date
from public.debts d
left join lateral (
  select sum(vi.amount) as total_to_pay,
         sum(least(vi.paid_amount, vi.amount)) as paid_total,
         count(*) filter (where vi.status = 'paid') as paid_count,
         count(*) filter (where vi.status <> 'paid') as pending_count,
         min(vi.due_date) filter (where vi.status <> 'paid') as next_due_date,
         (array_agg(vi.amount - vi.paid_amount order by vi.number) filter (where vi.status <> 'paid'))[1] as next_amount,
         max(vi.due_date) as last_due_date
  from public.v_debt_installments vi where vi.debt_id = d.id
) s on true;

create or replace function public.refresh_debt_status(p_debt uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_outstanding numeric; v_status public.debt_status;
begin
  select outstanding, status into v_outstanding, v_status from public.v_debts where id = p_debt;
  if v_status = 'canceled' then return; end if;
  if v_outstanding <= 0 then
    update public.debts set status = 'paid_off', paid_off_at = coalesce(paid_off_at, current_date) where id = p_debt;
  else
    update public.debts set status = 'active', paid_off_at = null where id = p_debt;
  end if;
end $$;

create or replace function public.create_debt(
  p_name text, p_creditor text, p_type public.debt_type, p_original_amount numeric, p_interest_rate numeric,
  p_installments int, p_installment_amount numeric, p_contract_date date, p_first_due_date date,
  p_owner uuid, p_scope public.ownership_scope, p_visibility public.visibility_level default 'household',
  p_priority int default 2, p_notes text default null, p_paid_installments int default 0, p_is_demo boolean default false,
  p_household uuid default null
) returns uuid
language plpgsql set search_path = public as $$
declare v_household uuid; v_debt uuid; i int; v_inst uuid; v_category uuid;
begin
  v_household := coalesce(p_household, (select household_id from public.profiles where id = auth.uid()));
  if p_paid_installments < 0 or p_paid_installments > p_installments then raise exception 'Parcelas pagas inválidas'; end if;
  insert into public.debts (household_id, name, creditor, type, original_amount, interest_rate, installments_count,
    installment_amount, contract_date, first_due_date, owner_id, scope, visibility, priority, notes, is_demo)
  values (v_household, p_name, p_creditor, p_type, round(p_original_amount, 2), coalesce(p_interest_rate, 0), p_installments,
    round(p_installment_amount, 2), p_contract_date, p_first_due_date, p_owner, p_scope, p_visibility, p_priority, p_notes, p_is_demo)
  returning id into v_debt;

  insert into public.debt_installments (household_id, debt_id, number, due_date, amount)
  select v_household, v_debt, n,
    public.month_day((date_trunc('month', p_first_due_date) + make_interval(months => n - 1))::date, extract(day from p_first_due_date)::int),
    round(p_installment_amount, 2)
  from generate_series(1, p_installments) n;

  -- parcelas já quitadas antes de começar a usar o app (sem conta: registro histórico, não afeta saldo)
  if p_paid_installments > 0 then
    select id into v_category from public.transaction_categories
     where household_id = v_household and kind = 'expense' and name = 'Dívidas e empréstimos';
    for i in 1..p_paid_installments loop
      select id into v_inst from public.debt_installments where debt_id = v_debt and number = i;
      insert into public.transactions (household_id, kind, status, description, amount, category_id, date, paid_at,
        account_id, owner_id, scope, visibility, debt_id, debt_installment_id, notes, is_demo)
      select v_household, 'expense', 'paid', p_name || ' — parcela ' || i || '/' || p_installments || ' (anterior)',
        round(p_installment_amount, 2), v_category, di.due_date, di.due_date, null, p_owner, p_scope, p_visibility, v_debt, v_inst,
        'Parcela paga antes do início do controle', p_is_demo
      from public.debt_installments di where di.id = v_inst;
    end loop;
  end if;
  perform public.refresh_debt_status(v_debt);
  return v_debt;
end $$;

-- Paga uma parcela (total ou parcial)
create or replace function public.pay_debt_installment(
  p_installment uuid, p_account uuid, p_amount numeric default null, p_date date default current_date
) returns uuid
language plpgsql set search_path = public as $$
declare v_i record; v_d public.debts; v_tx uuid; v_remaining numeric; v_category uuid;
begin
  select * into v_i from public.v_debt_installments where id = p_installment;
  if not found then raise exception 'Parcela não encontrada'; end if;
  perform 1 from public.debt_installments where id = p_installment for update;
  select * into v_d from public.debts where id = v_i.debt_id;
  v_remaining := v_i.amount - v_i.paid_amount;
  if v_remaining <= 0 then raise exception 'Esta parcela já está paga'; end if;
  if p_amount is not null and (p_amount <= 0 or round(p_amount, 2) > v_remaining) then
    raise exception 'Valor inválido para esta parcela (restante: %)', v_remaining;
  end if;
  select id into v_category from public.transaction_categories
   where household_id = v_d.household_id and kind = 'expense' and name = 'Dívidas e empréstimos';

  insert into public.transactions (household_id, kind, status, description, amount, category_id, date, due_date, paid_at,
    account_id, payment_method, owner_id, scope, visibility, debt_id, debt_installment_id, is_demo)
  values (v_d.household_id, 'expense', 'paid', v_d.name || ' — parcela ' || v_i.number || '/' || v_d.installments_count,
    round(coalesce(p_amount, v_remaining), 2), v_category, p_date, v_i.due_date, p_date,
    p_account, 'pix', v_d.owner_id, v_d.scope, v_d.visibility, v_d.id, p_installment, v_d.is_demo)
  returning id into v_tx;
  perform public.refresh_debt_status(v_d.id);
  return v_tx;
end $$;

-- Amortização / pagamento antecipado: distribui o valor nas parcelas (últimas primeiro = reduz prazo)
create or replace function public.amortize_debt(
  p_debt uuid, p_account uuid, p_amount numeric, p_date date default current_date, p_strategy text default 'last'
) returns int
language plpgsql set search_path = public as $$
declare v_d public.debts; v_left numeric := round(p_amount, 2); v_take numeric; r record; v_count int := 0; v_category uuid;
begin
  select * into v_d from public.debts where id = p_debt for update;
  if not found then raise exception 'Dívida não encontrada'; end if;
  if v_left <= 0 then raise exception 'Valor inválido'; end if;
  if v_left > (select outstanding from public.v_debts where id = p_debt) then
    raise exception 'Valor maior que o saldo devedor';
  end if;
  select id into v_category from public.transaction_categories
   where household_id = v_d.household_id and kind = 'expense' and name = 'Dívidas e empréstimos';

  for r in
    select * from public.v_debt_installments
    where debt_id = p_debt and status <> 'paid'
    order by case when p_strategy = 'next' then number else -number end
  loop
    exit when v_left <= 0;
    v_take := least(v_left, r.amount - r.paid_amount);
    insert into public.transactions (household_id, kind, status, description, amount, category_id, date, due_date, paid_at,
      account_id, payment_method, owner_id, scope, visibility, debt_id, debt_installment_id, notes, is_demo)
    values (v_d.household_id, 'expense', 'paid',
      v_d.name || ' — amortização parcela ' || r.number || '/' || v_d.installments_count,
      v_take, v_category, p_date, r.due_date, p_date, p_account, 'pix', v_d.owner_id, v_d.scope, v_d.visibility,
      v_d.id, r.id, 'Pagamento antecipado', v_d.is_demo);
    v_left := v_left - v_take;
    v_count := v_count + 1;
  end loop;
  perform public.refresh_debt_status(p_debt);
  return v_count;
end $$;

-- ---------- Estorno (exclusão lógica) com efeitos colaterais consistentes ----------
create or replace function public.reverse_transaction(p_transaction uuid) returns void
language plpgsql set search_path = public as $$
declare v_t public.transactions;
begin
  select * into v_t from public.transactions where id = p_transaction and deleted_at is null for update;
  if not found then raise exception 'Movimentação não encontrada'; end if;
  update public.transactions set deleted_at = now() where id = p_transaction;
  if v_t.recurring_instance_id is not null then
    update public.recurring_instances set status = 'pending', paid_at = null where id = v_t.recurring_instance_id;
  end if;
  if v_t.debt_id is not null then
    perform public.refresh_debt_status(v_t.debt_id);
  end if;
end $$;

-- ---------- Notificações ----------
create or replace function public.refresh_notifications(p_household uuid) returns int
language plpgsql security definer set search_path = public as $$
declare v_count int := 0; v_n int;
begin
  if not public.is_household_member(p_household) then raise exception 'Acesso negado' using errcode = '42501'; end if;

  -- contas fixas: vence em até 3 dias / vencida
  insert into public.notifications (household_id, user_id, type, title, body, link, dedupe_key)
  select p_household, m.user_id,
    case when ri.due_date < current_date then 'bill_overdue' else 'bill_due_soon' end::public.notification_type,
    case when ri.due_date < current_date then 'Conta vencida: ' || r.name else 'Vence em breve: ' || r.name end,
    'Valor de ' || public.brl(ri.amount) || ' — vencimento em ' || to_char(ri.due_date, 'DD/MM/YYYY'),
    '/contas-fixas',
    case when ri.due_date < current_date then 'bill_overdue:' else 'bill_due_soon:' end || ri.id
  from public.recurring_instances ri
  join public.recurring_transactions r on r.id = ri.recurring_id
  join public.household_members m on m.household_id = p_household
  join public.profiles pr on pr.id = m.user_id
  where ri.household_id = p_household and ri.status = 'pending' and r.kind = 'expense'
    and ri.due_date <= current_date + 3 and ri.due_date >= current_date - 30
    and (r.visibility = 'household' or r.owner_id = m.user_id)
    and coalesce((pr.notification_prefs ->> (case when ri.due_date < current_date then 'bill_overdue' else 'bill_due_soon' end))::boolean, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- despesas pendentes com vencimento
  insert into public.notifications (household_id, user_id, type, title, body, link, dedupe_key)
  select p_household, m.user_id,
    case when t.due_date < current_date then 'bill_overdue' else 'bill_due_soon' end::public.notification_type,
    case when t.due_date < current_date then 'Conta vencida: ' else 'Vence em breve: ' end || t.description,
    'Valor de ' || public.brl(t.amount) || ' — vencimento em ' || to_char(t.due_date, 'DD/MM/YYYY'),
    '/movimentacoes',
    case when t.due_date < current_date then 'tx_overdue:' else 'tx_due_soon:' end || t.id
  from public.transactions t
  join public.household_members m on m.household_id = p_household
  join public.profiles pr on pr.id = m.user_id
  where t.household_id = p_household and t.kind = 'expense' and t.status = 'pending' and t.deleted_at is null
    and t.debt_id is null and t.due_date is not null
    and t.due_date <= current_date + 3 and t.due_date >= current_date - 30
    and (t.visibility = 'household' or t.owner_id = m.user_id)
    and coalesce((pr.notification_prefs ->> (case when t.due_date < current_date then 'bill_overdue' else 'bill_due_soon' end))::boolean, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- cartões: fechamento em até 3 dias / fatura vence em até 5 dias
  insert into public.notifications (household_id, user_id, type, title, body, link, dedupe_key)
  select p_household, m.user_id, 'card_closing', 'Fatura fecha em breve: ' || c.name,
    'Fechamento em ' || to_char(i.closing_date, 'DD/MM/YYYY') || ' — total parcial ' || public.brl(i.total),
    '/cartoes/' || c.id, 'card_closing:' || i.id
  from public.v_card_invoices i
  join public.credit_cards c on c.id = i.card_id
  join public.household_members m on m.household_id = p_household
  join public.profiles pr on pr.id = m.user_id
  where i.household_id = p_household and i.status = 'open' and i.total > 0
    and i.closing_date between current_date and current_date + 3
    and (c.visibility = 'household' or c.owner_id = m.user_id)
    and coalesce((pr.notification_prefs ->> 'card_closing')::boolean, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  insert into public.notifications (household_id, user_id, type, title, body, link, dedupe_key)
  select p_household, m.user_id, 'invoice_due', 'Fatura a vencer: ' || c.name,
    public.brl(i.total - i.paid_amount) || ' até ' || to_char(i.due_date, 'DD/MM/YYYY'),
    '/cartoes/' || c.id, 'invoice_due:' || i.id
  from public.v_card_invoices i
  join public.credit_cards c on c.id = i.card_id
  join public.household_members m on m.household_id = p_household
  join public.profiles pr on pr.id = m.user_id
  where i.household_id = p_household and i.status in ('closed', 'open', 'overdue') and i.total > i.paid_amount
    and i.due_date <= current_date + 5 and i.due_date >= current_date - 15
    and (c.visibility = 'household' or c.owner_id = m.user_id)
    and coalesce((pr.notification_prefs ->> 'invoice_due')::boolean, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- orçamentos do mês corrente (80% e 100%)
  with spent as (
    select b.id as budget_id, b.amount, b.alert_threshold, c.name,
      coalesce(sum(t.amount), 0) as total
    from public.budgets b
    join public.transaction_categories c on c.id = b.category_id
    left join public.transactions t on t.category_id = b.category_id and t.kind = 'expense'
      and t.deleted_at is null and t.date >= date_trunc('month', current_date)::date
      and t.date < (date_trunc('month', current_date) + interval '1 month')::date
    where b.household_id = p_household
    group by b.id, b.amount, b.alert_threshold, c.name
  )
  insert into public.notifications (household_id, user_id, type, title, body, link, dedupe_key)
  select p_household, m.user_id,
    case when s.total > s.amount then 'budget_exceeded' else 'budget_warning' end::public.notification_type,
    case when s.total > s.amount then 'Orçamento ultrapassado: ' else 'Orçamento quase no limite: ' end || s.name,
    'Gasto de ' || public.brl(s.total) || ' de ' || public.brl(s.amount)
      || ' (' || round(s.total / s.amount * 100) || '%)',
    '/metas',
    case when s.total > s.amount then 'budget_exceeded:' else 'budget_warning:' end || s.budget_id || ':' || to_char(current_date, 'YYYY-MM')
  from spent s
  join public.household_members m on m.household_id = p_household
  join public.profiles pr on pr.id = m.user_id
  where s.total >= s.amount * s.alert_threshold / 100.0
    and coalesce((pr.notification_prefs ->> (case when s.total > s.amount then 'budget_exceeded' else 'budget_warning' end))::boolean, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- metas atingidas
  insert into public.notifications (household_id, user_id, type, title, body, link, dedupe_key)
  select p_household, m.user_id, 'goal_reached', 'Meta atingida: ' || g.name,
    'Parabéns! Vocês alcançaram ' || public.brl(g.target_amount) || '.', '/metas', 'goal_reached:' || g.id
  from public.financial_goals g
  join public.household_members m on m.household_id = p_household
  join public.profiles pr on pr.id = m.user_id
  where g.household_id = p_household and g.status <> 'archived'
    and (select coalesce(sum(amount), 0) from public.goal_contributions gc where gc.goal_id = g.id) >= g.target_amount
    and (g.visibility = 'household' or g.owner_id = m.user_id)
    and coalesce((pr.notification_prefs ->> 'goal_reached')::boolean, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  -- parcelas de dívida em até 5 dias
  insert into public.notifications (household_id, user_id, type, title, body, link, dedupe_key)
  select p_household, m.user_id, 'debt_installment_due',
    'Parcela a vencer: ' || d.name,
    'Parcela ' || vi.number || '/' || d.installments_count || ' de ' || public.brl(vi.amount - vi.paid_amount)
      || ' em ' || to_char(vi.due_date, 'DD/MM/YYYY'),
    '/dividas/' || d.id, 'debt_installment_due:' || vi.id
  from public.v_debt_installments vi
  join public.debts d on d.id = vi.debt_id
  join public.household_members m on m.household_id = p_household
  join public.profiles pr on pr.id = m.user_id
  where vi.household_id = p_household and vi.status <> 'paid' and d.status = 'active'
    and vi.due_date <= current_date + 5 and vi.due_date >= current_date - 30
    and (d.visibility = 'household' or d.owner_id = m.user_id)
    and coalesce((pr.notification_prefs ->> 'debt_installment_due')::boolean, true)
  on conflict (user_id, dedupe_key) do nothing;
  get diagnostics v_n = row_count; v_count := v_count + v_n;

  return v_count;
end $$;

-- Rotina leve chamada ao abrir o app (no máximo a cada 5 minutos por família)
create or replace function public.sync_household(p_household uuid, p_force boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare v_last timestamptz;
begin
  if not public.is_household_member(p_household) then raise exception 'Acesso negado' using errcode = '42501'; end if;
  select last_synced_at into v_last from public.households where id = p_household for update;
  if not p_force and v_last is not null and v_last > now() - interval '5 minutes' then return; end if;
  perform public.generate_recurring_instances(p_household, current_date + 62);
  perform public.refresh_notifications(p_household);
  update public.households set last_synced_at = now() where id = p_household;
end $$;

-- ---------- Permissões de execução ----------
revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.seed_default_categories(uuid) from authenticated;
grant select on public.v_card_invoices, public.v_debt_installments, public.v_debts to authenticated;
