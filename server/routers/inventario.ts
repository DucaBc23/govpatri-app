import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { inventarios, inventarioColetas, bensMoveisTable, classesBens } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import QRCode from "qrcode";
import { registrarAuditoria } from "../audit";

export const inventarioRouter = router({
  list: protectedProcedure
    .input(z.object({ ugId: z.number().optional() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const rows = await db.select().from(inventarios)
        .orderBy(sql`${inventarios.createdAt} DESC`);
      return input.ugId ? rows.filter(r => r.ugId === input.ugId) : rows;
    }),

  criar: protectedProcedure
    .input(z.object({
      ugId: z.number(),
      nome: z.string().min(1),
      dataInicio: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const bens = await db.select({ id: bensMoveisTable.id })
        .from(bensMoveisTable)
        .where(and(eq(bensMoveisTable.ugId, input.ugId), eq(bensMoveisTable.situacao, "ativo")));
      const [result] = await db.insert(inventarios).values({
        ugId: input.ugId,
        nome: input.nome,
        dataInicio: new Date(input.dataInicio),
        responsavelId: ctx.user.id,
        totalBens: bens.length,
        situacao: "aberto",
      });
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE_INVENTARIO", entidade: "inventarios", entidadeId: result.insertId });
      return { id: result.insertId };
    }),

  iniciarColeta: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(inventarios)
        .set({ situacao: "em_coleta" })
        .where(eq(inventarios.id, input.id));
      return { ok: true };
    }),

  concluir: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const coletas = await db.select().from(inventarioColetas)
        .where(eq(inventarioColetas.inventarioId, input.id));
      const divergencias = coletas.filter(c => c.situacaoEncontrada !== "encontrado").length;
      await db.update(inventarios).set({
        situacao: "concluido",
        dataFim: new Date(),
        totalColetados: coletas.length,
        totalDivergencias: divergencias,
      }).where(eq(inventarios.id, input.id));
      return { ok: true, divergencias };
    }),

  registrarColeta: protectedProcedure
    .input(z.object({
      inventarioId: z.number(),
      bemId: z.number(),
      situacaoEncontrada: z.enum(["encontrado", "nao_encontrado", "divergencia_localizacao", "divergencia_estado"]),
      localizacaoEncontrada: z.string().optional(),
      observacao: z.string().optional(),
      metodoColeta: z.enum(["qrcode", "manual"]).default("manual"),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.insert(inventarioColetas).values({
        inventarioId: input.inventarioId,
        bemId: input.bemId,
        situacaoEncontrada: input.situacaoEncontrada,
        localizacaoEncontrada: input.localizacaoEncontrada ?? null,
        observacao: input.observacao ?? null,
        metodoColeta: input.metodoColeta,
        coletadoPorId: ctx.user.id,
      }).onDuplicateKeyUpdate({
        set: {
          situacaoEncontrada: input.situacaoEncontrada,
          localizacaoEncontrada: input.localizacaoEncontrada ?? null,
          observacao: input.observacao ?? null,
          metodoColeta: input.metodoColeta,
          coletadoPorId: ctx.user.id,
        }
      });
      await db.update(inventarios).set({
        totalColetados: sql`totalColetados + 1`,
      }).where(eq(inventarios.id, input.inventarioId));
      return { ok: true };
    }),

  coletas: protectedProcedure
    .input(z.object({ inventarioId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select({
        id: inventarioColetas.id,
        bemId: inventarioColetas.bemId,
        tombamento: bensMoveisTable.numeroTombamento,
        descricao: bensMoveisTable.descricao,
        situacaoEncontrada: inventarioColetas.situacaoEncontrada,
        localizacaoEncontrada: inventarioColetas.localizacaoEncontrada,
        observacao: inventarioColetas.observacao,
        metodoColeta: inventarioColetas.metodoColeta,
        createdAt: inventarioColetas.createdAt,
      }).from(inventarioColetas)
        .leftJoin(bensMoveisTable, eq(inventarioColetas.bemId, bensMoveisTable.id))
        .where(eq(inventarioColetas.inventarioId, input.inventarioId));
    }),

  gerarQrCode: protectedProcedure
    .input(z.object({ bemId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [bem] = await db.select({
        id: bensMoveisTable.id,
        tombamento: bensMoveisTable.numeroTombamento,
        descricao: bensMoveisTable.descricao,
        marca: bensMoveisTable.marca,
        modelo: bensMoveisTable.modelo,
      }).from(bensMoveisTable).where(eq(bensMoveisTable.id, input.bemId)).limit(1);
      if (!bem) throw new Error("Bem não encontrado");
      const payload = JSON.stringify({ id: bem.id, tombamento: bem.tombamento });
      const qrDataUrl = await QRCode.toDataURL(payload, { width: 200, margin: 1 });
      return { bem, qrDataUrl };
    }),

  bensPendentes: protectedProcedure
    .input(z.object({ inventarioId: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const inv = await db.select().from(inventarios)
        .where(eq(inventarios.id, input.inventarioId)).limit(1);
      if (!inv[0]) return [];
      const coletados = await db.select({ bemId: inventarioColetas.bemId })
        .from(inventarioColetas)
        .where(eq(inventarioColetas.inventarioId, input.inventarioId));
      const coletadosIds = new Set(coletados.map(c => c.bemId));
      const bens = await db.select({
        id: bensMoveisTable.id,
        tombamento: bensMoveisTable.numeroTombamento,
        descricao: bensMoveisTable.descricao,
        situacao: bensMoveisTable.situacao,
      }).from(bensMoveisTable)
        .where(and(eq(bensMoveisTable.ugId, inv[0].ugId), eq(bensMoveisTable.situacao, "ativo")));
      return bens.filter(b => !coletadosIds.has(b.id));
    }),
});
