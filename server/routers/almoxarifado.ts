import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { almoxItens, depositos, estoque, movimentacoesAlmox, requisicoesAlmox, requisicoesItens } from "../../drizzle/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const almoxarifadoRouter = router({
  itens: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(almoxItens).where(eq(almoxItens.isActive, true)).orderBy(almoxItens.nome);
    }),
    create: protectedProcedure.input(z.object({
      codigo: z.string().min(1).max(30),
      nome: z.string().min(1).max(255),
      descricao: z.string().optional(),
      unidadeMedida: z.string().min(1).max(20),
      categoria: z.string().max(100).optional(),
      estoqueMinimo: z.string().optional(),
      estoqueMaximo: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(almoxItens).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "almox_itens", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
    update: protectedProcedure.input(z.object({ id: z.number(), data: z.object({ nome: z.string().optional(), estoqueMinimo: z.string().optional(), estoqueMaximo: z.string().optional() }) })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(almoxItens).set(input.data).where(eq(almoxItens.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "UPDATE", entidade: "almox_itens", entidadeId: input.id, dadosDepois: input.data });
      return { success: true };
    }),
  }),

  depositos: router({
    list: protectedProcedure.input(z.object({ ugId: z.number().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input?.ugId) return db.select().from(depositos).where(and(eq(depositos.ugId, input.ugId), eq(depositos.isActive, true)));
      return db.select().from(depositos).where(eq(depositos.isActive, true));
    }),
    create: protectedProcedure.input(z.object({
      ugId: z.number(),
      codigo: z.string().min(1).max(20),
      nome: z.string().min(1).max(255),
      localizacao: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(depositos).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "depositos", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  estoque: router({
    getByDeposito: protectedProcedure.input(z.object({ depositoId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select({
        id: estoque.id, itemId: estoque.itemId, quantidade: estoque.quantidade,
        valorUnitarioMedio: estoque.valorUnitarioMedio,
        itemNome: almoxItens.nome, itemCodigo: almoxItens.codigo, itemUnidade: almoxItens.unidadeMedida,
        estoqueMinimo: almoxItens.estoqueMinimo,
      }).from(estoque).leftJoin(almoxItens, eq(estoque.itemId, almoxItens.id)).where(eq(estoque.depositoId, input.depositoId));
    }),
  }),

  movimentacoes: router({
    registrar: protectedProcedure.input(z.object({
      depositoId: z.number(),
      itemId: z.number(),
      tipo: z.enum(["entrada", "saida", "transferencia", "ajuste"]),
      quantidade: z.string(),
      valorUnitario: z.string().optional(),
      documentoRef: z.string().optional(),
      observacoes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(movimentacoesAlmox).values({ ...input, createdByUserId: ctx.user.id });
      // Atualizar estoque
      const qtd = parseFloat(input.quantidade);
      const delta = input.tipo === "entrada" ? qtd : -qtd;
      await db.insert(estoque).values({ depositoId: input.depositoId, itemId: input.itemId, quantidade: String(Math.abs(delta)), valorUnitarioMedio: input.valorUnitario })
        .onDuplicateKeyUpdate({ set: { quantidade: sql`quantidade + ${delta}` } });
      await registrarAuditoria({ userId: ctx.user.id, acao: `ALMOX_${input.tipo.toUpperCase()}`, entidade: "estoque", dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  requisicoes: router({
    list: protectedProcedure.input(z.object({ ugId: z.number().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input?.ugId) return db.select().from(requisicoesAlmox).where(eq(requisicoesAlmox.ugId, input.ugId)).orderBy(desc(requisicoesAlmox.createdAt));
      return db.select().from(requisicoesAlmox).orderBy(desc(requisicoesAlmox.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      ugId: z.number(),
      justificativa: z.string().optional(),
      itens: z.array(z.object({ itemId: z.number(), quantidadeSolicitada: z.string() })),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const count = await db.select().from(requisicoesAlmox);
      const numero = `REQ-${input.ugId}-${String(count.length + 1).padStart(4, "0")}`;
      const dataRequisicao = new Date().toISOString().split("T")[0]!;
      const [r] = await db.insert(requisicoesAlmox).values({ ugId: input.ugId, numero, solicitanteId: ctx.user.id, justificativa: input.justificativa, dataRequisicao: new Date(dataRequisicao) });
      if (input.itens.length > 0) {
        await db.insert(requisicoesItens).values(input.itens.map(i => ({ requisicaoId: r.insertId, ...i })));
      }
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE_REQUISICAO", entidade: "requisicoes_almox", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId, numero };
    }),
    aprovar: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(requisicoesAlmox).set({ situacao: "aprovada" }).where(eq(requisicoesAlmox.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "APROVAR_REQUISICAO", entidade: "requisicoes_almox", entidadeId: input.id });
      return { success: true };
    }),
  }),
});
