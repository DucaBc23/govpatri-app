import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { manutencoes, bensMoveisTable } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const manutencoesRouter = router({
  list: protectedProcedure
    .input(z.object({ bemId: z.number().optional(), situacao: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = [];
      if (input.bemId) conds.push(eq(manutencoes.bemId, input.bemId));
      if (input.situacao) conds.push(eq(manutencoes.situacao, input.situacao as "aberta" | "em_andamento" | "concluida"));
      return db.select({
        id: manutencoes.id,
        bemId: manutencoes.bemId,
        tipo: manutencoes.tipo,
        descricao: manutencoes.descricao,
        dataInicio: manutencoes.dataInicio,
        dataConclusao: manutencoes.dataConclusao,
        custo: manutencoes.custo,
        fornecedor: manutencoes.fornecedor,
        situacao: manutencoes.situacao,
        createdAt: manutencoes.createdAt,
        bemDescricao: bensMoveisTable.descricao,
        bemTombamento: bensMoveisTable.numeroTombamento,
      })
        .from(manutencoes)
        .leftJoin(bensMoveisTable, eq(manutencoes.bemId, bensMoveisTable.id))
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(manutencoes.createdAt));
    }),

  create: protectedProcedure
    .input(z.object({
      bemId: z.number(),
      tipo: z.enum(["preventiva", "corretiva"]),
      descricao: z.string().min(1),
      dataInicio: z.string(),
      dataConclusao: z.string().optional(),
      custo: z.string().optional(),
      fornecedor: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      // Atualizar situação do bem para em_manutencao
      await db.update(bensMoveisTable).set({ situacao: "em_manutencao" }).where(eq(bensMoveisTable.id, input.bemId));
      const [r] = await db.insert(manutencoes).values({
        bemId: input.bemId,
        tipo: input.tipo,
        descricao: input.descricao,
        dataInicio: new Date(input.dataInicio),
        dataConclusao: input.dataConclusao ? new Date(input.dataConclusao) : undefined,
        custo: input.custo,
        fornecedor: input.fornecedor,
        createdByUserId: ctx.user.id,
      });
      await registrarAuditoria({
        userId: ctx.user.id, acao: "CREATE", entidade: "manutencoes",
        entidadeId: r.insertId, dadosDepois: input,
      });
      return { id: r.insertId };
    }),

  concluir: protectedProcedure
    .input(z.object({
      id: z.number(),
      dataConclusao: z.string(),
      custo: z.string().optional(),
      observacoes: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [man] = await db.select().from(manutencoes).where(eq(manutencoes.id, input.id)).limit(1);
      if (!man) throw new Error("Manutenção não encontrada");
      await db.update(manutencoes).set({
        situacao: "concluida",
        dataConclusao: new Date(input.dataConclusao),
        custo: input.custo ?? man.custo,
      }).where(eq(manutencoes.id, input.id));
      // Reativar bem
      await db.update(bensMoveisTable).set({ situacao: "ativo" }).where(eq(bensMoveisTable.id, man.bemId));
      await registrarAuditoria({
        userId: ctx.user.id, acao: "UPDATE", entidade: "manutencoes",
        entidadeId: input.id, dadosDepois: { situacao: "concluida", ...input },
      });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      situacao: z.enum(["aberta", "em_andamento", "concluida"]).optional(),
      fornecedor: z.string().optional(),
      custo: z.string().optional(),
      dataConclusao: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const { id, ...data } = input;
      await db.update(manutencoes).set({
        ...data,
        dataConclusao: data.dataConclusao ? new Date(data.dataConclusao) : undefined,
      }).where(eq(manutencoes.id, id));
      await registrarAuditoria({
        userId: ctx.user.id, acao: "UPDATE", entidade: "manutencoes",
        entidadeId: id, dadosDepois: data,
      });
      return { success: true };
    }),
});
