import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bensMoveisTable, movimentacoesBens, depreciacaoMensal, eventosPatrimoniais, cessoesImoveis, classesBens, unidadesGestoras } from "../../drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

const periodoInput = z.object({ ugId: z.number().optional(), dataInicio: z.string().optional(), dataFim: z.string().optional() });

export const relatoriosRouter = router({
  movimentacaoPatrimonial: protectedProcedure.input(periodoInput).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const conds = [];
    if (input.ugId) conds.push(eq(movimentacoesBens.createdByUserId, input.ugId));
    return db.select().from(movimentacoesBens).where(conds.length > 0 ? and(...conds) : undefined).orderBy(desc(movimentacoesBens.createdAt)).limit(500);
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
});

