-- =====================================================================
-- FINANCE HUB — Dados de demonstração (segregados por is_demo = true)
-- Carregar: select seed_demo_data('<household>');
-- Limpar:   select clear_demo_data('<household>');
-- =====================================================================

create or replace function public.demo_date(p_month_offset int, p_day int) returns date
language sql stable as $$
  select public.month_day((date_trunc('month', current_date) + make_interval(months => p_month_offset))::date, p_day);
$$;

create or replace function public.seed_demo_data(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_partner uuid;
  a_me uuid; a_partner uuid; a_joint uuid; a_cash uuid; a_invest uuid;
  c_joint uuid; c_partner uuid;
  r_rent uuid; r_power uuid; r_net uuid; r_gym uuid; r_stream uuid; r_salary_me uuid; r_salary_partner uuid;
  g_reserve uuid; g_trip uuid;
  v_debt uuid;
  m int; d date; ri record;
  cat jsonb;
begin
  if not public.is_household_member(p_household) then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if exists (select 1 from public.accounts where household_id = p_household and is_demo) then
    raise exception 'Os dados de demonstração já foram carregados';
  end if;
  select coalesce(
    (select user_id from public.household_members where household_id = p_household and user_id <> v_me limit 1), v_me)
  into v_partner;

  select jsonb_object_agg(kind || ':' || name, id) into cat
  from public.transaction_categories where household_id = p_household;

  -- Contas
  insert into public.accounts (household_id, name, institution, type, initial_balance, color, owner_id, scope, is_demo)
  values (p_household, 'Conta pessoal', 'Nubank', 'digital', 2350, '#7C3AED', v_me, 'individual', true) returning id into a_me;
  insert into public.accounts (household_id, name, institution, type, initial_balance, color, owner_id, scope, is_demo)
  values (p_household, 'Conta pessoal', 'Itaú', 'checking', 1820, '#EA7A1A', v_partner, 'individual', true) returning id into a_partner;
  insert into public.accounts (household_id, name, institution, type, initial_balance, color, owner_id, scope, is_demo)
  values (p_household, 'Conta conjunta', 'Banco Inter', 'checking', 3100, '#4969E8', v_me, 'shared', true) returning id into a_joint;
  insert into public.accounts (household_id, name, institution, type, initial_balance, color, owner_id, scope, is_demo)
  values (p_household, 'Carteira', null, 'cash', 180, '#16A36A', v_me, 'individual', true) returning id into a_cash;
  insert into public.accounts (household_id, name, institution, type, initial_balance, color, owner_id, scope, is_demo)
  values (p_household, 'Reserva — CDB', 'Nubank', 'investment', 9000, '#0EA5A4', v_me, 'shared', true) returning id into a_invest;

  -- Cartões
  insert into public.credit_cards (household_id, name, bank, brand, last4, credit_limit, closing_day, due_day, color, owner_id, scope, is_demo)
  values (p_household, 'Cartão do casal', 'Nubank', 'mastercard', '4821', 7500, 3, 10, '#1B2A6B', v_me, 'shared', true) returning id into c_joint;
  insert into public.credit_cards (household_id, name, bank, brand, last4, credit_limit, closing_day, due_day, color, owner_id, scope, is_demo)
  values (p_household, 'Inter Gold', 'Banco Inter', 'visa', '0377', 4200, 25, 5, '#C2410C', v_partner, 'individual', true) returning id into c_partner;

  -- Recorrências (receitas e contas fixas), desde 3 meses atrás
  insert into public.recurring_transactions (household_id, name, kind, amount, category_id, account_id, payment_method, frequency, due_day, start_date, owner_id, scope, is_demo)
  values
    (p_household, 'Salário', 'income', 6000, (cat ->> 'income:Salário')::uuid, a_me, 'transfer', 'monthly', 5, public.demo_date(-3, 1), v_me, 'individual', true)
    returning id into r_salary_me;
  insert into public.recurring_transactions (household_id, name, kind, amount, category_id, account_id, payment_method, frequency, due_day, start_date, owner_id, scope, is_demo)
  values
    (p_household, 'Salário', 'income', 4500, (cat ->> 'income:Salário')::uuid, a_partner, 'transfer', 'monthly', 5, public.demo_date(-3, 1), v_partner, 'individual', true)
    returning id into r_salary_partner;
  insert into public.recurring_transactions (household_id, name, amount, category_id, account_id, payment_method, frequency, due_day, start_date, owner_id, scope, is_demo)
  values (p_household, 'Aluguel', 1800, (cat ->> 'expense:Moradia')::uuid, a_joint, 'pix', 'monthly', 10, public.demo_date(-3, 1), v_me, 'shared', true)
    returning id into r_rent;
  insert into public.recurring_transactions (household_id, name, amount, category_id, account_id, payment_method, frequency, due_day, start_date, owner_id, scope, is_demo)
  values (p_household, 'Energia elétrica', 180, (cat ->> 'expense:Moradia')::uuid, a_joint, 'bank_slip', 'monthly', 15, public.demo_date(-3, 1), v_partner, 'shared', true)
    returning id into r_power;
  insert into public.recurring_transactions (household_id, name, amount, category_id, account_id, payment_method, frequency, due_day, start_date, owner_id, scope, is_demo)
  values (p_household, 'Internet fibra', 120, (cat ->> 'expense:Moradia')::uuid, a_joint, 'debit', 'monthly', 20, public.demo_date(-3, 1), v_me, 'shared', true)
    returning id into r_net;
  insert into public.recurring_transactions (household_id, name, amount, category_id, account_id, payment_method, frequency, due_day, start_date, owner_id, scope, is_demo)
  values (p_household, 'Academia', 150, (cat ->> 'expense:Saúde')::uuid, a_me, 'debit', 'monthly', 7, public.demo_date(-3, 1), v_me, 'individual', true)
    returning id into r_gym;
  insert into public.recurring_transactions (household_id, name, amount, category_id, account_id, payment_method, frequency, due_day, start_date, owner_id, scope, is_demo)
  values (p_household, 'Streaming', 55.90, (cat ->> 'expense:Assinaturas')::uuid, a_partner, 'debit', 'monthly', 12, public.demo_date(-3, 1), v_partner, 'shared', true)
    returning id into r_stream;

  perform public.generate_recurring_instances(p_household, current_date + 62);
  for ri in
    select i.id, i.due_date from public.recurring_instances i
    join public.recurring_transactions r on r.id = i.recurring_id
    where r.household_id = p_household and r.is_demo and i.due_date <= current_date - 1
    order by i.due_date
  loop
    perform public.pay_recurring_instance(ri.id, null, null, ri.due_date);
  end loop;

  -- Movimentações variáveis dos últimos 3 meses + mês atual
  for m in -3..0 loop
    -- supermercado (compartilhado) ~ R$ 950/mês
    for d in select unnest(array[public.demo_date(m, 3), public.demo_date(m, 11), public.demo_date(m, 19), public.demo_date(m, 26)]) loop
      if d <= current_date then
        insert into public.transactions (household_id, kind, description, amount, category_id, date, account_id, payment_method, owner_id, scope, is_demo)
        values (p_household, 'expense', 'Supermercado', 220 + (extract(day from d)::int % 7) * 9.35, (cat ->> 'expense:Supermercado')::uuid, d, a_joint, 'debit',
          case when extract(day from d)::int % 2 = 0 then v_me else v_partner end, 'shared', true);
      end if;
    end loop;
    if public.demo_date(m, 8) <= current_date then
      insert into public.transactions (household_id, kind, description, amount, category_id, date, account_id, payment_method, owner_id, scope, is_demo)
      values
        (p_household, 'expense', 'Combustível', 230, (cat ->> 'expense:Combustível')::uuid, public.demo_date(m, 8), a_me, 'debit', v_me, 'individual', true),
        (p_household, 'expense', 'Padaria', 38.50, (cat ->> 'expense:Alimentação')::uuid, public.demo_date(m, 8), a_cash, 'cash', v_me, 'individual', true),
        (p_household, 'expense', 'Dízimo e ofertas', 300, (cat ->> 'expense:Igreja e doações')::uuid, public.demo_date(m, 6), a_joint, 'pix', v_me, 'shared', true);
    end if;
    if public.demo_date(m, 14) <= current_date then
      insert into public.transactions (household_id, kind, description, amount, category_id, date, account_id, payment_method, owner_id, scope, is_demo)
      values
        (p_household, 'expense', 'Farmácia', 86.40, (cat ->> 'expense:Saúde')::uuid, public.demo_date(m, 14), a_partner, 'pix', v_partner, 'individual', true),
        (p_household, 'income', 'Projeto freelance', 850, (cat ->> 'income:Freelance')::uuid, public.demo_date(m, 14), a_me, 'pix', v_me, 'individual', true);
    end if;
    if public.demo_date(m, 6) <= current_date then
      insert into public.transfers (household_id, from_account_id, to_account_id, amount, date, description, is_demo)
      values (p_household, a_me, a_joint, 2800, public.demo_date(m, 6), 'Contribuição conta conjunta', true),
             (p_household, a_partner, a_joint, 2000, public.demo_date(m, 6), 'Contribuição conta conjunta', true);
    end if;

    -- compras no cartão (somente datas já ocorridas)
    if public.demo_date(m, 9) <= current_date then
      perform public.register_card_purchase(c_joint, 'Restaurante', 186.90, 1, public.demo_date(m, 9), (cat ->> 'expense:Alimentação')::uuid, v_me, 'shared', 'household', null, true);
    end if;
    if public.demo_date(m, 10) <= current_date then
      perform public.register_card_purchase(c_partner, 'Roupas', 249.90, 2, public.demo_date(m, 10), (cat ->> 'expense:Vestuário')::uuid, v_partner, 'individual', 'household', null, true);
    end if;
    if public.demo_date(m, 12) <= current_date then
      perform public.register_card_purchase(c_joint, 'Cinema', 96, 1, public.demo_date(m, 12), (cat ->> 'expense:Lazer')::uuid, v_me, 'shared', 'household', null, true);
    end if;
    if public.demo_date(m, 13) <= current_date then
      perform public.register_card_purchase(c_joint, 'Delivery', 72.40, 1, public.demo_date(m, 13), (cat ->> 'expense:Alimentação')::uuid, v_partner, 'shared', 'household', null, true);
    end if;
    if public.demo_date(m, 16) <= current_date then
      perform public.register_card_purchase(c_joint, 'Uber', 64.30, 1, public.demo_date(m, 16), (cat ->> 'expense:Transporte')::uuid, v_partner, 'shared', 'household', null, true);
    end if;
    if public.demo_date(m, 17) <= current_date then
      perform public.register_card_purchase(c_joint, 'Ração e petshop', 158, 1, public.demo_date(m, 17), (cat ->> 'expense:Pets')::uuid, v_me, 'shared', 'household', null, true);
    end if;
  end loop;
  perform public.register_card_purchase(c_joint, 'Smart TV 55"', 2400, 6, public.demo_date(-2, 15), (cat ->> 'expense:Compras pessoais')::uuid, v_me, 'shared', 'household', 'Compra parcelada', true);

  -- paga as faturas já vencidas
  for ri in select id, total, paid_amount, due_date, card_id from public.v_card_invoices
            where household_id = p_household and due_date < current_date and total > paid_amount loop
    perform public.pay_card_invoice(ri.id, case when ri.card_id = c_joint then a_joint else a_partner end, ri.total - ri.paid_amount, ri.due_date);
  end loop;

  -- Despesa prevista (pendente)
  insert into public.transactions (household_id, kind, status, description, amount, category_id, date, due_date, account_id, payment_method, owner_id, scope, is_demo)
  values (p_household, 'expense', 'pending', 'IPVA — parcela', 412.35, (cat ->> 'expense:Impostos')::uuid, current_date + 4, current_date + 4, a_me, 'bank_slip', v_me, 'individual', true);

  -- Dívida temporária
  v_debt := public.create_debt('Empréstimo pessoal', 'Banco Inter', 'loan', 3000, 1.9, 10, 335, public.demo_date(-3, 20),
    public.demo_date(-2, 20), v_partner, 'shared', 'household', 1, 'Empréstimo para reforma do banheiro', 0, true, p_household);
  for ri in select id, due_date from public.v_debt_installments where debt_id = v_debt and due_date < current_date order by number loop
    perform public.pay_debt_installment(ri.id, a_joint, null, ri.due_date);
  end loop;

  -- Metas
  insert into public.financial_goals (household_id, name, description, target_amount, target_date, icon, color, owner_id, scope, is_demo)
  values (p_household, 'Reserva de emergência', '6 meses do custo de vida do casal', 30000, public.demo_date(14, 1), 'shield', '#16A36A', v_me, 'shared', true)
  returning id into g_reserve;
  insert into public.financial_goals (household_id, name, description, target_amount, target_date, icon, color, owner_id, scope, is_demo)
  values (p_household, 'Viagem de aniversário', 'Férias em Gramado', 8000, public.demo_date(8, 1), 'plane', '#4969E8', v_partner, 'shared', true)
  returning id into g_trip;
  insert into public.goal_contributions (household_id, goal_id, amount, date, note)
  values (p_household, g_reserve, 9000, public.demo_date(-3, 5), 'Saldo inicial do CDB'),
         (p_household, g_reserve, 1000, public.demo_date(-1, 6), null),
         (p_household, g_trip, 1500, public.demo_date(-2, 6), null),
         (p_household, g_trip, 1000, public.demo_date(0, 1), null);

  -- Orçamentos por categoria
  insert into public.budgets (household_id, category_id, amount, is_demo) values
    (p_household, (cat ->> 'expense:Supermercado')::uuid, 1200, true),
    (p_household, (cat ->> 'expense:Alimentação')::uuid, 450, true),
    (p_household, (cat ->> 'expense:Lazer')::uuid, 300, true),
    (p_household, (cat ->> 'expense:Transporte')::uuid, 350, true)
  on conflict (household_id, category_id) do nothing;

  perform public.sync_household(p_household, true);
end $$;

create or replace function public.clear_demo_data(p_household uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_household_member(p_household) then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if exists (
    select 1 from public.transactions t join public.accounts a on a.id = t.account_id
    where a.household_id = p_household and a.is_demo and not t.is_demo
  ) or exists (
    select 1 from public.transactions t join public.credit_cards c on c.id = t.credit_card_id
    where c.household_id = p_household and c.is_demo and not t.is_demo
  ) then
    raise exception 'Existem lançamentos reais vinculados a contas ou cartões de demonstração. Mova-os antes de limpar.';
  end if;

  delete from public.transactions where household_id = p_household and is_demo;
  delete from public.transfers where household_id = p_household and is_demo;
  delete from public.recurring_transactions where household_id = p_household and is_demo;
  delete from public.debts where household_id = p_household and is_demo;
  delete from public.financial_goals where household_id = p_household and is_demo;
  delete from public.budgets where household_id = p_household and is_demo;
  delete from public.credit_cards where household_id = p_household and is_demo;
  delete from public.accounts where household_id = p_household and is_demo;
  delete from public.notifications where household_id = p_household;
  update public.households set last_synced_at = null where id = p_household;
end $$;

revoke execute on function public.seed_demo_data(uuid), public.clear_demo_data(uuid) from public, anon;
grant execute on function public.seed_demo_data(uuid), public.clear_demo_data(uuid), public.demo_date(int, int) to authenticated;
