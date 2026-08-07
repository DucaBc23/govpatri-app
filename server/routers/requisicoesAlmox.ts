import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { requisicoesAlmox, requisicoesItens, almoxItens, estoque } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const requisicoesAlmoxRouter = router({
  list: protectedProcedure
    .input(z.object({ ugId: z.number().optional(), situacao: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = [];
      if (input.ugId) conds.push(eq(requisicoesAlmox.ugId, input.ugId));
      if (input.situacao) conds.push(eq(requisicoesAlmox.situacao, input.situacao as "rascunho" | "enviada" | "aprovada" | "atendida" | "cancelada"));
      return db.select({
        id: requisicoesAlmox.id,
        numero: requisicoesAlmox.numero,
        ugId: requisicoesAlmox.ugId,
        solicitanteId: requisicoesAlmox.solicitanteId,
        situacao: requisicoesAlmox.situacao,
        justificativa: requisicoesAlmox.justificativa,
        dataRequisicao: requisicoesAlmox.dataRequisicao,
        createdAt: requisicoesAlmox.createdAt,
        totalItens: sql<number>`(SELECT COUNT(*) FROM requisicoes_itens WHERE requisicaoId = ${requisicoesAlmox.id})`,
      })
        .from(requisicoesAlmox)
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(requisicoesAlmox.createdAt));
    }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const [req] = await db.select().from(requisicoesAlmox).where(eq(requisicoesAlmox.id, input.id)).limit(1);
    if (!req) return null;
    const itens = await db.select({
      id: requisicoesItens.id,
      itemId: requisicoesItens.itemId,
      quantidadeSolicitada: requisicoesItens.quantidadeSolicitada,
      quantidadeAtendida: requisicoesItens.quantidadeAtendida,
      itemNome: almoxItens.nome,
      itemCodigo: almoxItens.codigo,
      itemUnidade: almoxItens.unidadeMedida,
    }).from(requisicoesItens)
      .leftJoin(almoxItens, eq(requisicoesItens.itemId, almoxItens.id))
      .where(eq(requisicoesItens.requisicaoId, input.id));
    return { ...req, itens };
  }),

  create: protectedProcedure
    .input(z.object({
      ugId: z.number(),
      justificativa: z.string().optional(),
      itens: z.array(z.object({ itemId: z.number(), quantidadeSolicitada: z.number().min(1) })).min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [count] = await db.select({ total: sql<number>`COUNT(*)` }).from(requisicoesAlmox);
      const numero = `REQ-${input.ugId.toString().padStart(3, "0")}-${String((count?.total ?? 0) + 1).padStart(6, "0")}`;
      const [r] = await db.insert(requisicoesAlmox).values({
        numero,
        ugId: input.ugId,
        solicitanteId: ctx.user.id,
        justificativa: input.justificativa,
        dataRequisicao: new Date(),
      });
      for (const item of input.itens) {
        await db.insert(requisicoesItens).values({
          requisicaoId: r.insertId,
          itemId: item.itemId,
          quantidadeSolicitada: String(item.quantidadeSolicitada),
        });
      }
      await registrarAuditoria({
        userId: ctx.user.id, acao: "CREATE", entidade: "requisicoes_almox",
        entidadeId: r.insertId, dadosDepois: { numero, ugId: input.ugId },
      });
      return { id: r.insertId, numero };
    }),

  aprovar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(requisicoesAlmox).set({ situacao: "aprovada" }).where(eq(requisicoesAlmox.id, input.id));
      await registrarAuditoria({
        userId: ctx.user.id, acao: "UPDATE", entidade: "requisicoes_almox",
        entidadeId: input.id, dadosDepois: { situacao: "aprovada" },
      });
      return { success: true };
    }),

  atender: protectedProcedure
    .input(z.object({
      id: z.number(),
      depositoId: z.number(),
      itens: z.array(z.object({ requisicaoItemId: z.number(), itemId: z.number(), quantidadeAtendida: z.number() })),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      for (const item of input.itens) {
        await db.update(requisicoesItens)
          .set({ quantidadeAtendida: String(item.quantidadeAtendida) })
          .where(eq(requisicoesItens.id, item.requisicaoItemId));
        const [estoqueItem] = await db.select().from(estoque)
          .where(and(eq(estoque.depositoId, input.depositoId), eq(estoque.itemId, item.itemId))).limit(1);
        if (estoqueItem) {
          const qtdAtual = parseFloat(String(estoqueItem.quantidade ?? "0"));
          const novaQtd = Math.max(0, qtdAtual - item.quantidadeAtendida);
          await db.update(estoque).set({ quantidade: String(novaQtd) }).where(eq(estoque.id, estoqueItem.id));
        }
      }
      await db.update(requisicoesAlmox).set({ situacao: "atendida", dataAtendimento: new Date() }).where(eq(requisicoesAlmox.id, input.id));
      await registrarAuditoria({
        userId: ctx.user.id, acao: "UPDATE", entidade: "requisicoes_almox",
        entidadeId: input.id, dadosDepois: { situacao: "atendida" },
      });
      return { success: true };
    }),

  cancelar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(requisicoesAlmox).set({ situacao: "cancelada" }).where(eq(requisicoesAlmox.id, input.id));
      await registrarAuditoria({
        userId: ctx.user.id, acao: "UPDATE", entidade: "requisicoes_almox",
        entidadeId: input.id, dadosDepois: { situacao: "cancelada" },
      });
      return { success: true };
    }),
});
