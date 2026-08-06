import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { workflowModelos, workflowInstancias, workflowDecisoes } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const workflowRouter = router({
  modelos: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(workflowModelos).where(eq(workflowModelos.isActive, true));
    }),
    create: protectedProcedure.input(z.object({
      nome: z.string().min(1).max(255),
      tipo: z.enum(["incorporacao", "baixa", "cessao", "desfazimento", "transferencia"]),
      etapas: z.array(z.object({ nome: z.string(), perfil: z.enum(["admin", "gestor", "operador", "auditor"]), ordem: z.number() })),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(workflowModelos).values({ ...input, etapas: input.etapas });
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "workflow_modelos", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  instancias: router({
    list: protectedProcedure.input(z.object({ ugId: z.number().optional(), situacao: z.string().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = [];
      if (input?.ugId) conds.push(eq(workflowInstancias.ugId, input.ugId));
      if (input?.situacao) conds.push(eq(workflowInstancias.situacao, input.situacao as "em_andamento"));
      if (conds.length > 0) return db.select().from(workflowInstancias).where(and(...conds)).orderBy(desc(workflowInstancias.createdAt));
      return db.select().from(workflowInstancias).orderBy(desc(workflowInstancias.createdAt));
    }),
    iniciar: protectedProcedure.input(z.object({
      modeloId: z.number(), ugId: z.number(), entidade: z.string(), entidadeId: z.number(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(workflowInstancias).values({ ...input, solicitanteId: ctx.user.id });
      await registrarAuditoria({ userId: ctx.user.id, acao: "INICIAR_WORKFLOW", entidade: input.entidade, entidadeId: input.entidadeId, dadosDepois: input });
      return { id: r.insertId };
    }),
    decidir: protectedProcedure.input(z.object({
      instanciaId: z.number(), decisao: z.enum(["aprovado", "rejeitado"]), justificativa: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [inst] = await db.select().from(workflowInstancias).where(eq(workflowInstancias.id, input.instanciaId)).limit(1);
      if (!inst) throw new Error("Instância não encontrada");
      await db.insert(workflowDecisoes).values({ instanciaId: input.instanciaId, etapa: inst.etapaAtual, decisao: input.decisao, aprovadorId: ctx.user.id, justificativa: input.justificativa });
      if (input.decisao === "rejeitado") {
        await db.update(workflowInstancias).set({ situacao: "rejeitado" }).where(eq(workflowInstancias.id, input.instanciaId));
      } else {
        const [modelo] = await db.select().from(workflowModelos).where(eq(workflowModelos.id, inst.modeloId)).limit(1);
        const etapas = (modelo?.etapas as { ordem: number }[]) ?? [];
        const proximaEtapa = inst.etapaAtual + 1;
        if (proximaEtapa >= etapas.length) {
          await db.update(workflowInstancias).set({ situacao: "aprovado", etapaAtual: proximaEtapa }).where(eq(workflowInstancias.id, input.instanciaId));
        } else {
          await db.update(workflowInstancias).set({ etapaAtual: proximaEtapa }).where(eq(workflowInstancias.id, input.instanciaId));
        }
      }
      await registrarAuditoria({ userId: ctx.user.id, acao: `WORKFLOW_${input.decisao.toUpperCase()}`, entidade: "workflow_instancias", entidadeId: input.instanciaId, dadosDepois: input });
      return { success: true };
    }),
  }),
});
