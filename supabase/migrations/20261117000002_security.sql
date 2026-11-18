-- =====================================================================
-- FINANCE HUB — Row Level Security
-- Regra geral: só membros do núcleo familiar acessam os dados dele.
-- Itens com visibility = 'private' só são visíveis ao responsável.
-- =====================================================================

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.household_members enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.accounts enable row level security;
alter table public.credit_cards enable row level security;
alter table public.credit_card_invoices enable row level security;
alter table public.credit_card_purchases enable row level security;
alter table public.credit_card_installments enable row level security;
alter table public.recurring_transactions enable row level security;
alter table public.recurring_instances enable row level security;
alter table public.debts enable row level security;
alter table public.debt_installments enable row level security;
alter table public.transactions enable row level security;
alter table public.transfers enable row level security;
alter table public.budgets enable row level security;
alter table public.financial_goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.notifications enable row level security;
alter table public.attachments enable row level security;
alter table public.audit_logs enable row level security;

-- households
create policy households_select on public.households for select using (public.is_household_member(id));
create policy households_update on public.households for update using (public.is_household_member(id)) with check (public.is_household_member(id));

-- profiles: o próprio perfil + perfis dos membros da mesma família
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.household_members a
    join public.household_members b on a.household_id = b.household_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- household_members: leitura entre membros; entrada só via função join_household
create policy members_select on public.household_members for select using (public.is_household_member(household_id));

-- Tabelas com responsável e visibilidade
do $$
declare t text;
begin
  foreach t in array array['accounts','credit_cards','recurring_transactions','debts','transactions','financial_goals']
  loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select using (public.can_view(household_id, owner_id, visibility));
      create policy %1$s_insert on public.%1$I for insert with check (
        public.is_household_member(household_id) and public.is_user_in_household(household_id, owner_id)
        and (visibility = 'household' or owner_id = auth.uid())
      );
      create policy %1$s_update on public.%1$I for update using (public.can_view(household_id, owner_id, visibility))
        with check (public.is_household_member(household_id) and (visibility = 'household' or owner_id = auth.uid()));
      create policy %1$s_delete on public.%1$I for delete using (public.can_view(household_id, owner_id, visibility));
    $f$, t);
  end loop;
end $$;

-- Tabelas de família (sem responsável próprio)
do $$
declare t text;
begin
  foreach t in array array['transaction_categories','credit_card_invoices','credit_card_purchases','credit_card_installments',
    'recurring_instances','debt_installments','transfers','budgets','goal_contributions','attachments']
  loop
    execute format($f$
      create policy %1$s_all on public.%1$I for all
        using (public.is_household_member(household_id))
        with check (public.is_household_member(household_id));
    $f$, t);
  end loop;
end $$;

-- notificações: cada um vê só as suas
create policy notifications_select on public.notifications for select using (user_id = auth.uid());
create policy notifications_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete using (user_id = auth.uid());

-- auditoria: somente leitura para membros
create policy audit_select on public.audit_logs for select using (public.is_household_member(household_id));

-- Nenhum acesso anônimo
revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke insert, update, delete on public.audit_logs from authenticated;
revoke insert, delete on public.household_members from authenticated;
revoke insert, delete on public.households from authenticated;

-- Datas ("hoje", vencimentos) no fuso de Brasília para requisições da API
alter role authenticated set timezone to 'America/Sao_Paulo';
