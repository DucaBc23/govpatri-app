import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { orgaos, unidadesGestoras, unidadesAdministrativas } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

const orgaoSchema = z.object({
  codigo: z.string().min(1).max(20),
  nome: z.string().min(1).max(255),
  sigla: z.string().max(20).optional(),
  cnpj: z.string().max(18).optional(),
  esfera: z.enum(["federal", "estadual", "municipal", "distrital"]),
  uf: z.string().length(2).optional(),
  municipio: z.string().max(100).optional(),
});

const ugSchema = z.object({
  orgaoId: z.number().int().positive(),
  codigo: z.string().min(1).max(20),
  nome: z.string().min(1).max(255),
  sigla: z.string().max(20).optional(),
  cnpj: z.string().max(18).optional(),
  tipo: z.enum(["ug_executora", "ug_gestora", "ug_setorial"]).default("ug_executora"),
  ugPaiId: z.number().int().positive().optional(),
});

const uaSchema = z.object({
  ugId: z.number().int().positive(),
  codigo: z.string().min(1).max(20),
  nome: z.string().min(1).max(255),
  sigla: z.string().max(20).optional(),
  uaPaiId: z.number().int().positive().optional(),
});

export const transversalRouter = router({
  // ─── ÓRGÃOS ───────────────────────────────────────────────────────────────
  orgaos: router({
    list: protectedProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(orgaos).orderBy(orgaos.nome);
    }),
    create: protectedProcedure.input(orgaoSchema).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [result] = await db.insert(orgaos).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "orgaos", entidadeId: result.insertId, dadosDepois: input });
      return { id: result.insertId };
    }),
    update: protectedProcedure.input(z.object({ id: z.number(), data: orgaoSchema.partial() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const before = await db.select().from(orgaos).where(eq(orgaos.id, input.id)).limit(1);
      await db.update(orgaos).set(input.data).where(eq(orgaos.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "UPDATE", entidade: "orgaos", entidadeId: input.id, dadosAntes: before[0], dadosDepois: input.data });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(orgaos).set({ isActive: false }).where(eq(orgaos.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "DELETE", entidade: "orgaos", entidadeId: input.id });
      return { success: true };
    }),
  }),

  // ─── UNIDADES GESTORAS ────────────────────────────────────────────────────
  ugs: router({
    list: protectedProcedure.input(z.object({ orgaoId: z.number().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input?.orgaoId) return db.select().from(unidadesGestoras).where(and(eq(unidadesGestoras.orgaoId, input.orgaoId), eq(unidadesGestoras.isActive, true))).orderBy(unidadesGestoras.nome);
      return db.select().from(unidadesGestoras).where(eq(unidadesGestoras.isActive, true)).orderBy(unidadesGestoras.nome);
    }),
    create: protectedProcedure.input(ugSchema).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [result] = await db.insert(unidadesGestoras).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "unidades_gestoras", entidadeId: result.insertId, dadosDepois: input });
      return { id: result.insertId };
    }),
    update: protectedProcedure.input(z.object({ id: z.number(), data: ugSchema.partial() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(unidadesGestoras).set(input.data).where(eq(unidadesGestoras.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "UPDATE", entidade: "unidades_gestoras", entidadeId: input.id, dadosDepois: input.data });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(unidadesGestoras).set({ isActive: false }).where(eq(unidadesGestoras.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "DELETE", entidade: "unidades_gestoras", entidadeId: input.id });
      return { success: true };
    }),
  }),

  // ─── UNIDADES ADMINISTRATIVAS ─────────────────────────────────────────────
  uas: router({
    list: protectedProcedure.input(z.object({ ugId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(unidadesAdministrativas).where(and(eq(unidadesAdministrativas.ugId, input.ugId), eq(unidadesAdministrativas.isActive, true))).orderBy(unidadesAdministrativas.nome);
    }),
    create: protectedProcedure.input(uaSchema).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [result] = await db.insert(unidadesAdministrativas).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "unidades_administrativas", entidadeId: result.insertId, dadosDepois: input });
      return { id: result.insertId };
    }),
    update: protectedProcedure.input(z.object({ id: z.number(), data: uaSchema.partial() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(unidadesAdministrativas).set(input.data).where(eq(unidadesAdministrativas.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "UPDATE", entidade: "unidades_administrativas", entidadeId: input.id, dadosDepois: input.data });
      return { success: true };
    }),
    delete: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(unidadesAdministrativas).set({ isActive: false }).where(eq(unidadesAdministrativas.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "DELETE", entidade: "unidades_administrativas", entidadeId: input.id });
      return { success: true };
    }),
  }),
});
