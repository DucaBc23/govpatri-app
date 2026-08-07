import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { planoContas, periodosContabeis, eventosPatrimoniais, depreciacaoMensal, bensMoveisTable, classesBens } from "../../drizzle/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const contabilRouter = router({
  planoContas: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(planoContas).where(eq(planoContas.isActive, true)).orderBy(planoContas.codigo);
    }),
    create: protectedProcedure.input(z.object({
      codigo: z.string().min(1).max(30),
      nome: z.string().min(1).max(255),
      tipo: z.enum(["ativo", "passivo", "patrimonio", "receita", "despesa", "variacao"]),
      natureza: z.enum(["devedora", "credora"]),
      nivel: z.number().int().min(1),
      contaPaiId: z.number().int().optional(),
      aceitaLancamento: z.boolean().default(false),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(planoContas).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "plano_contas", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  periodos: router({
    list: protectedProcedure.input(z.object({ ugId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(periodosContabeis).where(eq(periodosContabeis.ugId, input.ugId)).orderBy(desc(periodosContabeis.ano), desc(periodosContabeis.mes));
    }),
    abrir: protectedProcedure.input(z.object({ ugId: z.number(), ano: z.number(), mes: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.insert(periodosContabeis).values({ ...input, situacao: "aberto" })
        .onDuplicateKeyUpdate({ set: { situacao: "reaberto", dataFechamento: null } });
      await registrarAuditoria({ userId: ctx.user.id, acao: "ABRIR_PERIODO", entidade: "periodos_contabeis", dadosDepois: input });
      return { success: true };
    }),
    fechar: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(periodosContabeis).set({ situacao: "fechado", dataFechamento: new Date(), fechadoPorId: ctx.user.id }).where(eq(periodosContabeis.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "FECHAR_PERIODO", entidade: "periodos_contabeis", entidadeId: input.id });
      return { success: true };
    }),
  }),

  eventos: router({
    list: protectedProcedure.input(z.object({ ugId: z.number(), periodoId: z.number().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = [];
      if (input?.ugId) conds.push(eq(eventosPatrimoniais.ugId, input.ugId));
      if (input?.periodoId) conds.push(eq(eventosPatrimoniais.periodoId, input.periodoId));
      if (conds.length > 0) return db.select().from(eventosPatrimoniais).where(and(...conds)).orderBy(desc(eventosPatrimoniais.createdAt));
      return db.select().from(eventosPatrimoniais).orderBy(desc(eventosPatrimoniais.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      ugId: z.number(), periodoId: z.number(),
      tipo: z.enum(["incorporacao", "baixa", "reavaliacao", "depreciacao", "cessao", "transferencia"]),
      bemMovelId: z.number().optional(), bemImovelId: z.number().optional(),
      contaDebitoId: z.number(), contaCreditoId: z.number(),
      valor: z.string(), historico: z.string(), documentoRef: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      // VALIDAÇÃO 2: Impedir evento com conta de débito ou crédito inexistente no plano de contas
      const [contaDebito] = await db
        .select({ id: planoContas.id, aceitaLancamento: planoContas.aceitaLancamento })
        .from(planoContas)
        .where(and(eq(planoContas.id, input.contaDebitoId), eq(planoContas.isActive, true)))
        .limit(1);
      if (!contaDebito || !contaDebito.aceitaLancamento) {
        const motivo = !contaDebito
          ? "conta de débito não encontrada no plano de contas"
          : "conta de débito não aceita lançamento direto";
        await registrarAuditoria({
          userId: ctx.user.id,
          acao: "BLOQUEIO_CONTA_DEBITO_INVALIDA",
          entidade: "eventos_patrimoniais",
          dadosDepois: { contaDebitoId: input.contaDebitoId, motivo },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Conta de débito ${input.contaDebitoId}: ${motivo}. Evento bloqueado e registrado em auditoria.`,
        });
      }

      const [contaCredito] = await db
        .select({ id: planoContas.id, aceitaLancamento: planoContas.aceitaLancamento })
        .from(planoContas)
        .where(and(eq(planoContas.id, input.contaCreditoId), eq(planoContas.isActive, true)))
        .limit(1);
      if (!contaCredito || !contaCredito.aceitaLancamento) {
        const motivo = !contaCredito
          ? "conta de crédito não encontrada no plano de contas"
          : "conta de crédito não aceita lançamento direto";
        await registrarAuditoria({
          userId: ctx.user.id,
          acao: "BLOQUEIO_CONTA_CREDITO_INVALIDA",
          entidade: "eventos_patrimoniais",
          dadosDepois: { contaCreditoId: input.contaCreditoId, motivo },
        });
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Conta de crédito ${input.contaCreditoId}: ${motivo}. Evento bloqueado e registrado em auditoria.`,
        });
      }

      const [r] = await db.insert(eventosPatrimoniais).values({ ...input, createdByUserId: ctx.user.id });
      await registrarAuditoria({ userId: ctx.user.id, acao: `EVENTO_${input.tipo.toUpperCase()}`, entidade: "eventos_patrimoniais", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  depreciacao: router({
    calcular: protectedProcedure.input(z.object({ ugId: z.number(), periodoId: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      // Buscar bens ativos com classe que tem taxa de depreciação
      const bens = await db.select({
        id: bensMoveisTable.id, valorAtual: bensMoveisTable.valorAtual,
        taxaAnual: classesBens.taxaDepreciacaoAnual, valorResidualPerc: classesBens.valorResidualPerc,
        valorAquisicao: bensMoveisTable.valorAquisicao,
      }).from(bensMoveisTable)
        .leftJoin(classesBens, eq(bensMoveisTable.classeId, classesBens.id))
        .where(and(eq(bensMoveisTable.ugId, input.ugId), eq(bensMoveisTable.situacao, "ativo")));

      let processados = 0;
      for (const bem of bens) {
        if (!bem.taxaAnual || !bem.valorAtual) continue;
        const valorAtual = parseFloat(String(bem.valorAtual));
        const taxaMensal = parseFloat(String(bem.taxaAnual)) / 12;
        const valorResidualPerc = parseFloat(String(bem.valorResidualPerc ?? "0.1"));
        const valorAquisicao = parseFloat(String(bem.valorAquisicao));
        const valorResidual = valorAquisicao * valorResidualPerc;
        if (valorAtual <= valorResidual) continue;
        const valorDepreciado = Math.min(valorAtual * taxaMensal, valorAtual - valorResidual);
        const novoValor = valorAtual - valorDepreciado;
        await db.update(bensMoveisTable).set({ valorAtual: String(novoValor) }).where(eq(bensMoveisTable.id, bem.id));
        await db.insert(depreciacaoMensal).values({
          bemId: bem.id, ugId: input.ugId, periodoId: input.periodoId,
          valorDepreciado: String(valorDepreciado), valorAcumulado: String(valorAquisicao - novoValor), valorResidual: String(valorResidual),
        }).onDuplicateKeyUpdate({ set: { valorDepreciado: String(valorDepreciado) } });
        processados++;
      }
      await registrarAuditoria({ userId: ctx.user.id, acao: "CALCULAR_DEPRECIACAO", entidade: "depreciacao_mensal", dadosDepois: { ...input, processados } });
      return { processados };
    }),
    list: protectedProcedure.input(z.object({ ugId: z.number(), periodoId: z.number().optional() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conds = [eq(depreciacaoMensal.ugId, input.ugId)];
      if (input.periodoId) conds.push(eq(depreciacaoMensal.periodoId, input.periodoId));
      return db.select().from(depreciacaoMensal).where(and(...conds)).orderBy(desc(depreciacaoMensal.createdAt));
    }),
  }),
});
import { TRPCError } from "@trpc/server";
