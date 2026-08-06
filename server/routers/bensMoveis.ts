import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb, getProximoTombamento } from "../db";
import { bensMoveisTable, classesBens, movimentacoesBens, termosResponsabilidade, termosItens, manutencoes } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

const bemSchema = z.object({
  classeId: z.number().int().positive(),
  ugId: z.number().int().positive(),
  descricao: z.string().min(1).max(500),
  marca: z.string().max(100).optional(),
  modelo: z.string().max(100).optional(),
  numeroSerie: z.string().max(100).optional(),
  anoFabricacao: z.number().int().optional(),
  dataAquisicao: z.string().optional(),
  valorAquisicao: z.string(),
  localizacaoUaId: z.number().int().optional(),
  observacoes: z.string().optional(),
});

export const bensMoveisTrpcRouter = router({
  classes: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(classesBens).where(eq(classesBens.isActive, true)).orderBy(classesBens.nome);
    }),
    create: protectedProcedure.input(z.object({
      codigo: z.string().min(1).max(20),
      nome: z.string().min(1).max(255),
      contaPcasp: z.string().max(20).optional(),
      vidaUtilAnos: z.number().int().optional(),
      taxaDepreciacaoAnual: z.string().optional(),
      valorResidualPerc: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(classesBens).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "classes_bens", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  list: protectedProcedure.input(z.object({ ugId: z.number().optional(), situacao: z.string().optional() }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [];
    if (input?.ugId) conditions.push(eq(bensMoveisTable.ugId, input.ugId));
    if (input?.situacao) conditions.push(eq(bensMoveisTable.situacao, input.situacao as "ativo"));
    if (conditions.length > 0) return db.select().from(bensMoveisTable).where(and(...conditions)).orderBy(desc(bensMoveisTable.createdAt));
    return db.select().from(bensMoveisTable).orderBy(desc(bensMoveisTable.createdAt));
  }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const result = await db.select().from(bensMoveisTable).where(eq(bensMoveisTable.id, input.id)).limit(1);
    return result[0] ?? null;
  }),

  create: protectedProcedure.input(bemSchema).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const numeroTombamento = await getProximoTombamento(input.ugId);
    const [r] = await db.insert(bensMoveisTable).values({
      classeId: input.classeId, ugId: input.ugId, descricao: input.descricao,
      marca: input.marca, modelo: input.modelo, numeroSerie: input.numeroSerie,
      anoFabricacao: input.anoFabricacao,
      dataAquisicao: input.dataAquisicao ? new Date(input.dataAquisicao) : undefined,
      valorAquisicao: input.valorAquisicao, valorAtual: input.valorAquisicao,
      localizacaoUaId: input.localizacaoUaId, observacoes: input.observacoes,
      numeroTombamento,
    });
    await registrarAuditoria({ userId: ctx.user.id, acao: "INCORPORACAO", entidade: "bens_moveis", entidadeId: r.insertId, dadosDepois: { ...input, numeroTombamento } });
    return { id: r.insertId, numeroTombamento };
  }),

  update: protectedProcedure.input(z.object({ id: z.number(), data: bemSchema.partial() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const before = await db.select().from(bensMoveisTable).where(eq(bensMoveisTable.id, input.id)).limit(1);
    // Build update object with only defined fields to avoid type issues
    const upd: Record<string, unknown> = {};
    const d = input.data;
    if (d.descricao !== undefined) upd.descricao = d.descricao;
    if (d.marca !== undefined) upd.marca = d.marca;
    if (d.modelo !== undefined) upd.modelo = d.modelo;
    if (d.observacoes !== undefined) upd.observacoes = d.observacoes;
    if (d.localizacaoUaId !== undefined) upd.localizacaoUaId = d.localizacaoUaId;
    if (d.valorAquisicao !== undefined) upd.valorAquisicao = d.valorAquisicao;
    if (Object.keys(upd).length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(bensMoveisTable).set(upd as any).where(eq(bensMoveisTable.id, input.id));
    }
    await registrarAuditoria({ userId: ctx.user.id, acao: "UPDATE", entidade: "bens_moveis", entidadeId: input.id, dadosAntes: before[0], dadosDepois: input.data });
    return { success: true };
  }),

  movimentacoes: router({
    list: protectedProcedure.input(z.object({ bemId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(movimentacoesBens).where(eq(movimentacoesBens.bemId, input.bemId)).orderBy(desc(movimentacoesBens.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      bemId: z.number(),
      tipo: z.enum(["incorporacao", "transferencia", "cessao", "baixa", "reavaliacao", "manutencao"]),
      ugDestinoId: z.number().optional(),
      uaDestinoId: z.number().optional(),
      responsavelDestinoId: z.number().optional(),
      dataMovimentacao: z.string(),
      valorAnterior: z.string().optional(),
      valorNovo: z.string().optional(),
      justificativa: z.string().optional(),
      documentoRef: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(movimentacoesBens).values({
        bemId: input.bemId, tipo: input.tipo,
        ugDestinoId: input.ugDestinoId, uaDestinoId: input.uaDestinoId,
        responsavelDestinoId: input.responsavelDestinoId,
        dataMovimentacao: new Date(input.dataMovimentacao),
        valorAnterior: input.valorAnterior, valorNovo: input.valorNovo,
        justificativa: input.justificativa, documentoRef: input.documentoRef,
        createdByUserId: ctx.user.id,
      });
      if (input.tipo === "baixa") await db.update(bensMoveisTable).set({ situacao: "baixado" }).where(eq(bensMoveisTable.id, input.bemId));
      if (input.tipo === "cessao") await db.update(bensMoveisTable).set({ situacao: "cedido" }).where(eq(bensMoveisTable.id, input.bemId));
      if (input.ugDestinoId) await db.update(bensMoveisTable).set({ ugId: input.ugDestinoId }).where(eq(bensMoveisTable.id, input.bemId));
      await registrarAuditoria({ userId: ctx.user.id, acao: `MOVIMENTACAO_${input.tipo.toUpperCase()}`, entidade: "bens_moveis", entidadeId: input.bemId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  termos: router({
    list: protectedProcedure.input(z.object({ ugId: z.number().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input?.ugId) return db.select().from(termosResponsabilidade).where(eq(termosResponsabilidade.ugId, input.ugId)).orderBy(desc(termosResponsabilidade.createdAt));
      return db.select().from(termosResponsabilidade).orderBy(desc(termosResponsabilidade.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      ugId: z.number(),
      responsavelId: z.number(),
      dataEmissao: z.string(),
      dataVencimento: z.string().optional(),
      observacoes: z.string().optional(),
      bensIds: z.array(z.number()),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const count = await db.select().from(termosResponsabilidade);
      const numero = `TR-${input.ugId}-${String(count.length + 1).padStart(4, "0")}`;
      const [r] = await db.insert(termosResponsabilidade).values({
        ugId: input.ugId, responsavelId: input.responsavelId,
        dataEmissao: new Date(input.dataEmissao),
        dataVencimento: input.dataVencimento ? new Date(input.dataVencimento) : undefined,
        observacoes: input.observacoes, numero, createdByUserId: ctx.user.id,
      });
      if (input.bensIds.length > 0) {
        await db.insert(termosItens).values(input.bensIds.map(bemId => ({ termoId: r.insertId, bemId })));
      }
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "termos_responsabilidade", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId, numero };
    }),
  }),

  manutencoes: router({
    list: protectedProcedure.input(z.object({ bemId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(manutencoes).where(eq(manutencoes.bemId, input.bemId)).orderBy(desc(manutencoes.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      bemId: z.number(),
      tipo: z.enum(["preventiva", "corretiva"]),
      descricao: z.string(),
      dataInicio: z.string(),
      custo: z.string().optional(),
      fornecedor: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(manutencoes).values({
        bemId: input.bemId, tipo: input.tipo, descricao: input.descricao,
        dataInicio: new Date(input.dataInicio), custo: input.custo, fornecedor: input.fornecedor,
        createdByUserId: ctx.user.id,
      });
      await db.update(bensMoveisTable).set({ situacao: "em_manutencao" }).where(eq(bensMoveisTable.id, input.bemId));
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE_MANUTENCAO", entidade: "bens_moveis", entidadeId: input.bemId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),
});
