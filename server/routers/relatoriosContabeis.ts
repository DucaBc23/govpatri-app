/**
 * Router de Relatórios Contábeis Obrigatórios SEPAT — COGES-REL-001
 *
 * Procedures:
 * - balancete.pdf / .csv / .xlsx
 * - dcasp.pdf / .csv / .xlsx
 * - reavaliacao.pdf / .csv / .xlsx
 * - inventarioFisicoFinanceiro.pdf / .csv / .xlsx
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  planoContas, eventosPatrimoniais, periodosContabeis,
  bensMoveisTable, classesBens, depreciacaoMensal, unidadesAdministrativas,
} from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  gerarBalancetePdf, gerarBalanceteCsv, gerarBalanceteXlsx,
  gerarDcaspPdf, gerarDcaspCsv, gerarDcaspXlsx,
  gerarReavaliacaoPdf, gerarReavaliacaoCsv, gerarReavaliacaoXlsx,
  gerarInventarioFisicoFinanceiroPdf, gerarInventarioFisicoFinanceiroCsv, gerarInventarioFisicoFinanceiroXlsx,
  type LinhaBalancete, type LinhaDcasp, type LinhaReavaliacao, type LinhaInventarioFisicoFinanceiro,
} from "../relatoriosContabeis";
import { mscRouter } from "./msc";

const periodoInput = z.object({
  ugId: z.number().int().positive(),
  periodoId: z.number().int().positive(),
});

/** Obtém o nome da UG ou retorna o ID como string */
async function getUgNome(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, ugId: number): Promise<string> {
  const { unidadesGestoras } = await import("../../drizzle/schema");
  const [ug] = await db.select({ nome: unidadesGestoras.nome }).from(unidadesGestoras).where(eq(unidadesGestoras.id, ugId)).limit(1);
  return ug?.nome ?? `UG ${ugId}`;
}

/** Monta as linhas do balancete a partir dos eventos do período */
async function montarLinhasBalancete(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  ugId: number,
  periodoId: number,
): Promise<LinhaBalancete[]> {
  // Buscar contas que aceitam lançamento
  const contas = await db.select().from(planoContas)
    .where(and(eq(planoContas.aceitaLancamento, true), eq(planoContas.isActive, true)));

  // Movimentos a débito na competência
  const debitosRows = await db.select({
    contaId: eventosPatrimoniais.contaDebitoId,
    total: sql<string>`SUM(${eventosPatrimoniais.valor})`,
  }).from(eventosPatrimoniais)
    .where(and(eq(eventosPatrimoniais.ugId, ugId), eq(eventosPatrimoniais.periodoId, periodoId)))
    .groupBy(eventosPatrimoniais.contaDebitoId);

  // Movimentos a crédito na competência
  const creditosRows = await db.select({
    contaId: eventosPatrimoniais.contaCreditoId,
    total: sql<string>`SUM(${eventosPatrimoniais.valor})`,
  }).from(eventosPatrimoniais)
    .where(and(eq(eventosPatrimoniais.ugId, ugId), eq(eventosPatrimoniais.periodoId, periodoId)))
    .groupBy(eventosPatrimoniais.contaCreditoId);

  const movMap = new Map<number, { debito: number; credito: number }>();
  for (const r of debitosRows) {
    const m = movMap.get(r.contaId) ?? { debito: 0, credito: 0 };
    m.debito += parseFloat(r.total ?? "0");
    movMap.set(r.contaId, m);
  }
  for (const r of creditosRows) {
    const m = movMap.get(r.contaId) ?? { debito: 0, credito: 0 };
    m.credito += parseFloat(r.total ?? "0");
    movMap.set(r.contaId, m);
  }

  // Buscar período para calcular saldo anterior
  const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, periodoId)).limit(1);

  const saldosAnteriores = new Map<number, number>();
  if (periodo) {
    const evAnt = await db.select({
      contaDebitoId: eventosPatrimoniais.contaDebitoId,
      contaCreditoId: eventosPatrimoniais.contaCreditoId,
      valor: eventosPatrimoniais.valor,
    }).from(eventosPatrimoniais)
      .innerJoin(periodosContabeis, eq(eventosPatrimoniais.periodoId, periodosContabeis.id))
      .where(and(
        eq(eventosPatrimoniais.ugId, ugId),
        sql`(${periodosContabeis.ano} < ${periodo.ano} OR (${periodosContabeis.ano} = ${periodo.ano} AND ${periodosContabeis.mes} < ${periodo.mes}))`,
      ));

    for (const ev of evAnt) {
      const contaD = contas.find((c) => c.id === ev.contaDebitoId);
      const contaC = contas.find((c) => c.id === ev.contaCreditoId);
      const valor = parseFloat(String(ev.valor));
      const sD = saldosAnteriores.get(ev.contaDebitoId) ?? 0;
      saldosAnteriores.set(ev.contaDebitoId, contaD?.natureza === "devedora" ? sD + valor : sD - valor);
      const sC = saldosAnteriores.get(ev.contaCreditoId) ?? 0;
      saldosAnteriores.set(ev.contaCreditoId, contaC?.natureza === "credora" ? sC + valor : sC - valor);
    }
  }

  const linhas: LinhaBalancete[] = [];
  for (const conta of contas) {
    const movs = movMap.get(conta.id) ?? { debito: 0, credito: 0 };
    const saldoAnterior = saldosAnteriores.get(conta.id) ?? 0;
    if (saldoAnterior === 0 && movs.debito === 0 && movs.credito === 0) continue;
    const saldoAtual = conta.natureza === "devedora"
      ? saldoAnterior + movs.debito - movs.credito
      : saldoAnterior + movs.credito - movs.debito;
    linhas.push({
      codigoConta: conta.codigo,
      nomeConta: conta.nome,
      natureza: conta.natureza,
      saldoAnterior,
      movimentoDebito: movs.debito,
      movimentoCredito: movs.credito,
      saldoAtual,
    });
  }
  return linhas.sort((a, b) => a.codigoConta.localeCompare(b.codigoConta));
}

/** Monta linhas de subsídios DCASP agrupando eventos por tipo */
async function montarLinhasDcasp(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  ugId: number,
  periodoId: number,
): Promise<LinhaDcasp[]> {
  const grupos = await db.select({
    tipo: eventosPatrimoniais.tipo,
    total: sql<string>`SUM(${eventosPatrimoniais.valor})`,
  }).from(eventosPatrimoniais)
    .where(and(eq(eventosPatrimoniais.ugId, ugId), eq(eventosPatrimoniais.periodoId, periodoId)))
    .groupBy(eventosPatrimoniais.tipo);

  const mapaDescricao: Record<string, string> = {
    incorporacao: "Variações Patrimoniais Aumentativas — Incorporação de Bens",
    baixa: "Variações Patrimoniais Diminutivas — Baixa de Bens",
    reavaliacao: "Ajuste de Avaliação Patrimonial — Reavaliação",
    depreciacao: "Variações Patrimoniais Diminutivas — Depreciação/Amortização",
    cessao: "Variações Patrimoniais — Cessão de Uso",
    transferencia: "Variações Patrimoniais — Transferência entre UGs",
  };

  return grupos.map((g) => ({
    grupoDcasp: g.tipo.toUpperCase(),
    descricao: mapaDescricao[g.tipo] ?? g.tipo,
    valorPeriodo: parseFloat(g.total ?? "0"),
    variacaoPerc: null, // variação percentual requer período anterior — calculada na implantação
  }));
}

/** Monta linhas de reavaliação a partir dos eventos do tipo reavaliacao */
async function montarLinhasReavaliacao(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  ugId: number,
  periodoId: number,
): Promise<LinhaReavaliacao[]> {
  const eventos = await db.select({
    id: eventosPatrimoniais.id,
    bemMovelId: eventosPatrimoniais.bemMovelId,
    valor: eventosPatrimoniais.valor,
    historico: eventosPatrimoniais.historico,
    createdAt: eventosPatrimoniais.createdAt,
  }).from(eventosPatrimoniais)
    .where(and(
      eq(eventosPatrimoniais.ugId, ugId),
      eq(eventosPatrimoniais.periodoId, periodoId),
      eq(eventosPatrimoniais.tipo, "reavaliacao"),
    ));

  const linhas: LinhaReavaliacao[] = [];
  for (const ev of eventos) {
    if (!ev.bemMovelId) continue;
    const [bem] = await db.select({
      numeroTombamento: bensMoveisTable.numeroTombamento,
      descricao: bensMoveisTable.descricao,
      valorAtual: bensMoveisTable.valorAtual,
      classeNome: classesBens.nome,
    }).from(bensMoveisTable)
      .leftJoin(classesBens, eq(bensMoveisTable.classeId, classesBens.id))
      .where(eq(bensMoveisTable.id, ev.bemMovelId)).limit(1);
    if (!bem) continue;
    const variacao = parseFloat(String(ev.valor));
    const valorNovo = parseFloat(String(bem.valorAtual ?? "0"));
    linhas.push({
      numeroTombamento: bem.numeroTombamento,
      descricao: bem.descricao,
      classeNome: bem.classeNome ?? "",
      valorAnterior: valorNovo - variacao,
      valorNovo,
      variacao,
      dataEvento: ev.createdAt.toISOString().split("T")[0],
      historico: ev.historico,
    });
  }
  return linhas;
}

/** Monta linhas do inventário físico-financeiro */
async function montarLinhasInventario(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  ugId: number,
): Promise<LinhaInventarioFisicoFinanceiro[]> {
  const bens = await db.select({
    id: bensMoveisTable.id,
    numeroTombamento: bensMoveisTable.numeroTombamento,
    descricao: bensMoveisTable.descricao,
    situacao: bensMoveisTable.situacao,
    valorAquisicao: bensMoveisTable.valorAquisicao,
    valorAtual: bensMoveisTable.valorAtual,
    localizacaoUaId: bensMoveisTable.localizacaoUaId,
    classeNome: classesBens.nome,
  }).from(bensMoveisTable)
    .leftJoin(classesBens, eq(bensMoveisTable.classeId, classesBens.id))
    .where(eq(bensMoveisTable.ugId, ugId))
    .orderBy(bensMoveisTable.numeroTombamento);

  const linhas: LinhaInventarioFisicoFinanceiro[] = [];
  for (const bem of bens) {
    // Calcular depreciação acumulada
    const [depAcum] = await db.select({
      total: sql<string>`SUM(${depreciacaoMensal.valorDepreciado})`,
    }).from(depreciacaoMensal).where(eq(depreciacaoMensal.bemId, bem.id));

    // Obter nome da UA de localização
    let localizacao = "Sem localização";
    if (bem.localizacaoUaId) {
      const [ua] = await db.select({ nome: unidadesAdministrativas.nome })
        .from(unidadesAdministrativas)
        .where(eq(unidadesAdministrativas.id, bem.localizacaoUaId)).limit(1);
      if (ua) localizacao = ua.nome;
    }

    linhas.push({
      numeroTombamento: bem.numeroTombamento,
      descricao: bem.descricao,
      classeNome: bem.classeNome ?? "",
      localizacao,
      situacao: bem.situacao,
      valorAquisicao: parseFloat(String(bem.valorAquisicao)),
      valorAtual: parseFloat(String(bem.valorAtual ?? bem.valorAquisicao)),
      totalDepreciado: parseFloat(depAcum?.total ?? "0"),
    });
  }
  return linhas;
}

export const relatoriosContabeisRouter = router({
  /** Exporta o balancete de verificação em PDF, CSV ou XLSX */
  balancete: router({
    pdf: protectedProcedure.input(periodoInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasBalancete(db, input.ugId, input.periodoId);
      const buf = await gerarBalancetePdf(linhas, ugNome, competencia);
      return { base64: buf.toString("base64"), filename: `Balancete_${input.ugId}_${competencia}.pdf`, mimeType: "application/pdf" };
    }),
    csv: protectedProcedure.input(periodoInput).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasBalancete(db, input.ugId, input.periodoId);
      return { csv: gerarBalanceteCsv(linhas, ugNome, competencia), filename: `Balancete_${input.ugId}_${competencia}.csv` };
    }),
    xlsx: protectedProcedure.input(periodoInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasBalancete(db, input.ugId, input.periodoId);
      const buf = gerarBalanceteXlsx(linhas, ugNome, competencia);
      return { base64: buf.toString("base64"), filename: `Balancete_${input.ugId}_${competencia}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }),
  }),

  /** Exporta os subsídios às DCASP em PDF, CSV ou XLSX */
  dcasp: router({
    pdf: protectedProcedure.input(periodoInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasDcasp(db, input.ugId, input.periodoId);
      const buf = await gerarDcaspPdf(linhas, ugNome, competencia);
      return { base64: buf.toString("base64"), filename: `DCASP_${input.ugId}_${competencia}.pdf`, mimeType: "application/pdf" };
    }),
    csv: protectedProcedure.input(periodoInput).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasDcasp(db, input.ugId, input.periodoId);
      return { csv: gerarDcaspCsv(linhas, ugNome, competencia), filename: `DCASP_${input.ugId}_${competencia}.csv` };
    }),
    xlsx: protectedProcedure.input(periodoInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasDcasp(db, input.ugId, input.periodoId);
      const buf = gerarDcaspXlsx(linhas, ugNome, competencia);
      return { base64: buf.toString("base64"), filename: `DCASP_${input.ugId}_${competencia}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }),
  }),

  /** Exporta o relatório de reavaliação e redução ao valor recuperável */
  reavaliacao: router({
    pdf: protectedProcedure.input(periodoInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasReavaliacao(db, input.ugId, input.periodoId);
      const buf = await gerarReavaliacaoPdf(linhas, ugNome, competencia);
      return { base64: buf.toString("base64"), filename: `Reavaliacao_${input.ugId}_${competencia}.pdf`, mimeType: "application/pdf" };
    }),
    csv: protectedProcedure.input(periodoInput).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasReavaliacao(db, input.ugId, input.periodoId);
      return { csv: gerarReavaliacaoCsv(linhas, ugNome, competencia), filename: `Reavaliacao_${input.ugId}_${competencia}.csv` };
    }),
    xlsx: protectedProcedure.input(periodoInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const [periodo] = await db.select().from(periodosContabeis).where(eq(periodosContabeis.id, input.periodoId)).limit(1);
      const competencia = periodo ? `${periodo.ano}-${String(periodo.mes).padStart(2, "0")}` : String(input.periodoId);
      const linhas = await montarLinhasReavaliacao(db, input.ugId, input.periodoId);
      const buf = gerarReavaliacaoXlsx(linhas, ugNome, competencia);
      return { base64: buf.toString("base64"), filename: `Reavaliacao_${input.ugId}_${competencia}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }),
  }),

  /** Exporta o inventário físico-financeiro */
  inventarioFisicoFinanceiro: router({
    pdf: protectedProcedure.input(z.object({ ugId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const dataRef = new Date().toLocaleDateString("pt-BR");
      const linhas = await montarLinhasInventario(db, input.ugId);
      const buf = await gerarInventarioFisicoFinanceiroPdf(linhas, ugNome, dataRef);
      return { base64: buf.toString("base64"), filename: `Inventario_Fisico_Financeiro_${input.ugId}_${new Date().toISOString().split("T")[0]}.pdf`, mimeType: "application/pdf" };
    }),
    csv: protectedProcedure.input(z.object({ ugId: z.number().int().positive() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const dataRef = new Date().toLocaleDateString("pt-BR");
      const linhas = await montarLinhasInventario(db, input.ugId);
      return { csv: gerarInventarioFisicoFinanceiroCsv(linhas, ugNome, dataRef), filename: `Inventario_Fisico_Financeiro_${input.ugId}.csv` };
    }),
    xlsx: protectedProcedure.input(z.object({ ugId: z.number().int().positive() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const ugNome = await getUgNome(db, input.ugId);
      const dataRef = new Date().toLocaleDateString("pt-BR");
      const linhas = await montarLinhasInventario(db, input.ugId);
      const buf = gerarInventarioFisicoFinanceiroXlsx(linhas, ugNome, dataRef);
      return { base64: buf.toString("base64"), filename: `Inventario_Fisico_Financeiro_${input.ugId}.xlsx`, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }),
  }),

  /** MSC/SICONFI — re-exportado aqui para acesso unificado */
  msc: mscRouter,
});
