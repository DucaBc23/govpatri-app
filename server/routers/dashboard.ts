import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bensMoveisTable, bensImoveis, auditLogs, cessoesImoveis, pendenciasImoveis } from "../../drizzle/schema";
import { eq, and, sql, desc, gte } from "drizzle-orm";

export const dashboardRouter = router({
  kpis: protectedProcedure.input(z.object({ ugId: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { totalBensMoveis: 0, totalBensImoveis: 0, valorPatrimonial: "0", bensAtivos: 0, bensBaixados: 0, cessoesPendentes: 0 };

    const ugCond = input?.ugId;
    const [bmAtivos] = await (ugCond
      ? db.select({ count: sql<number>`COUNT(*)`, valor: sql<string>`COALESCE(SUM(valorAtual), 0)` }).from(bensMoveisTable).where(and(eq(bensMoveisTable.ugId, ugCond), eq(bensMoveisTable.situacao, "ativo")))
      : db.select({ count: sql<number>`COUNT(*)`, valor: sql<string>`COALESCE(SUM(valorAtual), 0)` }).from(bensMoveisTable).where(eq(bensMoveisTable.situacao, "ativo")));
    const [bmBaixados] = await (ugCond
      ? db.select({ count: sql<number>`COUNT(*)` }).from(bensMoveisTable).where(and(eq(bensMoveisTable.ugId, ugCond), eq(bensMoveisTable.situacao, "baixado")))
      : db.select({ count: sql<number>`COUNT(*)` }).from(bensMoveisTable).where(eq(bensMoveisTable.situacao, "baixado")));
    const [bi] = await (ugCond
      ? db.select({ count: sql<number>`COUNT(*)` }).from(bensImoveis).where(eq(bensImoveis.ugId, ugCond))
      : db.select({ count: sql<number>`COUNT(*)` }).from(bensImoveis));
    const [cessoes] = await db.select({ count: sql<number>`COUNT(*)` }).from(cessoesImoveis).where(eq(cessoesImoveis.situacao, "vigente"));

    return {
      totalBensMoveis: bmAtivos?.count ?? 0,
      totalBensImoveis: bi?.count ?? 0,
      valorPatrimonial: bmAtivos?.valor ?? "0",
      bensAtivos: bmAtivos?.count ?? 0,
      bensBaixados: bmBaixados?.count ?? 0,
      cessoesPendentes: cessoes?.count ?? 0,
    };
  }),

  isp: protectedProcedure.input(z.object({ ugId: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return { isp: 0, detalhes: {} };
    // ISP = média ponderada de 4 indicadores (0-100 cada)
    // 1. Completude cadastral (bens com descrição, classe, localização)
    const [total] = await db.select({ count: sql<number>`COUNT(*)` }).from(bensMoveisTable).where(and(eq(bensMoveisTable.ugId, input.ugId), eq(bensMoveisTable.situacao, "ativo")));
    const [completos] = await db.select({ count: sql<number>`COUNT(*)` }).from(bensMoveisTable).where(and(eq(bensMoveisTable.ugId, input.ugId), eq(bensMoveisTable.situacao, "ativo"), sql`localizacaoUaId IS NOT NULL`));
    const completude = total?.count ? Math.round(((completos?.count ?? 0) / total.count) * 100) : 100;
    // 2. Pendências imóveis (sem pendências abertas = 100)
    const [pendencias] = await db.select({ count: sql<number>`COUNT(*)` }).from(pendenciasImoveis).where(eq(pendenciasImoveis.situacao, "aberta"));
    const regularidade = pendencias?.count === 0 ? 100 : Math.max(0, 100 - (pendencias?.count ?? 0) * 10);
    // ISP final (média simples dos indicadores disponíveis)
    const isp = Math.round((completude + regularidade) / 2);
    return { isp, detalhes: { completude, regularidade, totalBens: total?.count ?? 0 } };
  }),

  alertas: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    const alertas: { tipo: string; mensagem: string; severidade: "alta" | "media" | "baixa" }[] = [];
    // Cessões vencidas
    const hoje = new Date().toISOString().split("T")[0]!;
    const [cessVencidas] = await db.select({ count: sql<number>`COUNT(*)` }).from(cessoesImoveis).where(and(eq(cessoesImoveis.situacao, "vigente"), sql`dataFim < ${hoje}`));
    if ((cessVencidas?.count ?? 0) > 0) alertas.push({ tipo: "cessao_vencida", mensagem: `${cessVencidas?.count} cessão(ões) de imóvel com prazo vencido`, severidade: "alta" });
    // Pendências de regularização abertas
    const [pend] = await db.select({ count: sql<number>`COUNT(*)` }).from(pendenciasImoveis).where(eq(pendenciasImoveis.situacao, "aberta"));
    if ((pend?.count ?? 0) > 0) alertas.push({ tipo: "pendencia_dominial", mensagem: `${pend?.count} pendência(s) de regularização dominial em aberto`, severidade: "media" });
    // 3. Bens sem localização
    const [semLocal] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(bensMoveisTable).where(and(eq(bensMoveisTable.situacao, "ativo"), sql`localizacaoUaId IS NULL`));
    if ((semLocal?.count ?? 0) > 0) alertas.push({ tipo: "sem_localizacao", mensagem: `${semLocal?.count} bem(ns) ativo(s) sem localização cadastrada`, severidade: "baixa" });
    // 4. Imóveis com situação dominial irregular
    const [imovIrreg] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(bensImoveis).where(eq(bensImoveis.situacaoDominial, "irregular"));
    if ((imovIrreg?.count ?? 0) > 0) alertas.push({ tipo: "imovel_irregular", mensagem: `${imovIrreg?.count} imóvel(is) com situação dominial irregular`, severidade: "alta" });
    // 5. Bens em manutenção há mais de 30 dias
    const [manLonga] = await db.select({ count: sql<number>`COUNT(*)` })
      .from(bensMoveisTable).where(and(eq(bensMoveisTable.situacao, "em_manutencao"), sql`updatedAt < DATE_SUB(NOW(), INTERVAL 30 DAY)`));
    if ((manLonga?.count ?? 0) > 0) alertas.push({ tipo: "manutencao_longa", mensagem: `${manLonga?.count} bem(ns) em manutenção há mais de 30 dias`, severidade: "media" });
    return alertas;
  }),

  auditoria: router({
    list: protectedProcedure.input(z.object({ entidade: z.string().optional(), limit: z.number().default(50) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input.entidade) return db.select().from(auditLogs).where(eq(auditLogs.entidade, input.entidade)).orderBy(desc(auditLogs.createdAt)).limit(input.limit);
      return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(input.limit);
    }),
  }),
});
