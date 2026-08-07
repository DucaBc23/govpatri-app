import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cessoesImoveis, bensImoveis, pendenciasImoveis, ocupacoesImoveis } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const cessoesImoveisRouter = router({
  list: protectedProcedure
    .input(z.object({ imovelId: z.number().optional(), situacao: z.string().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = [];
      if (input.imovelId) conds.push(eq(cessoesImoveis.imovelId, input.imovelId));
      if (input.situacao) conds.push(eq(cessoesImoveis.situacao, input.situacao as "vigente" | "encerrada" | "vencida"));
      return db.select({
        id: cessoesImoveis.id,
        imovelId: cessoesImoveis.imovelId,
        cessionario: cessoesImoveis.cessionario,
        finalidade: cessoesImoveis.finalidade,
        dataInicio: cessoesImoveis.dataInicio,
        dataFim: cessoesImoveis.dataFim,
        situacao: cessoesImoveis.situacao,
        documentoRef: cessoesImoveis.documentoRef,
        imovelDenominacao: bensImoveis.denominacao,
        imovelRip: bensImoveis.rip,
      })
        .from(cessoesImoveis)
        .leftJoin(bensImoveis, eq(cessoesImoveis.imovelId, bensImoveis.id))
        .where(conds.length > 0 ? and(...conds) : undefined)
        .orderBy(desc(cessoesImoveis.createdAt));
    }),

  create: protectedProcedure
    .input(z.object({
      imovelId: z.number(),
      cessionario: z.string().min(1),
      finalidade: z.string().optional(),
      dataInicio: z.string(),
      dataFim: z.string().optional(),
      documentoRef: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(cessoesImoveis).values({
        ...input,
        dataInicio: new Date(input.dataInicio),
        dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
      });
      await registrarAuditoria({
        userId: ctx.user.id, acao: "CREATE", entidade: "cessoes_imoveis",
        entidadeId: r.insertId, dadosDepois: input,
      });
      return { id: r.insertId };
    }),

  encerrar: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(cessoesImoveis).set({ situacao: "encerrada" }).where(eq(cessoesImoveis.id, input.id));
      await registrarAuditoria({
        userId: ctx.user.id, acao: "UPDATE", entidade: "cessoes_imoveis",
        entidadeId: input.id, dadosDepois: { situacao: "encerrada" },
      });
      return { success: true };
    }),

  pendencias: router({
    list: protectedProcedure
      .input(z.object({ imovelId: z.number().optional(), situacao: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conds = [];
        if (input.imovelId) conds.push(eq(pendenciasImoveis.imovelId, input.imovelId));
        if (input.situacao) conds.push(eq(pendenciasImoveis.situacao, input.situacao as "aberta" | "em_andamento" | "resolvida"));
        return db.select({
          id: pendenciasImoveis.id,
          imovelId: pendenciasImoveis.imovelId,
          tipo: pendenciasImoveis.tipo,
          descricao: pendenciasImoveis.descricao,
          prazo: pendenciasImoveis.prazo,
          situacao: pendenciasImoveis.situacao,
          imovelDenominacao: bensImoveis.denominacao,
        })
          .from(pendenciasImoveis)
          .leftJoin(bensImoveis, eq(pendenciasImoveis.imovelId, bensImoveis.id))
          .where(conds.length > 0 ? and(...conds) : undefined)
          .orderBy(desc(pendenciasImoveis.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        imovelId: z.number(),
        tipo: z.enum(["regularizacao_dominial", "averbacao", "demarcacao", "outros"]),
        descricao: z.string().min(1),
        prazo: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");
        const [r] = await db.insert(pendenciasImoveis).values({
          ...input,
          prazo: input.prazo ? new Date(input.prazo) : undefined,
        });
        await registrarAuditoria({
          userId: ctx.user.id, acao: "CREATE", entidade: "pendencias_imoveis",
          entidadeId: r.insertId, dadosDepois: input,
        });
        return { id: r.insertId };
      }),

    resolver: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");
        await db.update(pendenciasImoveis).set({ situacao: "resolvida" }).where(eq(pendenciasImoveis.id, input.id));
        await registrarAuditoria({
          userId: ctx.user.id, acao: "UPDATE", entidade: "pendencias_imoveis",
          entidadeId: input.id, dadosDepois: { situacao: "resolvida" },
        });
        return { success: true };
      }),
  }),

  ocupacoes: router({
    list: protectedProcedure
      .input(z.object({ imovelId: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const conds = input.imovelId ? [eq(ocupacoesImoveis.imovelId, input.imovelId)] : [];
        return db.select({
          id: ocupacoesImoveis.id,
          imovelId: ocupacoesImoveis.imovelId,
          ocupante: ocupacoesImoveis.ocupante,
          tipoOcupacao: ocupacoesImoveis.tipoOcupacao,
          dataInicio: ocupacoesImoveis.dataInicio,
          dataFim: ocupacoesImoveis.dataFim,
          areaOcupada: ocupacoesImoveis.areaOcupada,
          imovelDenominacao: bensImoveis.denominacao,
        })
          .from(ocupacoesImoveis)
          .leftJoin(bensImoveis, eq(ocupacoesImoveis.imovelId, bensImoveis.id))
          .where(conds.length > 0 ? and(...conds) : undefined)
          .orderBy(desc(ocupacoesImoveis.createdAt));
      }),

    create: protectedProcedure
      .input(z.object({
        imovelId: z.number(),
        ocupante: z.string().min(1),
        tipoOcupacao: z.enum(["uso_proprio", "cessao", "locacao", "comodato"]),
        dataInicio: z.string(),
        dataFim: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error("DB indisponível");
        const [r] = await db.insert(ocupacoesImoveis).values({
          imovelId: input.imovelId,
          ocupante: input.ocupante,
          tipoOcupacao: input.tipoOcupacao,
          dataInicio: new Date(input.dataInicio),
          dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        });
        await registrarAuditoria({
          userId: ctx.user.id, acao: "CREATE", entidade: "ocupacoes_imoveis",
          entidadeId: r.insertId, dadosDepois: input,
        });
        return { id: r.insertId };
      }),
  }),
});
