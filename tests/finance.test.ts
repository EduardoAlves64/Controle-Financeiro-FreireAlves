import { describe, expect, it } from "vitest";
import { formatBRL, parseBRL, percentChange, splitInstallments, sumMoney } from "@/lib/money";
import { monthRange, previousRange, todayISO, weekRange } from "@/lib/dates";
import { recurrenceDates } from "@/lib/finance/recurrence";
import { payoffSimulation, pmt } from "@/lib/finance/debt";
import { balanceSeries, buildInsights, monthlySeries, summarize, toCSV } from "@/lib/finance/reports";
import { matchesPerspective } from "@/lib/perspective";
import { createDb } from "./helpers/db";
import type { Transaction } from "@/lib/types";

describe("dinheiro", () => {
  it("soma sem erro de ponto flutuante", () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney(["450.35", 1000.1, -0.45])).toBe(1450);
  });
  it("formata em BRL", () => {
    expect(formatBRL(1234.56)).toBe("R$ 1.234,56");
    expect(formatBRL(-9.9)).toBe("-R$ 9,90");
    expect(formatBRL(10, { signed: true })).toBe("+R$ 10,00");
  });
  it("interpreta valores digitados", () => {
    expect(parseBRL("R$ 1.234,56")).toBe(1234.56);
    expect(parseBRL("1234.5")).toBe(1234.5);
    expect(parseBRL("")).toBe(0);
  });
  it("divide parcelas com centavos na primeira (igual ao banco)", () => {
    expect(splitInstallments(100, 3)).toEqual([33.34, 33.33, 33.33]);
    expect(sumMoney(splitInstallments(2400, 7))).toBe(2400);
  });
  it("variação percentual", () => {
    expect(percentChange(88, 100)).toBeCloseTo(-12);
    expect(percentChange(10, 0)).toBeNull();
  });
});

describe("datas", () => {
  it("intervalos de mês e semana", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(weekRange("2026-11-19")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
    expect(previousRange({ from: "2026-11-16", to: "2026-11-22" })).toEqual({ from: "2026-11-09", to: "2026-11-15" });
  });
  it("hoje no fuso de Brasília", () => {
    expect(todayISO(new Date("2026-11-18T01:30:00Z"))).toBe("2026-11-17");
  });
});

describe("recorrência", () => {
  it("mensal no dia 31 respeita meses curtos", () => {
    expect(recurrenceDates("monthly", "2026-01-15", 31, "2026-01-01", "2026-04-30")).toEqual([
      "2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30",
    ]);
  });
  it("quinzenal e trimestral", () => {
    expect(recurrenceDates("biweekly", "2026-01-01", 1, "2026-01-10", "2026-02-15")).toEqual([
      "2026-01-15", "2026-01-29", "2026-02-12",
    ]);
    expect(recurrenceDates("quarterly", "2026-01-01", 10, "2026-01-01", "2026-12-31")).toEqual([
      "2026-01-10", "2026-04-10", "2026-07-10", "2026-10-10",
    ]);
  });
  it("espelho TS == função SQL", async () => {
    const db = await createDb();
    const cases: [string, string, number, string, string][] = [
      ["monthly", "2026-01-31", 31, "2026-01-01", "2026-12-31"],
      ["bimonthly", "2026-03-05", 5, "2026-01-01", "2027-03-01"],
      ["weekly", "2026-02-27", 1, "2026-03-01", "2026-04-01"],
      ["annual", "2024-02-29", 29, "2024-01-01", "2028-12-31"],
      ["semiannual", "2026-06-20", 10, "2026-01-01", "2028-01-01"],
    ];
    for (const [f, s, d, from, until] of cases) {
      const r = await db.query<{ d: string }>("select to_char(d, 'YYYY-MM-DD') d from recurrence_dates($1, $2, $3, $4, $5) d", [f, s, d, from, until]);
      expect(r.rows.map((x) => x.d)).toEqual(recurrenceDates(f as never, s, d, from, until));
    }
  });
});

describe("dívidas", () => {
  it("parcela price", () => {
    expect(pmt(3000, 0, 10)).toBe(300);
    expect(pmt(10000, 2, 12)).toBeCloseTo(945.6, 1);
  });
  it("simulação de quitação desconta juros futuros", () => {
    const sim = payoffSimulation(
      [
        { due_date: "2026-12-17", remaining: 500 },
        { due_date: "2027-01-17", remaining: 500 },
      ],
      2,
      "2026-11-17",
    );
    expect(sim.nominal).toBe(1000);
    expect(sim.payoffToday).toBeLessThan(1000);
    expect(sim.savings).toBeCloseTo(1000 - sim.payoffToday, 2);
  });
});

const base: Omit<Transaction, "id" | "kind" | "amount" | "date" | "owner_id" | "scope"> = {
  status: "paid", description: "x", category_id: null, due_date: null, paid_at: null, account_id: "acc",
  credit_card_id: null, invoice_id: null, payment_method: null, notes: null, installment_group: null,
  installment_number: null, installment_total: null, recurring_instance_id: null, debt_id: null,
  debt_installment_id: null, visibility: "household", is_demo: false, created_at: "",
};
const tx = (p: Partial<Transaction>): Transaction => ({ id: Math.random().toString(), kind: "expense", amount: 10, date: "2026-11-10", owner_id: "h", scope: "shared", ...base, ...p });

describe("relatórios", () => {
  const members = [{ user_id: "h", full_name: "Eduardo Alves" }, { user_id: "w", full_name: "Raphaela Freire" }];
  const cats = [{ id: "food", name: "Alimentação", color: "#f00" }, { id: "fun", name: "Lazer", color: "#0f0" }];
  const data = [
    tx({ kind: "income", amount: 6000, owner_id: "h", scope: "individual", category_id: null }),
    tx({ amount: 300, category_id: "food" }),
    tx({ amount: 200, category_id: "fun", owner_id: "w", scope: "individual", account_id: null, credit_card_id: "card" }),
    tx({ amount: 100, category_id: "food", owner_id: "h", scope: "individual" }),
    tx({ kind: "invoice_payment", amount: 200, category_id: null }),
    tx({ amount: 999, status: "pending", category_id: "food" }),
    tx({ amount: 50, date: "2026-10-30", category_id: "fun" }),
  ];

  it("pagamento de fatura e despesa prevista não entram como gasto", () => {
    const s = summarize(data, monthRange("2026-11"), cats, members);
    expect(s.expense).toBe(600);
    expect(s.income).toBe(6000);
    expect(s.pendingExpense).toBe(999);
    expect(s.byCategory[0]).toMatchObject({ label: "Alimentação", total: 400 });
    expect(s.sharedExpense).toBe(300);
    expect(s.individualByPerson.map((p) => [p.label, p.total])).toEqual([["Raphaela", 200], ["Eduardo", 100]]);
  });

  it("séries mensais e evolução de saldo (compra no cartão não sai da conta)", () => {
    const series = monthlySeries(data, ["2026-10", "2026-11"]);
    expect(series).toEqual([
      { month: "2026-10", income: 0, expense: 50, net: -50 },
      { month: "2026-11", income: 6000, expense: 600, net: 5400 },
    ]);
    // fluxo em conta de nov: +6000 -300 -100 -200(fatura) = 5400
    const bal = balanceSeries(data, ["2026-10", "2026-11"], 10000);
    expect(bal).toEqual([{ month: "2026-10", balance: 4600 }, { month: "2026-11", balance: 10000 }]);
  });

  it("insights usam apenas dados reais", () => {
    const current = summarize(data, monthRange("2026-11"), cats, members);
    const previous = summarize(data, monthRange("2026-10"), cats, members);
    const insights = buildInsights({ current, previous, upcomingBills: 3, periodLabel: "semana", isCouple: true });
    expect(insights).toContain("Existem três contas com vencimento nos próximos sete dias.");
    expect(insights.some((i) => i.startsWith("Alimentação foi a categoria com maior despesa"))).toBe(true);
    expect(insights.some((i) => i.includes("1100% mais"))).toBe(true);
    expect(insights.some((i) => i.startsWith("Raphaela concentrou 67%"))).toBe(true);
    const empty = buildInsights({ current: summarize([], monthRange("2026-11"), cats, members), previous, upcomingBills: 0, periodLabel: "semana", isCouple: true });
    expect(empty[0]).toBe("Nenhuma movimentação foi registrada nesta semana.");
  });

  it("CSV com ; e escape", () => {
    expect(toCSV([["a;b", 'c"d', 1]])).toBe('﻿"a;b";"c""d";1');
  });
});

describe("perspectiva individual x casal", () => {
  it("filtra corretamente", () => {
    const shared = { owner_id: "h", scope: "shared" as const };
    const mine = { owner_id: "h", scope: "individual" as const };
    const hers = { owner_id: "w", scope: "individual" as const };
    expect([shared, mine, hers].filter((i) => matchesPerspective(i, "shared", "h"))).toEqual([shared]);
    expect([shared, mine, hers].filter((i) => matchesPerspective(i, "me", "h"))).toEqual([mine]);
    expect([shared, mine, hers].filter((i) => matchesPerspective(i, "partner", "h"))).toEqual([hers]);
    expect([shared, mine, hers].filter((i) => matchesPerspective(i, "all", "h"))).toHaveLength(3);
  });
});

describe("evolução do saldo com transferências", () => {
  it("transferência para fora do conjunto reduz o saldo histórico corretamente", () => {
    const series = balanceSeries([], ["2026-10", "2026-11"], 1000, [{ date: "2026-11-06", amount: 2800 }]);
    expect(series).toEqual([{ month: "2026-10", balance: -1800 }, { month: "2026-11", balance: 1000 }]);
  });
});
