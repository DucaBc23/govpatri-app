import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bensMoveisTable, movimentacoesBens, depreciacaoMensal, eventosPatrimoniais, cessoesImoveis, classesBens, unidadesGestoras } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import {
  gerarRelMovimentacaoPatrimonial,
  gerarRelInventarioFisicoFinanceiro,
  gerarRelDepreciacao,
  gerarRelConciliacao,
  gerarRelCessoes,
} from "../pdfRelatorios";

const ORGAO = "Governo do Estado do Maranhão";
const UG_DEFAULT = "Todas as Unidades Gestoras";

const periodoInput = z.object({ ugId: z.number().optional(), dataInicio: z.string().optional(), dataFim: z.string().optional() });

async function getUgNome(db: Awaited<ReturnType<typeof getDb>>, ugId?: number): Promise<string> {
  if (!db || !ugId) return UG_DEFAULT;
  const [ug] = await db.select().from(unidadesGestoras).where(eq(unidadesGestoras.id, ugId)).limit(1);
  return ug?.nome ?? UG_DEFAULT;
}

export const relatoriosRouter = router({
  // ── Queries (dados para visualização) ────────────────────────────────────
  movimentacaoPatrimonial: protectedProcedure.input(periodoInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    // Filtrar por UG de origem ou destino do bem
    if (input.ugId) {
      return db.select().from(movimentacoesBens)
        .where(eq(movimentacoesBens.ugOrigemId, input.ugId))
        .orderBy(desc(movimentacoesBens.createdAt)).limit(500);
    }
    return db.select().from(movimentacoesBens).orderBy(desc(movimentacoesBens.createdAt)).limit(500);
  }),

  inventarioFisicoFinanceiro: protectedProcedure.input(z.object({ ugId: z.number().optional() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const conds = [eq(bensMoveisTable.situacao, "ativo")];
    if (input.ugId) conds.push(eq(bensMoveisTable.ugId, input.ugId));
    return db.select({
      id: bensMoveisTable.id, numeroTombamento: bensMoveisTable.numeroTombamento,
      descricao: bensMoveisTable.descricao, valorAquisicao: bensMoveisTable.valorAquisicao,
      valorAtual: bensMoveisTable.valorAtual, situacao: bensMoveisTable.situacao,
      classeNome: classesBens.nome,
    }).from(bensMoveisTable).leftJoin(classesBens, eq(bensMoveisTable.classeId, classesBens.id)).where(and(...conds)).orderBy(bensMoveisTable.numeroTombamento);
  }),

  depreciacao: protectedProcedure.input(z.object({ ugId: z.number(), periodoId: z.number().optional() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const conds = [eq(depreciacaoMensal.ugId, input.ugId)];
    if (input.periodoId) conds.push(eq(depreciacaoMensal.periodoId, input.periodoId));
    return db.select().from(depreciacaoMensal).where(and(...conds)).orderBy(desc(depreciacaoMensal.createdAt));
  }),

  conciliacao: protectedProcedure.input(z.object({ ugId: z.number(), periodoId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { eventos: [], totalDebito: "0", totalCredito: "0" };
    const eventos = await db.select().from(eventosPatrimoniais).where(and(eq(eventosPatrimoniais.ugId, input.ugId), eq(eventosPatrimoniais.periodoId, input.periodoId)));
    const totalDebito = eventos.reduce((acc, e) => acc + parseFloat(String(e.valor)), 0);
    return { eventos, totalDebito: String(totalDebito), totalCredito: String(totalDebito) };
  }),

  cessoes: protectedProcedure.input(periodoInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(cessoesImoveis).orderBy(desc(cessoesImoveis.createdAt)).limit(500);
  }),

  // ── Mutations (geração de PDF) ────────────────────────────────────────────
  pdfMovimentacao: protectedProcedure
    .input(z.object({ ugId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const movs = input.ugId
        ? await db.select().from(movimentacoesBens).where(eq(movimentacoesBens.ugOrigemId, input.ugId)).orderBy(desc(movimentacoesBens.createdAt)).limit(500)
        : await db.select().from(movimentacoesBens).orderBy(desc(movimentacoesBens.createdAt)).limit(500);
      const ugNome = await getUgNome(db, input.ugId);
      const buf = await gerarRelMovimentacaoPatrimonial(movs, ORGAO, ugNome);
      return { pdfBase64: buf.toString("base64"), filename: `Movimentacao_Patrimonial_${new Date().toISOString().split("T")[0]}.pdf` };
    }),

  pdfInventario: protectedProcedure
    .input(z.object({ ugId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const conds = [eq(bensMoveisTable.situacao, "ativo")];
      if (input.ugId) conds.push(eq(bensMoveisTable.ugId, input.ugId));
      const bens = await db.select({
        numeroTombamento: bensMoveisTable.numeroTombamento,
        descricao: bensMoveisTable.descricao,
        valorAquisicao: bensMoveisTable.valorAquisicao,
        valorAtual: bensMoveisTable.valorAtual,
        situacao: bensMoveisTable.situacao,
        classeNome: classesBens.nome,
      }).from(bensMoveisTable)
        .leftJoin(classesBens, eq(bensMoveisTable.classeId, classesBens.id))
        .where(and(...conds)).orderBy(bensMoveisTable.numeroTombamento);
      const ugNome = await getUgNome(db, input.ugId);
      const buf = await gerarRelInventarioFisicoFinanceiro(bens, ORGAO, ugNome);
      return { pdfBase64: buf.toString("base64"), filename: `Inventario_Fisico_Financeiro_${new Date().toISOString().split("T")[0]}.pdf` };
    }),

  pdfDepreciacao: protectedProcedure
    .input(z.object({ ugId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const deps = await db.select().from(depreciacaoMensal).where(eq(depreciacaoMensal.ugId, input.ugId)).orderBy(desc(depreciacaoMensal.createdAt));
      const ugNome = await getUgNome(db, input.ugId);
      const buf = await gerarRelDepreciacao(deps, ORGAO, ugNome);
      return { pdfBase64: buf.toString("base64"), filename: `Depreciacao_${input.ugId}_${new Date().toISOString().split("T")[0]}.pdf` };
    }),

  pdfConciliacao: protectedProcedure
    .input(z.object({ ugId: z.number(), periodoId: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const eventos = await db.select().from(eventosPatrimoniais).where(and(eq(eventosPatrimoniais.ugId, input.ugId), eq(eventosPatrimoniais.periodoId, input.periodoId)));
      const totalDebito = eventos.reduce((acc, e) => acc + parseFloat(String(e.valor)), 0);
      const ugNome = await getUgNome(db, input.ugId);
      const buf = await gerarRelConciliacao(eventos, String(totalDebito), ORGAO, ugNome);
      return { pdfBase64: buf.toString("base64"), filename: `Conciliacao_${input.ugId}_P${input.periodoId}.pdf` };
    }),

  pdfCessoes: protectedProcedure
    .input(z.object({ ugId: z.number().optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const cessoes = await db.select().from(cessoesImoveis).orderBy(desc(cessoesImoveis.createdAt));
      const ugNome = await getUgNome(db, input.ugId);
      const buf = await gerarRelCessoes(cessoes, ORGAO, ugNome);
      return { pdfBase64: buf.toString("base64"), filename: `Cessoes_Imoveis_${new Date().toISOString().split("T")[0]}.pdf` };
    }),
});
