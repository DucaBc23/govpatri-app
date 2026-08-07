import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { transversalRouter } from "./routers/transversal";
import { usuariosRouter } from "./routers/usuarios";
import { bensMoveisTrpcRouter } from "./routers/bensMoveis";
import { almoxarifadoRouter } from "./routers/almoxarifado";
import { bensImoveisRouter } from "./routers/bensImoveis";
import { contabilRouter } from "./routers/contabil";
import { dashboardRouter } from "./routers/dashboard";
import { workflowRouter } from "./routers/workflow";
import { relatoriosRouter } from "./routers/relatorios";
import { seedRouter } from "./routers/seed";
import { inventarioRouter } from "./routers/inventario";
import { termosPdfRouter } from "./routers/termosPdf";
import { seedDemoRouter } from "./routers/seedDemo";
import { getDb } from "./db";
import { govpatriUsers } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { authLocalRouter } from "./routers/authLocal";
import { manutencoesRouter } from "./routers/manutencoes";
import { termosResponsabilidadeRouter } from "./routers/termosResponsabilidade";
import { cessoesImoveisRouter } from "./routers/cessoesImoveis";
import { requisicoesAlmoxRouter } from "./routers/requisicoesAlmox";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  login: authLocalRouter.login,
  criarUsuario: authLocalRouter.criarUsuario,
  alterarSenha: authLocalRouter.alterarSenha,
  redefinirSenhaObrigatoria: authLocalRouter.redefinirSenhaObrigatoria,
  meGovpatri: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const result = await db.select().from(govpatriUsers)
        .where(eq(govpatriUsers.userId, ctx.user.id)).limit(1);
      return result[0] ?? null;
    }),
  }),
  manutencoes: manutencoesRouter,
  termosResponsabilidade: termosResponsabilidadeRouter,
  cessoesImoveis: cessoesImoveisRouter,
  requisicoesAlmox: requisicoesAlmoxRouter,
  transversal: transversalRouter,
  usuarios: usuariosRouter,
  bensMoveis: bensMoveisTrpcRouter,
  almoxarifado: almoxarifadoRouter,
  bensImoveis: bensImoveisRouter,
  contabil: contabilRouter,
  dashboard: dashboardRouter,
  workflow: workflowRouter,
  relatorios: relatoriosRouter,
  seed: seedRouter,
  inventario: inventarioRouter,
  termosPdf: termosPdfRouter,
  seedDemo: seedDemoRouter,
});

export type AppRouter = typeof appRouter;
