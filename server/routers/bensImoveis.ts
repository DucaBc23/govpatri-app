import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bensImoveis, ocupacoesImoveis, cessoesImoveis, pendenciasImoveis } from "../../drizzle/schema";
import { eq, desc } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

const imovelSchema = z.object({
  ugId: z.number().int().positive(),
  rip: z.string().max(30).optional(),
  denominacao: z.string().min(1).max(255),
  tipo: z.enum(["terreno", "edificacao", "conjunto", "outros"]),
  endereco: z.string().max(500).optional(),
  municipio: z.string().max(100).optional(),
  uf: z.string().length(2).optional(),
  areaTotal: z.string().optional(),
  areaConstruida: z.string().optional(),
  valorAvaliacao: z.string().optional(),
  dataAvaliacao: z.string().optional(),
  situacaoDominial: z.enum(["regular", "irregular", "em_regularizacao", "litigioso"]).default("regular"),
  situacaoOcupacao: z.enum(["proprio_uso", "cedido", "locado", "desocupado"]).default("proprio_uso"),
  observacoes: z.string().optional(),
});

export const bensImoveisRouter = router({
  list: protectedProcedure.input(z.object({ ugId: z.number().optional() }).optional()).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return [];
    if (input?.ugId) return db.select().from(bensImoveis).where(eq(bensImoveis.ugId, input.ugId)).orderBy(desc(bensImoveis.createdAt));
    return db.select().from(bensImoveis).orderBy(desc(bensImoveis.createdAt));
  }),

  getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = await getDb();
    if (!db) return null;
    const r = await db.select().from(bensImoveis).where(eq(bensImoveis.id, input.id)).limit(1);
    return r[0] ?? null;
  }),

  create: protectedProcedure.input(imovelSchema).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const [r] = await db.insert(bensImoveis).values({
      ugId: input.ugId, rip: input.rip, denominacao: input.denominacao, tipo: input.tipo,
      endereco: input.endereco, municipio: input.municipio, uf: input.uf,
      areaTotal: input.areaTotal, areaConstruida: input.areaConstruida,
      valorAvaliacao: input.valorAvaliacao,
      dataAvaliacao: input.dataAvaliacao ? new Date(input.dataAvaliacao) : undefined,
      situacaoDominial: input.situacaoDominial, situacaoOcupacao: input.situacaoOcupacao,
      observacoes: input.observacoes,
    });
    await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "bens_imoveis", entidadeId: r.insertId, dadosDepois: input });
    return { id: r.insertId };
  }),

  update: protectedProcedure.input(z.object({ id: z.number(), data: imovelSchema.partial() })).mutation(async ({ input, ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const before = await db.select().from(bensImoveis).where(eq(bensImoveis.id, input.id)).limit(1);
    const upd: Record<string, unknown> = {};
    const d = input.data;
    if (d.denominacao !== undefined) upd.denominacao = d.denominacao;
    if (d.endereco !== undefined) upd.endereco = d.endereco;
    if (d.municipio !== undefined) upd.municipio = d.municipio;
    if (d.valorAvaliacao !== undefined) upd.valorAvaliacao = d.valorAvaliacao;
    if (d.situacaoDominial !== undefined) upd.situacaoDominial = d.situacaoDominial;
    if (d.situacaoOcupacao !== undefined) upd.situacaoOcupacao = d.situacaoOcupacao;
    if (d.observacoes !== undefined) upd.observacoes = d.observacoes;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (Object.keys(upd).length > 0) await db.update(bensImoveis).set(upd as any).where(eq(bensImoveis.id, input.id));
    await registrarAuditoria({ userId: ctx.user.id, acao: "UPDATE", entidade: "bens_imoveis", entidadeId: input.id, dadosAntes: before[0], dadosDepois: input.data });
    return { success: true };
  }),

  ocupacoes: router({
    list: protectedProcedure.input(z.object({ imovelId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(ocupacoesImoveis).where(eq(ocupacoesImoveis.imovelId, input.imovelId)).orderBy(desc(ocupacoesImoveis.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      imovelId: z.number(), ocupante: z.string(), tipoOcupacao: z.enum(["uso_proprio", "cessao", "locacao", "comodato"]),
      dataInicio: z.string(), dataFim: z.string().optional(), areaOcupada: z.string().optional(), valorMensal: z.string().optional(), observacoes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(ocupacoesImoveis).values({
        imovelId: input.imovelId, ocupante: input.ocupante, tipoOcupacao: input.tipoOcupacao,
        dataInicio: new Date(input.dataInicio), dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        areaOcupada: input.areaOcupada, valorMensal: input.valorMensal, observacoes: input.observacoes,
      });
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE_OCUPACAO", entidade: "bens_imoveis", entidadeId: input.imovelId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  cessoes: router({
    list: protectedProcedure.input(z.object({ imovelId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(cessoesImoveis).where(eq(cessoesImoveis.imovelId, input.imovelId)).orderBy(desc(cessoesImoveis.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      imovelId: z.number(), cessionario: z.string(), finalidade: z.string().optional(),
      dataInicio: z.string(), dataFim: z.string().optional(), documentoRef: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(cessoesImoveis).values({
        imovelId: input.imovelId, cessionario: input.cessionario, finalidade: input.finalidade,
        dataInicio: new Date(input.dataInicio), dataFim: input.dataFim ? new Date(input.dataFim) : undefined,
        documentoRef: input.documentoRef,
      });
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE_CESSAO", entidade: "bens_imoveis", entidadeId: input.imovelId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  pendencias: router({
    list: protectedProcedure.input(z.object({ imovelId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(pendenciasImoveis).where(eq(pendenciasImoveis.imovelId, input.imovelId));
    }),
    create: protectedProcedure.input(z.object({
      imovelId: z.number(), tipo: z.enum(["regularizacao_dominial", "averbacao", "demarcacao", "outros"]),
      descricao: z.string(), prazo: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(pendenciasImoveis).values({
        imovelId: input.imovelId, tipo: input.tipo, descricao: input.descricao,
        prazo: input.prazo ? new Date(input.prazo) : undefined,
      });
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE_PENDENCIA", entidade: "bens_imoveis", entidadeId: input.imovelId, dadosDepois: input });
      return { id: r.insertId };
    }),
    resolver: protectedProcedure.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(pendenciasImoveis).set({ situacao: "resolvida" }).where(eq(pendenciasImoveis.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "RESOLVER_PENDENCIA", entidade: "pendencias_imoveis", entidadeId: input.id });
      return { success: true };
    }),
  }),
});
