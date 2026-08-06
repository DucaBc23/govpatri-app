import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { govpatriUsers, userUgVinculos, users } from "../../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const usuariosRouter = router({
  list: protectedProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select({
      id: govpatriUsers.id,
      userId: govpatriUsers.userId,
      perfil: govpatriUsers.perfil,
      ugId: govpatriUsers.ugId,
      isActive: govpatriUsers.isActive,
      name: users.name,
      email: users.email,
    }).from(govpatriUsers).leftJoin(users, eq(govpatriUsers.userId, users.id));
  }),

  updatePerfil: protectedProcedure
    .input(z.object({
      govpatriUserId: z.number(),
      perfil: z.enum(["admin", "gestor", "operador", "auditor"]),
      ugId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(govpatriUsers).set({ perfil: input.perfil, ugId: input.ugId ?? null }).where(eq(govpatriUsers.id, input.govpatriUserId));
      await registrarAuditoria({ userId: ctx.user.id, acao: "UPDATE_PERFIL", entidade: "govpatri_users", entidadeId: input.govpatriUserId, dadosDepois: input });
      return { success: true };
    }),

  vinculos: router({
    list: protectedProcedure.input(z.object({ govpatriUserId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(userUgVinculos).where(eq(userUgVinculos.govpatriUserId, input.govpatriUserId));
    }),
    add: protectedProcedure.input(z.object({
      govpatriUserId: z.number(),
      ugId: z.number(),
      perfil: z.enum(["admin", "gestor", "operador", "auditor"]),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.insert(userUgVinculos).values(input).onDuplicateKeyUpdate({ set: { perfil: input.perfil } });
      await registrarAuditoria({ userId: ctx.user.id, acao: "ADD_VINCULO", entidade: "user_ug_vinculos", dadosDepois: input });
      return { success: true };
    }),
    remove: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.delete(userUgVinculos).where(eq(userUgVinculos.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "REMOVE_VINCULO", entidade: "user_ug_vinculos", entidadeId: input.id });
      return { success: true };
    }),
  }),
});
