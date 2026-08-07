import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { users, govpatriUsers } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { ENV } from "../_core/env";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";

const JWT_SECRET = new TextEncoder().encode(ENV.cookieSecret || "govpatri-secret-key-2026");
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export async function signToken(payload: { userId: number; email: string; role: string }): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("365d")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<{ userId: number; email: string; role: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as { userId: number; email: string; role: string };
  } catch {
    return null;
  }
}

export const authLocalRouter = router({
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const [user] = await db.select().from(users)
        .where(eq(users.email, input.email.toLowerCase().trim())).limit(1);

      if (!user || !user.passwordHash) {
        throw new Error("Email ou senha inválidos");
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) throw new Error("Email ou senha inválidos");

      // Atualizar lastSignedIn
      await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));

      const token = await signToken({ userId: user.id, email: user.email ?? "", role: user.role });
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Buscar perfil GOVPatri
      const [govUser] = await db.select().from(govpatriUsers).where(eq(govpatriUsers.userId, user.id)).limit(1);

      return {
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
        role: user.role,
        perfil: govUser?.perfil ?? "operador",
        ugId: govUser?.ugId,
        mustChangePassword: user.mustChangePassword ?? false,
      },
    };
  }),

  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return null;
    const db = await getDb();
    if (!db) return ctx.user;
    const [govUser] = await db.select().from(govpatriUsers)
      .where(eq(govpatriUsers.userId, ctx.user.id)).limit(1);
    return {
      ...ctx.user,
      perfil: govUser?.perfil ?? "operador",
      ugId: govUser?.ugId,
    };
  }),

  // Criar usuário (admin only)
  criarUsuario: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      email: z.string().email(),
      password: z.string().min(6),
      role: z.enum(["user", "admin"]).default("user"),
      perfil: z.enum(["admin", "gestor", "operador", "auditor"]).default("operador"),
      ugId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      if (ctx.user?.role !== "admin") throw new Error("Acesso negado");
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const existing = await db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
      if (existing.length > 0) throw new Error("Email já cadastrado");

      const passwordHash = await bcrypt.hash(input.password, 12);
      const [r] = await db.insert(users).values({
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        loginMethod: "local",
        role: input.role,
        lastSignedIn: new Date(),
      });

      await db.insert(govpatriUsers).values({
        userId: r.insertId,
        perfil: input.perfil,
        ugId: input.ugId,
        isActive: true,
      });

      return { id: r.insertId, success: true };
    }),

  // Alterar senha
  alterarSenha: protectedProcedure
    .input(z.object({ senhaAtual: z.string(), novaSenha: z.string().min(6) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user?.passwordHash) throw new Error("Usuário sem senha definida");
      const valid = await bcrypt.compare(input.senhaAtual, user.passwordHash);
      if (!valid) throw new Error("Senha atual incorreta");
      const passwordHash = await bcrypt.hash(input.novaSenha, 12);
      await db.update(users).set({ passwordHash }).where(eq(users.id, ctx.user.id));
      return { success: true };
    }),

  // Redefinir senha obrigatória (fluxo mustChangePassword — não exige senha atual)
  redefinirSenhaObrigatoria: protectedProcedure
    .input(z.object({ novaSenha: z.string().min(8, "Mínimo 8 caracteres") }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Usuário não encontrado" });
      if (!user.mustChangePassword) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Troca de senha não obrigatória para este usuário" });
      }
      const passwordHash = await bcrypt.hash(input.novaSenha, 12);
      await db.update(users)
        .set({ passwordHash, mustChangePassword: false })
        .where(eq(users.id, ctx.user.id));
      return { success: true };
    }),
});
