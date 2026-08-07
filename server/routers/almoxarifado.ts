import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import {
  almoxItens, depositos, estoque, movimentacoesAlmox,
  requisicoesAlmox, requisicoesItens,
  almoxLotes, almoxEnderecos, almoxAlocacoes,
  almoxDevolucoes, almoxBaixas, almoxBackorder, almoxSubstituicoes,
} from "../../drizzle/schema";
import { eq, and, desc, asc, sql, lte, gte } from "drizzle-orm";
import { registrarAuditoria } from "../audit";

export const almoxarifadoRouter = router({
  // ─── Catálogo de itens ────────────────────────────────────────────────────
  itens: router({
    list: protectedProcedure.input(z.object({ ugId: z.number().optional() }).optional()).query(async () => {
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
    update: protectedProcedure.input(z.object({
      id: z.number(),
      data: z.object({ nome: z.string().optional(), descricao: z.string().optional(), estoqueMinimo: z.string().optional(), estoqueMaximo: z.string().optional(), categoria: z.string().optional() }),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await db.update(almoxItens).set(input.data as any).where(eq(almoxItens.id, input.id));
      await registrarAuditoria({ userId: ctx.user.id, acao: "UPDATE", entidade: "almox_itens", entidadeId: input.id, dadosDepois: input.data });
      return { success: true };
    }),
  }),

  // ─── Depósitos ────────────────────────────────────────────────────────────
  depositos: router({
    list: protectedProcedure.input(z.object({ ugId: z.number().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input?.ugId) return db.select().from(depositos).where(and(eq(depositos.ugId, input.ugId), eq(depositos.isActive, true)));
      return db.select().from(depositos).where(eq(depositos.isActive, true));
    }),
    create: protectedProcedure.input(z.object({
      ugId: z.number(), codigo: z.string().min(1).max(20), nome: z.string().min(1).max(255), localizacao: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(depositos).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "depositos", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
  }),

  // ─── Estoque ──────────────────────────────────────────────────────────────
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

  // ─── ALM-002: Rastreio por lote e validade ────────────────────────────────
  lotes: router({
    rastrear: protectedProcedure.input(z.object({ itemId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const lotes = await db.select().from(almoxLotes)
        .where(eq(almoxLotes.itemId, input.itemId))
        .orderBy(asc(almoxLotes.dataValidade), asc(almoxLotes.dataEntrada));
      const resultado = await Promise.all(lotes.map(async (lote) => {
        const movs = await db.select().from(movimentacoesAlmox)
          .where(eq(movimentacoesAlmox.itemId, input.itemId))
          .orderBy(asc(movimentacoesAlmox.createdAt));
        const alocacoes = await db.select().from(almoxAlocacoes).where(eq(almoxAlocacoes.loteId, lote.id));
        return { ...lote, movimentacoes: movs, alocacoes };
      }));
      return resultado;
    }),

    aVencer: protectedProcedure.input(z.object({ ugId: z.number(), diasJanela: z.number().int().min(1).max(365) })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const hoje = new Date();
      const limite = new Date(hoje);
      limite.setDate(limite.getDate() + input.diasJanela);
      return db.select({
        id: almoxLotes.id, numeroLote: almoxLotes.numeroLote, dataValidade: almoxLotes.dataValidade,
        quantidadeDisponivel: almoxLotes.quantidadeDisponivel, itemId: almoxLotes.itemId,
        itemNome: almoxItens.nome, itemCodigo: almoxItens.codigo, depositoId: almoxLotes.depositoId, depositoNome: depositos.nome,
      }).from(almoxLotes)
        .leftJoin(almoxItens, eq(almoxLotes.itemId, almoxItens.id))
        .leftJoin(depositos, eq(almoxLotes.depositoId, depositos.id))
        .where(and(
          gte(almoxLotes.dataValidade, hoje),
          lte(almoxLotes.dataValidade, limite),
          sql`${almoxLotes.quantidadeDisponivel} > 0`,
          eq(almoxLotes.situacao, "disponivel"),
        ))
        .orderBy(asc(almoxLotes.dataValidade));
    }),
  }),

  // ─── ALM-004: Endereçamento físico ────────────────────────────────────────
  enderecos: router({
    list: protectedProcedure.input(z.object({ depositoId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(almoxEnderecos)
        .where(and(eq(almoxEnderecos.depositoId, input.depositoId), eq(almoxEnderecos.isActive, true)))
        .orderBy(almoxEnderecos.rua, almoxEnderecos.estante, almoxEnderecos.prateleira, almoxEnderecos.posicao);
    }),
    create: protectedProcedure.input(z.object({
      depositoId: z.number(), rua: z.string().min(1).max(20), estante: z.string().min(1).max(20),
      prateleira: z.string().min(1).max(20), posicao: z.string().min(1).max(20),
      descricao: z.string().optional(), capacidade: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [r] = await db.insert(almoxEnderecos).values(input);
      await registrarAuditoria({ userId: ctx.user.id, acao: "CREATE", entidade: "almox_enderecos", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
    alocar: protectedProcedure.input(z.object({
      loteId: z.number(), enderecoId: z.number(), quantidade: z.string(), motivo: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [lote] = await db.select().from(almoxLotes).where(eq(almoxLotes.id, input.loteId)).limit(1);
      const [endereco] = await db.select().from(almoxEnderecos).where(eq(almoxEnderecos.id, input.enderecoId)).limit(1);
      if (!lote || !endereco) throw new TRPCError({ code: "NOT_FOUND", message: "Lote ou endereço não encontrado." });
      if (!endereco.isActive) {
        await registrarAuditoria({ userId: ctx.user.id, acao: "BLOQUEIO_ALOCACAO_ENDERECO_INATIVO", entidade: "almox_alocacoes", dadosDepois: { enderecoId: input.enderecoId, motivo: "endereço inativo" } });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Endereço inativo. Alocação bloqueada e registrada em auditoria." });
      }
      if (lote.depositoId !== endereco.depositoId) {
        await registrarAuditoria({ userId: ctx.user.id, acao: "BLOQUEIO_ALOCACAO_DEPOSITO_DIFERENTE", entidade: "almox_alocacoes", dadosDepois: { loteDepositoId: lote.depositoId, enderecoDepositoId: endereco.depositoId, motivo: "endereço pertence a outro depósito" } });
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Endereço pertence a outro depósito. Alocação bloqueada e registrada em auditoria." });
      }
      const [r] = await db.insert(almoxAlocacoes).values({ loteId: input.loteId, enderecoId: input.enderecoId, quantidade: input.quantidade, motivo: input.motivo, alocadoPorId: ctx.user.id });
      await registrarAuditoria({ userId: ctx.user.id, acao: "ALOCAR_LOTE", entidade: "almox_alocacoes", entidadeId: r.insertId, dadosDepois: input });
      return { id: r.insertId };
    }),
    consultarConteudo: protectedProcedure.input(z.object({ enderecoId: z.number() })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db.select({
        alocacaoId: almoxAlocacoes.id, quantidade: almoxAlocacoes.quantidade,
        loteId: almoxLotes.id, numeroLote: almoxLotes.numeroLote, dataValidade: almoxLotes.dataValidade,
        quantidadeDisponivel: almoxLotes.quantidadeDisponivel,
        itemId: almoxItens.id, itemNome: almoxItens.nome, itemCodigo: almoxItens.codigo,
      }).from(almoxAlocacoes)
        .leftJoin(almoxLotes, eq(almoxAlocacoes.loteId, almoxLotes.id))
        .leftJoin(almoxItens, eq(almoxLotes.itemId, almoxItens.id))
        .where(eq(almoxAlocacoes.enderecoId, input.enderecoId));
    }),
  }),

  // ─── ALM-005: Entrada com documento ──────────────────────────────────────
  movimentacoes: router({
    registrarEntrada: protectedProcedure.input(z.object({
      depositoId: z.number(), itemId: z.number(),
      tipoEntrada: z.enum(["nota_fiscal", "romaneio", "doacao", "devolucao"]),
      quantidade: z.string(), quantidadeConferida: z.string(),
      divergenciaJustificativa: z.string().optional(),
      valorUnitario: z.string().optional(), documentoRef: z.string().optional(),
      numeroLote: z.string().optional(), dataValidade: z.string().optional(),
      observacoes: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      // VALIDAÇÃO: nota fiscal exige documento comprobatório
      if (input.tipoEntrada === "nota_fiscal" && !input.documentoRef) {
        await registrarAuditoria({ userId: ctx.user.id, acao: "BLOQUEIO_ENTRADA_SEM_DOCUMENTO", entidade: "movimentacoes_almox", dadosDepois: { tipoEntrada: input.tipoEntrada, motivo: "nota fiscal sem documento anexado" } });
        throw new TRPCError({ code: "BAD_REQUEST", message: "Entrada por nota fiscal exige documento comprobatório. Operação bloqueada e registrada em auditoria." });
      }
      const qtdInformada = parseFloat(input.quantidade);
      const qtdConferida = parseFloat(input.quantidadeConferida);
      const temDivergencia = Math.abs(qtdInformada - qtdConferida) > 0.001;
      if (temDivergencia && !input.divergenciaJustificativa) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Divergência entre quantidade informada e conferida exige justificativa." });
      }
      const qtdEfetiva = String(qtdConferida);
      const [r] = await db.insert(movimentacoesAlmox).values({
        depositoId: input.depositoId, itemId: input.itemId, tipo: "entrada",
        quantidade: qtdEfetiva, valorUnitario: input.valorUnitario, documentoRef: input.documentoRef,
        observacoes: temDivergencia ? `[DIVERGÊNCIA] Informado: ${input.quantidade} | Conferido: ${input.quantidadeConferida} | Justificativa: ${input.divergenciaJustificativa}` : input.observacoes,
        createdByUserId: ctx.user.id,
      });
      // Custo médio ponderado
      const estoqueAtual = await db.select().from(estoque).where(and(eq(estoque.depositoId, input.depositoId), eq(estoque.itemId, input.itemId))).limit(1);
      if (estoqueAtual.length > 0 && estoqueAtual[0] && input.valorUnitario) {
        const qtdAtual = parseFloat(String(estoqueAtual[0].quantidade));
        const vumAtual = parseFloat(String(estoqueAtual[0].valorUnitarioMedio ?? "0"));
        const novoVum = ((qtdAtual * vumAtual) + (qtdConferida * parseFloat(input.valorUnitario))) / (qtdAtual + qtdConferida);
        await db.update(estoque).set({ quantidade: sql`quantidade + ${qtdConferida}`, valorUnitarioMedio: String(novoVum) }).where(and(eq(estoque.depositoId, input.depositoId), eq(estoque.itemId, input.itemId)));
      } else {
        await db.insert(estoque).values({ depositoId: input.depositoId, itemId: input.itemId, quantidade: qtdEfetiva, valorUnitarioMedio: input.valorUnitario }).onDuplicateKeyUpdate({ set: { quantidade: sql`quantidade + ${qtdConferida}` } });
      }
      if (input.numeroLote) {
        await db.insert(almoxLotes).values({
          depositoId: input.depositoId, itemId: input.itemId, numeroLote: input.numeroLote,
          dataValidade: input.dataValidade ? new Date(input.dataValidade) : undefined,
          dataEntrada: new Date(), quantidadeInicial: qtdEfetiva, quantidadeDisponivel: qtdEfetiva,
          valorUnitario: input.valorUnitario, movimentacaoOrigemId: r.insertId,
        });
      }
      await registrarAuditoria({ userId: ctx.user.id, acao: "ALMOX_ENTRADA", entidade: "movimentacoes_almox", entidadeId: r.insertId, dadosDepois: { ...input, qtdEfetiva, temDivergencia } });
      return { id: r.insertId };
    }),
  }),

  // ─── ALM-007: Atendimento parcial e substituição ──────────────────────────
  requisicoes: router({
    list: protectedProcedure.input(z.object({ ugId: z.number().optional() }).optional()).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input?.ugId) return db.select().from(requisicoesAlmox).where(eq(requisicoesAlmox.ugId, input.ugId)).orderBy(desc(requisicoesAlmox.createdAt));
      return db.select().from(requisicoesAlmox).orderBy(desc(requisicoesAlmox.createdAt));
    }),
    create: protectedProcedure.input(z.object({
      ugId: z.number(), justificativa: z.string().optional(),
      itens: z.array(z.object({ itemId: z.number(), quantidadeSolicitada: z.string() })),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const count = await db.select().from(requisicoesAlmox);
      const numero = `REQ-${input.ugId}-${String(count.length + 1).padStart(4, "0")}`;
      const dataRequisicao = new Date().toISOString().split("T")[0]!;
      const [r] = await db.insert(requisicoesAlmox).values({ ugId: input.ugId, numero, solicitanteId: ctx.user.id, justificativa: input.justificativa, dataRequisicao: new Date(dataRequisicao) });
      if (input.itens.length > 0) await db.insert(requisicoesItens).values(input.itens.map(i => ({ requisicaoId: r.insertId, ...i })));
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
    // FEFO: atende por lote de validade mais próxima primeiro
    atenderParcial: protectedProcedure.input(z.object({
      requisicaoItemId: z.number(), quantidadeAtender: z.string(), depositoId: z.number(),
      loteIdSobreposto: z.number().optional(), justificativaSobreposto: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [reqItem] = await db.select().from(requisicoesItens).where(eq(requisicoesItens.id, input.requisicaoItemId)).limit(1);
      if (!reqItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item de requisição não encontrado." });
      const qtdAtender = parseFloat(input.quantidadeAtender);
      const qtdJaAtendida = parseFloat(String(reqItem.quantidadeAtendida ?? "0"));
      const qtdSolicitada = parseFloat(String(reqItem.quantidadeSolicitada));
      const qtdPendente = qtdSolicitada - qtdJaAtendida;
      if (qtdAtender > qtdPendente) throw new TRPCError({ code: "BAD_REQUEST", message: `Quantidade a atender (${qtdAtender}) supera o saldo pendente (${qtdPendente}).` });
      let loteUsado;
      if (input.loteIdSobreposto) {
        if (!input.justificativaSobreposto) throw new TRPCError({ code: "BAD_REQUEST", message: "Sobreposição manual de FEFO exige justificativa." });
        const [lote] = await db.select().from(almoxLotes).where(and(eq(almoxLotes.id, input.loteIdSobreposto), eq(almoxLotes.situacao, "disponivel"))).limit(1);
        if (!lote) throw new TRPCError({ code: "NOT_FOUND", message: "Lote sobreposto não encontrado ou indisponível." });
        loteUsado = lote;
        await registrarAuditoria({ userId: ctx.user.id, acao: "FEFO_SOBREPOSTO", entidade: "almox_lotes", entidadeId: lote.id, dadosDepois: { justificativa: input.justificativaSobreposto } });
      } else {
        const hoje = new Date();
        const lotesFEFO = await db.select().from(almoxLotes)
          .where(and(eq(almoxLotes.itemId, reqItem.itemId), eq(almoxLotes.depositoId, input.depositoId), eq(almoxLotes.situacao, "disponivel"), sql`${almoxLotes.quantidadeDisponivel} > 0`))
          .orderBy(asc(almoxLotes.dataValidade), asc(almoxLotes.dataEntrada));
        const lotesValidos = lotesFEFO.filter(l => !l.dataValidade || new Date(l.dataValidade) >= hoje);
        if (lotesValidos.length === 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Sem lotes disponíveis não vencidos para este item no depósito." });
        loteUsado = lotesValidos[0]!;
      }
      const qtdLote = parseFloat(String(loteUsado.quantidadeDisponivel));
      const qtdDebitada = Math.min(qtdAtender, qtdLote);
      const novaQtdLote = qtdLote - qtdDebitada;
      await db.update(almoxLotes).set({ quantidadeDisponivel: String(novaQtdLote), situacao: novaQtdLote <= 0 ? "esgotado" : "disponivel" }).where(eq(almoxLotes.id, loteUsado.id));
      await db.update(estoque).set({ quantidade: sql`quantidade - ${qtdDebitada}` }).where(and(eq(estoque.depositoId, input.depositoId), eq(estoque.itemId, reqItem.itemId)));
      const novaQtdAtendida = qtdJaAtendida + qtdDebitada;
      await db.update(requisicoesItens).set({ quantidadeAtendida: String(novaQtdAtendida) }).where(eq(requisicoesItens.id, input.requisicaoItemId));
      await db.insert(movimentacoesAlmox).values({ depositoId: input.depositoId, itemId: reqItem.itemId, tipo: "saida", quantidade: String(qtdDebitada), requisicaoId: reqItem.requisicaoId, observacoes: `Atendimento parcial FEFO — lote ${loteUsado.numeroLote}`, createdByUserId: ctx.user.id });
      const todosItens = await db.select().from(requisicoesItens).where(eq(requisicoesItens.requisicaoId, reqItem.requisicaoId));
      const totalmenteAtendida = todosItens.every(i => parseFloat(String(i.quantidadeAtendida ?? "0")) >= parseFloat(String(i.quantidadeSolicitada)));
      if (totalmenteAtendida) {
        await db.update(requisicoesAlmox).set({ situacao: "atendida", dataAtendimento: new Date() }).where(eq(requisicoesAlmox.id, reqItem.requisicaoId));
      } else if (qtdDebitada < qtdAtender) {
        const saldoPendente = qtdAtender - qtdDebitada;
        await db.insert(almoxBackorder).values({ requisicaoItemId: input.requisicaoItemId, quantidadePendente: String(saldoPendente) }).onDuplicateKeyUpdate({ set: { quantidadePendente: sql`quantidadePendente + ${saldoPendente}` } });
      }
      await registrarAuditoria({ userId: ctx.user.id, acao: "ATENDIMENTO_PARCIAL", entidade: "requisicoes_almox", entidadeId: reqItem.requisicaoId, dadosDepois: { ...input, loteUsadoId: loteUsado.id, qtdDebitada, totalmenteAtendida } });
      return { qtdDebitada, totalmenteAtendida, loteUsadoId: loteUsado.id };
    }),
    substituirItem: protectedProcedure.input(z.object({
      requisicaoItemId: z.number(), itemSubstitutoId: z.number(), autorizadorId: z.number(), justificativa: z.string().min(10),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [reqItem] = await db.select().from(requisicoesItens).where(eq(requisicoesItens.id, input.requisicaoItemId)).limit(1);
      if (!reqItem) throw new TRPCError({ code: "NOT_FOUND", message: "Item de requisição não encontrado." });
      const [r] = await db.insert(almoxSubstituicoes).values({ requisicaoItemId: input.requisicaoItemId, itemOriginalId: reqItem.itemId, itemSubstitutoId: input.itemSubstitutoId, autorizadorId: input.autorizadorId, justificativa: input.justificativa });
      await db.update(requisicoesItens).set({ itemId: input.itemSubstitutoId }).where(eq(requisicoesItens.id, input.requisicaoItemId));
      await registrarAuditoria({ userId: ctx.user.id, acao: "SUBSTITUICAO_ITEM", entidade: "requisicoes_itens", entidadeId: input.requisicaoItemId, dadosDepois: input });
      return { id: r.insertId };
    }),
    cancelarBackorder: protectedProcedure.input(z.object({ requisicaoItemId: z.number(), motivo: z.string().min(5) })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      await db.update(almoxBackorder).set({ situacao: "cancelado", motivoCancelamento: input.motivo }).where(and(eq(almoxBackorder.requisicaoItemId, input.requisicaoItemId), eq(almoxBackorder.situacao, "pendente")));
      await registrarAuditoria({ userId: ctx.user.id, acao: "CANCELAR_BACKORDER", entidade: "almox_backorder", dadosDepois: input });
      return { success: true };
    }),
  }),

  // ─── ALM-008: Devolução ao estoque ────────────────────────────────────────
  devolucoes: router({
    registrar: protectedProcedure.input(z.object({
      requisicaoItemId: z.number(), loteOrigemId: z.number(), quantidade: z.string(),
      motivo: z.string().min(5), condicao: z.enum(["integro", "avariado", "vencido"]),
      enderecoDestinoId: z.number().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      const [loteOrigem] = await db.select().from(almoxLotes).where(eq(almoxLotes.id, input.loteOrigemId)).limit(1);
      if (!loteOrigem) throw new TRPCError({ code: "NOT_FOUND", message: "Lote de origem não encontrado." });
      const qtd = parseFloat(input.quantidade);
      if (input.condicao === "integro") {
        // Material íntegro: retorna ao saldo disponível do lote de origem
        await db.update(almoxLotes).set({ quantidadeDisponivel: sql`quantidadeDisponivel + ${qtd}`, situacao: "disponivel" }).where(eq(almoxLotes.id, input.loteOrigemId));
        await db.update(estoque).set({ quantidade: sql`quantidade + ${qtd}` }).where(and(eq(estoque.depositoId, loteOrigem.depositoId), eq(estoque.itemId, loteOrigem.itemId)));
      } else {
        // Avariado ou vencido: quarentena — não disponível para consumo
        await db.update(almoxLotes).set({ quantidadeQuarentena: sql`quantidadeQuarentena + ${qtd}`, situacao: "quarentena" }).where(eq(almoxLotes.id, input.loteOrigemId));
      }
      const [r] = await db.insert(almoxDevolucoes).values({ requisicaoItemId: input.requisicaoItemId, loteOrigemId: input.loteOrigemId, enderecoDestinoId: input.enderecoDestinoId, quantidade: input.quantidade, condicao: input.condicao, motivo: input.motivo, registradoPorId: ctx.user.id });
      await registrarAuditoria({ userId: ctx.user.id, acao: "DEVOLUCAO_ALMOX", entidade: "almox_devolucoes", entidadeId: r.insertId, dadosDepois: { ...input, retornouAoSaldo: input.condicao === "integro" } });
      return { id: r.insertId, retornouAoSaldo: input.condicao === "integro" };
    }),
  }),

  // ─── ALM-010: Baixas de almoxarifado ─────────────────────────────────────
  baixas: router({
    registrar: protectedProcedure.input(z.object({
      loteId: z.number(), quantidade: z.string(),
      motivo: z.enum(["vencimento", "avaria", "obsolescencia", "perda"]),
      evidenciaDocRef: z.string().optional(),
    })).mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");
      // VALIDAÇÃO: avaria e perda exigem evidência documental
      if ((input.motivo === "avaria" || input.motivo === "perda") && !input.evidenciaDocRef) {
        await registrarAuditoria({ userId: ctx.user.id, acao: "BLOQUEIO_BAIXA_SEM_EVIDENCIA", entidade: "almox_baixas", dadosDepois: { loteId: input.loteId, motivo: input.motivo, bloqueio: "evidência documental obrigatória para avaria e perda" } });
        throw new TRPCError({ code: "BAD_REQUEST", message: `Baixa por '${input.motivo}' exige evidência documental. Operação bloqueada e registrada em auditoria.` });
      }
      const [lote] = await db.select().from(almoxLotes).where(eq(almoxLotes.id, input.loteId)).limit(1);
      if (!lote) throw new TRPCError({ code: "NOT_FOUND", message: "Lote não encontrado." });
      const qtd = parseFloat(input.quantidade);
      await db.update(almoxLotes).set({ quantidadeDisponivel: sql`quantidadeDisponivel - ${qtd}`, situacao: sql`CASE WHEN quantidadeDisponivel - ${qtd} <= 0 THEN 'esgotado' ELSE situacao END` }).where(eq(almoxLotes.id, input.loteId));
      await db.update(estoque).set({ quantidade: sql`quantidade - ${qtd}` }).where(and(eq(estoque.depositoId, lote.depositoId), eq(estoque.itemId, lote.itemId)));
      const valorBaixa = lote.valorUnitario ? String(parseFloat(String(lote.valorUnitario)) * qtd) : "0";
      const [r] = await db.insert(almoxBaixas).values({ loteId: input.loteId, depositoId: lote.depositoId, quantidade: input.quantidade, motivo: input.motivo, evidenciaDocRef: input.evidenciaDocRef, situacao: "executada", registradoPorId: ctx.user.id });
      await registrarAuditoria({ userId: ctx.user.id, acao: `BAIXA_ALMOX_${input.motivo.toUpperCase()}`, entidade: "almox_baixas", entidadeId: r.insertId, dadosDepois: { ...input, valorBaixa } });
      return { id: r.insertId, valorBaixa };
    }),
  }),

  // ─── ALM-011: Consumo e Curva ABC ─────────────────────────────────────────
  relatorios: router({
    consumo: protectedProcedure.input(z.object({
      ugId: z.number(), periodoInicio: z.string(), periodoFim: z.string(),
      agruparPor: z.enum(["unidade", "item", "categoria"]),
      formato: z.enum(["json", "csv", "xlsx"]).default("json"),
    })).query(async ({ input }) => {
      const db = await getDb();
      if (!db) return { linhas: [], curvaAbcValor: [], curvaAbcGiro: [] };
      const inicio = new Date(input.periodoInicio);
      const fim = new Date(input.periodoFim);
      const saidas = await db.select({
        itemId: movimentacoesAlmox.itemId, depositoId: movimentacoesAlmox.depositoId,
        quantidade: movimentacoesAlmox.quantidade, valorUnitario: movimentacoesAlmox.valorUnitario,
        createdAt: movimentacoesAlmox.createdAt,
        itemNome: almoxItens.nome, itemCodigo: almoxItens.codigo,
        itemCategoria: almoxItens.categoria, itemUnidade: almoxItens.unidadeMedida,
      }).from(movimentacoesAlmox)
        .leftJoin(almoxItens, eq(movimentacoesAlmox.itemId, almoxItens.id))
        .where(and(eq(movimentacoesAlmox.tipo, "saida"), gte(movimentacoesAlmox.createdAt, inicio), lte(movimentacoesAlmox.createdAt, fim)));
      // Agrupar por item
      const porItem = new Map<number, { itemId: number; itemNome: string; itemCodigo: string; categoria: string | null; unidade: string; qtdTotal: number; valorTotal: number; ocorrencias: number }>();
      for (const s of saidas) {
        const key = s.itemId;
        const qtd = parseFloat(String(s.quantidade));
        const vum = parseFloat(String(s.valorUnitario ?? "0"));
        const existing = porItem.get(key);
        if (existing) { existing.qtdTotal += qtd; existing.valorTotal += qtd * vum; existing.ocorrencias += 1; }
        else porItem.set(key, { itemId: key, itemNome: s.itemNome ?? "", itemCodigo: s.itemCodigo ?? "", categoria: s.itemCategoria ?? null, unidade: s.itemUnidade ?? "", qtdTotal: qtd, valorTotal: qtd * vum, ocorrencias: 1 });
      }
      const itens = Array.from(porItem.values());
      // Curva ABC por VALOR consumido (separada da curva por giro)
      const totalValor = itens.reduce((acc, i) => acc + i.valorTotal, 0);
      const porValor = [...itens].sort((a, b) => b.valorTotal - a.valorTotal);
      let acumValor = 0;
      const curvaAbcValor = porValor.map(i => {
        acumValor += i.valorTotal;
        const percAcum = totalValor > 0 ? (acumValor / totalValor) * 100 : 0;
        return { ...i, percValor: totalValor > 0 ? (i.valorTotal / totalValor) * 100 : 0, percAcumulado: percAcum, classe: percAcum <= 80 ? "A" : percAcum <= 95 ? "B" : "C" };
      });
      // Curva ABC por GIRO (ocorrências de saída) — análise separada
      const totalGiro = itens.reduce((acc, i) => acc + i.ocorrencias, 0);
      const porGiro = [...itens].sort((a, b) => b.ocorrencias - a.ocorrencias);
      let acumGiro = 0;
      const curvaAbcGiro = porGiro.map(i => {
        acumGiro += i.ocorrencias;
        const percAcum = totalGiro > 0 ? (acumGiro / totalGiro) * 100 : 0;
        return { ...i, percGiro: totalGiro > 0 ? (i.ocorrencias / totalGiro) * 100 : 0, percAcumulado: percAcum, classe: percAcum <= 80 ? "A" : percAcum <= 95 ? "B" : "C" };
      });
      return { linhas: itens, curvaAbcValor, curvaAbcGiro, totalValor, totalGiro };
    }),
  }),
});
