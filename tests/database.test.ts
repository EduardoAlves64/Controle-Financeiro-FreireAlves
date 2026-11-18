import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { asUser, createDb, one, signUp } from "./helpers/db";

let db: PGlite;
let husband: string;
let wife: string;
let stranger: string;
let household: string;
let otherHousehold: string;

const num = (v: unknown) => Number(v);

async function cat(kind: "income" | "expense", name: string) {
  const r = await one<{ id: string }>(
    db,
    "select id from transaction_categories where household_id = $1 and kind = $2 and name = $3",
    [household, kind, name],
  );
  return r.id;
}

async function createAccount(owner: string, name: string, initial = 0, extra: Record<string, string> = {}) {
  return asUser(db, owner, async () => {
    const r = await one<{ id: string }>(
      db,
      `insert into accounts (household_id, name, initial_balance, owner_id, scope, visibility)
       values ($1, $2, $3, $4, $5, $6) returning id`,
      [household, name, initial, owner, extra.scope ?? "individual", extra.visibility ?? "household"],
    );
    return r.id;
  });
}

async function balance(user: string, accountId: string) {
  return asUser(db, user, async () => {
    const r = await one<{ balance: string }>(
      db,
      "select balance from account_balances($1) where account_id = $2",
      [household, accountId],
    );
    return num(r?.balance);
  });
}

async function totalExpenses(user: string) {
  return asUser(db, user, async () => {
    const r = await one<{ total: string }>(
      db,
      "select coalesce(sum(amount),0) total from transactions where household_id = $1 and kind = 'expense' and deleted_at is null",
      [household],
    );
    return num(r.total);
  });
}

beforeAll(async () => {
  db = await createDb();
  husband = await signUp(db, "marido@example.com", "Eduardo");
  const h = await one<{ household_id: string; invite_code: string }>(
    db,
    "select p.household_id, h.invite_code from profiles p join households h on h.id = p.household_id where p.id = $1",
    [husband],
  );
  household = h.household_id;
  wife = await signUp(db, "esposa@example.com", "Raphaela", h.invite_code.toLowerCase());
  stranger = await signUp(db, "outro@example.com", "Outra Pessoa");
  otherHousehold = (await one<{ household_id: string }>(db, "select household_id from profiles where id = $1", [stranger])).household_id;
});

describe("núcleo familiar e autenticação", () => {
  it("cria família com categorias padrão no cadastro", async () => {
    const r = await one<{ n: string }>(db, "select count(*) n from transaction_categories where household_id = $1", [household]);
    expect(num(r.n)).toBeGreaterThanOrEqual(20);
  });

  it("vincula a esposa ao mesmo núcleo via código de convite", async () => {
    const r = await one<{ household_id: string }>(db, "select household_id from profiles where id = $1", [wife]);
    expect(r.household_id).toBe(household);
    const m = await one<{ n: string }>(db, "select count(*) n from household_members where household_id = $1", [household]);
    expect(num(m.n)).toBe(2);
  });

  it("não permite um terceiro membro no mesmo núcleo", async () => {
    const code = (await one<{ invite_code: string }>(db, "select invite_code from households where id = $1", [household])).invite_code;
    await expect(asUser(db, stranger, () => db.query("select join_household($1)", [code]))).rejects.toThrow(/dois membros/);
  });
});

describe("segurança (RLS)", () => {
  it("usuário de outra família não vê dados da família", async () => {
    const acc = await createAccount(husband, "Conta secreta", 1000);
    const seen = await asUser(db, stranger, () => db.query("select id from accounts where id = $1", [acc]));
    expect(seen.rows).toHaveLength(0);
    const cats = await asUser(db, stranger, () =>
      db.query("select id from transaction_categories where household_id = $1", [household]),
    );
    expect(cats.rows).toHaveLength(0);
  });

  it("usuário de outra família não consegue inserir na família", async () => {
    await expect(
      asUser(db, stranger, () =>
        db.query("insert into accounts (household_id, name, owner_id) values ($1, 'x', $2)", [household, stranger]),
      ),
    ).rejects.toThrow();
  });

  it("não aceita conta de outra família numa movimentação (FK composta)", async () => {
    const foreignAcc = await asUser(db, stranger, async () =>
      (await one<{ id: string }>(db, "insert into accounts (household_id, name, owner_id) values ($1, 'x', $2) returning id", [otherHousehold, stranger])).id,
    );
    await expect(
      asUser(db, husband, () =>
        db.query(
          "insert into transactions (household_id, kind, description, amount, account_id, owner_id) values ($1, 'expense', 'x', 10, $2, $3)",
          [household, foreignAcc, husband],
        ),
      ),
    ).rejects.toThrow();
  });

  it("movimentação privada só é visível ao responsável", async () => {
    const acc = await createAccount(wife, "Conta dela", 0);
    const tx = await asUser(db, wife, async () =>
      (await one<{ id: string }>(
        db,
        `insert into transactions (household_id, kind, description, amount, account_id, owner_id, visibility)
         values ($1, 'expense', 'Presente surpresa', 200, $2, $3, 'private') returning id`,
        [household, acc, wife],
      )).id,
    );
    const husbandView = await asUser(db, husband, () => db.query("select id from transactions where id = $1", [tx]));
    expect(husbandView.rows).toHaveLength(0);
    const wifeView = await asUser(db, wife, () => db.query("select id from transactions where id = $1", [tx]));
    expect(wifeView.rows).toHaveLength(1);
  });

  it("não permite criar item privado em nome do outro", async () => {
    await expect(
      asUser(db, husband, () =>
        db.query(
          "insert into financial_goals (household_id, name, target_amount, owner_id, visibility) values ($1, 'x', 10, $2, 'private')",
          [household, wife],
        ),
      ),
    ).rejects.toThrow();
  });
});

describe("saldos e transferências", () => {
  it("receitas, despesas e transferências atualizam o saldo; transferência não é receita nem despesa", async () => {
    const a = await createAccount(husband, "Corrente A", 1000);
    const b = await createAccount(husband, "Corrente B", 0);
    const expensesBefore = await totalExpenses(husband);
    await asUser(db, husband, async () => {
      await db.query(
        `insert into transactions (household_id, kind, description, amount, account_id, owner_id, category_id)
         values ($1, 'income', 'Salário', 6000, $2, $3, $4), ($1, 'expense', 'Mercado', 450.35, $2, $3, $5)`,
        [household, a, husband, await cat("income", "Salário"), await cat("expense", "Supermercado")],
      );
      await db.query(
        "insert into transactions (household_id, kind, status, description, amount, account_id, owner_id) values ($1, 'expense', 'pending', 'Previsto', 999, $2, $3)",
        [household, a, husband],
      );
      await db.query("insert into transfers (household_id, from_account_id, to_account_id, amount) values ($1, $2, $3, 500)", [household, a, b]);
    });
    expect(await balance(husband, a)).toBeCloseTo(1000 + 6000 - 450.35 - 500, 2);
    expect(await balance(husband, b)).toBeCloseTo(500, 2);
    // despesa prevista não afeta saldo, transferência não vira despesa
    expect(await totalExpenses(husband)).toBeCloseTo(expensesBefore + 450.35 + 999, 2);
  });

  it("ajuste manual identificado altera o saldo", async () => {
    const a = await createAccount(husband, "Conta ajuste", 100);
    await asUser(db, husband, () =>
      db.query(
        "insert into transactions (household_id, kind, description, amount, account_id, owner_id) values ($1, 'adjustment', 'Conciliação', -25.5, $2, $3)",
        [household, a, husband],
      ),
    );
    expect(await balance(husband, a)).toBeCloseTo(74.5, 2);
  });
});

describe("cartão de crédito sem duplicidade", () => {
  let card: string;
  let acc: string;

  beforeAll(async () => {
    acc = await createAccount(husband, "Conta do cartão", 5000, { scope: "shared" });
    card = await asUser(db, husband, async () =>
      (await one<{ id: string }>(
        db,
        `insert into credit_cards (household_id, name, credit_limit, closing_day, due_day, owner_id, scope)
         values ($1, 'Cartão teste', 5000, 10, 17, $2, 'shared') returning id`,
        [household, husband],
      )).id,
    );
  });

  it("compra parcelada vira 1 despesa e parcelas distribuídas nas faturas (centavos corretos)", async () => {
    const before = await totalExpenses(husband);
    const tx = await asUser(db, husband, async () =>
      (await one<{ register_card_purchase: string }>(
        db,
        "select register_card_purchase($1, 'Notebook', 100, 3, '2026-03-05', null, $2, 'shared')",
        [card, husband],
      )).register_card_purchase,
    );
    expect(await totalExpenses(husband)).toBeCloseTo(before + 100, 2);
    const inst = await asUser(db, husband, () =>
      db.query<{ amount: string; reference_month: string }>(
        `select ci.amount, to_char(i.reference_month, 'YYYY-MM') reference_month from credit_card_installments ci
         join credit_card_purchases p on p.id = ci.purchase_id join credit_card_invoices i on i.id = ci.invoice_id
         where p.transaction_id = $1 order by ci.number`,
        [tx],
      ),
    );
    expect(inst.rows.map((r) => num(r.amount))).toEqual([33.34, 33.33, 33.33]);
    expect(inst.rows.map((r) => r.reference_month)).toEqual(["2026-03", "2026-04", "2026-05"]);
  });

  it("compra no dia do fechamento cai na fatura seguinte", async () => {
    const r = await asUser(db, husband, async () => {
      const tx = (await one<{ id: string }>(db, "select register_card_purchase($1, 'Jantar', 80, 1, '2026-03-10', null, $2, 'shared') id", [card, husband])).id;
      return one<{ ref: string; due: string }>(
        db,
        `select to_char(i.reference_month,'YYYY-MM') ref, i.due_date::text due from credit_card_installments ci
         join credit_card_purchases p on p.id = ci.purchase_id join credit_card_invoices i on i.id = ci.invoice_id where p.transaction_id = $1`,
        [tx],
      );
    });
    expect(r.ref).toBe("2026-04");
    expect(r.due).toBe("2026-04-17");
  });

  it("pagar a fatura reduz o saldo mas NÃO conta como nova despesa", async () => {
    const expensesBefore = await totalExpenses(husband);
    const balanceBefore = await balance(husband, acc);
    const inv = await asUser(db, husband, () =>
      one<{ id: string; total: string }>(db, "select id, total from v_card_invoices where card_id = $1 and reference_month = '2026-03-01'", [card]),
    );
    expect(num(inv.total)).toBeCloseTo(33.34, 2);
    await asUser(db, husband, () => db.query("select pay_card_invoice($1, $2, $3, '2026-03-17')", [inv.id, acc, inv.total]));
    expect(await totalExpenses(husband)).toBeCloseTo(expensesBefore, 2);
    expect(await balance(husband, acc)).toBeCloseTo(balanceBefore - 33.34, 2);
    const after = await asUser(db, husband, () => one<{ status: string }>(db, "select status from v_card_invoices where id = $1", [inv.id]));
    expect(after.status).toBe("paid");
  });

  it("não permite pagar mais que o saldo da fatura", async () => {
    const inv = await asUser(db, husband, () =>
      one<{ id: string }>(db, "select id from v_card_invoices where card_id = $1 and reference_month = '2026-04-01'", [card]),
    );
    await expect(asUser(db, husband, () => db.query("select pay_card_invoice($1, $2, 10000)", [inv.id, acc]))).rejects.toThrow(/maior/);
  });

  it("não permite alterar valor de compra no cartão diretamente", async () => {
    const tx = await asUser(db, husband, () =>
      one<{ id: string }>(db, "select id from transactions where credit_card_id = $1 limit 1", [card]),
    );
    await expect(asUser(db, husband, () => db.query("update transactions set amount = 1 where id = $1", [tx.id]))).rejects.toThrow(/estorne/);
  });

  it("estorno da compra remove o valor da fatura", async () => {
    const r = await asUser(db, husband, async () => {
      const tx = (await one<{ id: string }>(db, "select register_card_purchase($1, 'Estornável', 50, 1, '2026-06-01', null, $2, 'shared') id", [card, husband])).id;
      const before = num((await one<{ total: string }>(db, "select total from v_card_invoices where card_id = $1 and reference_month = '2026-06-01'", [card])).total);
      await db.query("select reverse_transaction($1)", [tx]);
      const after = num((await one<{ total: string }>(db, "select total from v_card_invoices where card_id = $1 and reference_month = '2026-06-01'", [card])).total);
      return { before, after };
    });
    expect(r.before - r.after).toBeCloseTo(50, 2);
  });
});

describe("contas fixas e recorrências", () => {
  let rec: string;
  let acc: string;

  beforeAll(async () => {
    acc = await createAccount(wife, "Conta contas fixas", 3000, { scope: "shared" });
    rec = await asUser(db, wife, async () =>
      (await one<{ id: string }>(
        db,
        `insert into recurring_transactions (household_id, name, amount, account_id, frequency, due_day, start_date, owner_id)
         values ($1, 'Aluguel', 1800, $2, 'monthly', 31, current_date - 70, $3) returning id`,
        [household, acc, wife],
      )).id,
    );
  });

  it("gera ocorrências sem duplicar (idempotente) e respeita fim de mês", async () => {
    const count = async () =>
      num((await one<{ n: string }>(db, "select count(*) n from recurring_instances where recurring_id = $1", [rec])).n);
    await asUser(db, wife, () => db.query("select generate_recurring_instances($1)", [household]));
    const first = await count();
    expect(first).toBeGreaterThanOrEqual(3);
    await asUser(db, wife, () => db.query("select generate_recurring_instances($1)", [household]));
    expect(await count()).toBe(first);
    const days = await db.query<{ d: number; last: number }>(
      "select extract(day from due_date)::int d, extract(day from (date_trunc('month', due_date) + interval '1 month - 1 day'))::int last from recurring_instances where recurring_id = $1",
      [rec],
    );
    for (const r of days.rows) expect(r.d).toBe(r.last);
  });

  it("adiar o vencimento não gera cobrança duplicada", async () => {
    const inst = await one<{ id: string; c: string }>(
      db,
      "select id, (select count(*) from recurring_instances where recurring_id = $1) c from recurring_instances where recurring_id = $1 order by due_date desc limit 1",
      [rec],
    );
    await asUser(db, wife, async () => {
      await db.query("update recurring_instances set due_date = due_date + 5 where id = $1", [inst.id]);
      await db.query("select generate_recurring_instances($1)", [household]);
    });
    const after = await one<{ c: string }>(db, "select count(*) c from recurring_instances where recurring_id = $1", [rec]);
    expect(after.c).toBe(inst.c);
  });

  it("marcar como paga cria a despesa uma única vez; estorno volta a pendente", async () => {
    const inst = await one<{ id: string }>(db, "select id from recurring_instances where recurring_id = $1 order by due_date limit 1", [rec]);
    const before = await balance(wife, acc);
    const tx = await asUser(db, wife, async () =>
      (await one<{ id: string }>(db, "select pay_recurring_instance($1) id", [inst.id])).id,
    );
    expect(await balance(wife, acc)).toBeCloseTo(before - 1800, 2);
    await expect(asUser(db, wife, () => db.query("select pay_recurring_instance($1)", [inst.id]))).rejects.toThrow(/já foi paga/);
    await asUser(db, wife, () => db.query("select reverse_transaction($1)", [tx]));
    const st = await one<{ status: string }>(db, "select status from recurring_instances where id = $1", [inst.id]);
    expect(st.status).toBe("pending");
    expect(await balance(wife, acc)).toBeCloseTo(before, 2);
  });

  it("cancelar remove ocorrências futuras pendentes", async () => {
    await asUser(db, wife, () => db.query("select cancel_recurring($1)", [rec]));
    const r = await one<{ n: string }>(
      db,
      "select count(*) n from recurring_instances where recurring_id = $1 and status = 'pending' and due_date >= current_date",
      [rec],
    );
    expect(num(r.n)).toBe(0);
  });
});

describe("dívidas", () => {
  it("parcelas, amortização antecipada, quitação e reversão", async () => {
    const acc = await createAccount(husband, "Conta dívidas", 10000);
    const debt = await asUser(db, husband, async () =>
      (await one<{ id: string }>(
        db,
        "select create_debt('Empréstimo', 'Banco', 'loan', 3000, 2, 3, 1040, current_date - 40, current_date - 10, $1, 'shared', 'household', 1, null, 0, false, $2) id",
        [husband, household],
      )).id,
    );
    const status = () => asUser(db, husband, () =>
      one<{ outstanding: string; status: string; paid_count: number }>(db, "select outstanding, status, paid_count from v_debts where id = $1", [debt]),
    );
    expect(num((await status()).outstanding)).toBeCloseTo(3120, 2);

    const first = await one<{ id: string }>(db, "select id from debt_installments where debt_id = $1 and number = 1", [debt]);
    await asUser(db, husband, () => db.query("select pay_debt_installment($1, $2)", [first.id, acc]));
    expect((await status()).paid_count).toBe(1);
    expect(num((await status()).outstanding)).toBeCloseTo(2080, 2);

    // amortiza 1500: quita a última (1040) e 460 da segunda
    await asUser(db, husband, () => db.query("select amortize_debt($1, $2, 1500)", [debt, acc]));
    const s = await status();
    expect(num(s.outstanding)).toBeCloseTo(580, 2);
    expect(s.paid_count).toBe(2);

    await asUser(db, husband, () => db.query("select amortize_debt($1, $2, 580)", [debt, acc]));
    expect((await status()).status).toBe("paid_off");
    expect(await balance(husband, acc)).toBeCloseTo(10000 - 3120, 2);

    const lastTx = await one<{ id: string }>(db, "select id from transactions where debt_id = $1 order by created_at desc limit 1", [debt]);
    await asUser(db, husband, () => db.query("select reverse_transaction($1)", [lastTx.id]));
    expect((await status()).status).toBe("active");
  });

  it("não permite amortizar mais que o saldo devedor", async () => {
    const acc = await createAccount(husband, "Conta dívida 2", 100);
    const debt = await asUser(db, husband, async () =>
      (await one<{ id: string }>(
        db,
        "select create_debt('Parcelado', null, 'installment_purchase', 200, 0, 2, 100, current_date, current_date + 10, $1, 'individual', 'household', 2, null, 0, false, $2) id",
        [husband, household],
      )).id,
    );
    await expect(asUser(db, husband, () => db.query("select amortize_debt($1, $2, 250)", [debt, acc]))).rejects.toThrow(/saldo devedor/);
  });
});

describe("dados de demonstração e notificações", () => {
  it("carrega dados demo consistentes e limpa sem deixar resíduos", async () => {
    const db2 = await createDb();
    const u1 = await signUp(db2, "a@example.com", "A");
    const hid = (await one<{ household_id: string }>(db2, "select household_id from profiles where id = $1", [u1])).household_id;
    await asUser(db2, u1, () => db2.query("select seed_demo_data($1)", [hid]));

    const counts = await one<Record<string, string>>(
      db2,
      `select (select count(*) from accounts where household_id = $1) accounts,
              (select count(*) from transactions where household_id = $1) txs,
              (select count(*) from credit_card_installments where household_id = $1) inst,
              (select count(*) from debts where household_id = $1) debts,
              (select count(*) from notifications where household_id = $1) notifs`,
      [hid],
    );
    expect(num(counts.accounts)).toBe(5);
    expect(num(counts.txs)).toBeGreaterThan(30);
    expect(num(counts.inst)).toBeGreaterThan(10);
    expect(num(counts.debts)).toBe(1);

    // nenhuma fatura vencida fica em aberto após o seed e nenhum pagamento de fatura vira despesa
    const overdue = await asUser(db2, u1, () => one<{ n: string }>(db2, "select count(*) n from v_card_invoices where status = 'overdue'"));
    expect(num(overdue.n)).toBe(0);

    await asUser(db2, u1, () => db2.query("select clear_demo_data($1)", [hid]));
    const after = await one<Record<string, string>>(
      db2,
      `select (select count(*) from accounts where household_id = $1) accounts,
              (select count(*) from transactions where household_id = $1) txs,
              (select count(*) from credit_card_invoices where household_id = $1) invoices,
              (select count(*) from recurring_instances where household_id = $1) inst`,
      [hid],
    );
    expect(Object.values(after).map(num)).toEqual([0, 0, 0, 0]);
  });

  it("gera notificação de conta próxima do vencimento sem duplicar", async () => {
    const acc = await createAccount(husband, "Conta notif", 0);
    await asUser(db, husband, async () => {
      await db.query(
        `insert into transactions (household_id, kind, status, description, amount, due_date, account_id, owner_id)
         values ($1, 'expense', 'pending', 'Boleto escola', 700, current_date + 2, $2, $3)`,
        [household, acc, husband],
      );
      await db.query("select refresh_notifications($1)", [household]);
      await db.query("select refresh_notifications($1)", [household]);
    });
    const r = await asUser(db, husband, () =>
      db.query("select id from notifications where title like '%Boleto escola%'"),
    );
    expect(r.rows).toHaveLength(1);
    const wifeSees = await asUser(db, wife, () => db.query("select id from notifications where title like '%Boleto escola%'"));
    expect(wifeSees.rows).toHaveLength(1);
  });

  it("registra auditoria das operações sensíveis", async () => {
    const r = await one<{ n: string }>(db, "select count(*) n from audit_logs where household_id = $1 and table_name = 'transactions'", [household]);
    expect(num(r.n)).toBeGreaterThan(0);
  });
});
