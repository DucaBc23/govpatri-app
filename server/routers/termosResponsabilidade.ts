import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { termosResponsabilidade, termosItens, bensMoveisTable, govpatriUsers, users } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const termosResponsabilidadeRouter = router({
  list: protectedProcedure
    .input(z.object({ ugId: z.number().optional(), situacao: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = [];
      if (input.ugId) conds.push(eq(termosResponsabilidade.ugId, input.ugId));
      if (input.situacao) conds.push(eq(termosResponsabilidade.situacao, input.situacao as "ativo" | "encerrado" | "substituido"));
      return db.select({
        id: termosResponsabilidade.id,
        numero: termosResponsabilidade.numero,
        ugId: termosResponsabilidade.ugId,
        responsavelId: termosResponsabilidade.responsavelId,
        dataEmissao: termosResponsabilidade.dataEmissao,
        dataVencimento: termosResponsabilidade.dataVencimento,
        situacao: termosResponsabilidade.situacao,
        observacoes: termosResponsabilidade.observacoes,
        createdAt: termosResponsabilidade.createdAt,
        responsavelNome: users.name,
        totalBens: sql<number>`(SELECT COUNT(*) FROM termos_itens WHERE termoId = ${termosResponsabilidade.id})`,
      })
        .from(termosResponsabilidade)
        .leftJoin(govpatriUsers, eq(termosResponsabilidade.responsavelId, govpatriUsers.id))
        .leftJoin(users, eq(govpatriUsers.userId, users.id))
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(termosResponsabilidade.createdAt));
    }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [termo] = await db.select().from(termosResponsabilidade).where(eq(termosResponsabilidade.id, input.id)).limit(1);
    if (!termo) return null;
    const itens = await db.select({
      id: termosItens.id,
      bemId: termosItens.bemId,
      tombamento: bensMoveisTable.numeroTombamento,
      descricao: bensMoveisTable.descricao,
      valorAtual: bensMoveisTable.valorAtual,
    }).from(termosItens)
      .leftJoin(bensMoveisTable, eq(termosItens.bemId, bensMoveisTable.id))
      .where(eq(termosItens.termoId, input.id));
    return { ...termo, itens };
  }),

  create: protectedProcedure
    .input(z.object({
      ugId: z.number(),
      responsavelId: z.number(),
      dataEmissao: z.string(),
      dataVencimento: z.string().optional(),
      observacoes: z.string().optional(),
      bemIds: z.array(z.number()).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      // Gerar número sequencial
      const [count] = await db.select({ total: sql<number>`COUNT(*)` }).from(termosResponsabilidade);
      const numero = `TR-${input.ugId.toString().padStart(3, "0")}-${String((count?.total ?? 0) + 1).padStart(6, "0")}`;
      const [r] = await db.insert(termosResponsabilidade).values({
        numero,
        ugId: input.ugId,
        responsavelId: input.responsavelId,
        dataEmissao: new Date(input.dataEmissao),
        dataVencimento: input.dataVencimento ? new Date(input.dataVencimento) : undefined,
        observacoes: input.observacoes,
        createdByUserId: ctx.user.id,
      });
      // Vincular bens ao termo
      for (const bemId of input.bemIds) {
        await db.insert(termosItens).values({ termoId: r.insertId, bemId });
        // Atualizar responsável no bem
        await db.update(bensMoveisTable).set({ responsavelId: input.responsavelId }).where(eq(bensMoveisTable.id, bemId));
      }
      await registrarAuditoria({
        userId: ctx.user.id, acao: "CREATE", entidade: "termos_responsabilidade",
        entidadeId: r.insertId, dadosDepois: { numero, ...input },
      });
      return { id: r.insertId, numero };
    }),

  encerrar: protectedProcedure
    .input(z.object({ id: z.number(), observacoes: z.string().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(termosResponsabilidade).set({ situacao: "encerrado", observacoes: input.observacoes }).where(eq(termosResponsabilidade.id, input.id));
      await registrarAuditoria({
        userId: ctx.user.id, acao: "UPDATE", entidade: "termos_responsabilidade",
        entidadeId: input.id, dadosDepois: { situacao: "encerrado" },
      });
      return { success: true };
    }),
});
