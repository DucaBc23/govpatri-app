/**
 * Worker de Alertas Preventivos
 * Verifica 9 tipos de alerta para uma UG.
 * Idempotente: não duplica alerta aberto para mesma entidade.
 * Resolve automaticamente alertas cuja condição deixou de existir.
 */
import { and, eq, lt, lte, ne, sql } from "drizzle-orm";
import {
  alertasAuditoria, almoxItens, bensMoveisTable, bensImoveis,
  cessoesImoveis, configuracoesSistema, estoque, inventarioColetas,
  inventarios, manutencoes, pendenciasImoveis, termosItens,
  termosResponsabilidade,
} from "../../drizzle/schema";
import { getDb } from "../db";

export interface EntradaAlertas {
  unidadeGestoraId: number;
}

export interface ResultadoAlertas {
  criados: number;
  atualizados: number;
  resolvidosPorNormalizacao: number;
  porTipo: Record<string, number>;
}

/** Criticidade padrão por tipo */
const CRITICIDADE: Record<string, "alta" | "media" | "baixa"> = {
  inconsistencia_contabil: "alta",
  cessao_vencida: "alta",
  pendencia_dominial: "alta",
  termo_pendente: "media",
  reavaliacao_vencida: "media",
  manutencao_vencida: "media",
  divergencia_recorrente: "media",
  estoque_minimo: "baixa",
  validade_proxima: "baixa",
};

/** Busca configuração do sistema com valor padrão */
async function getConfig(db: Awaited<ReturnType<typeof getDb>>, chave: string, padrao: number): Promise<number> {
  if (!db) return padrao;
  const [row] = await db.select().from(configuracoesSistema).where(eq(configuracoesSistema.chave, chave)).limit(1);
  return row ? parseInt(row.valor) : padrao;
}

/** Cria ou atualiza um alerta; retorna "criado" | "existia" */
async function upsertAlerta(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, params: {
  ugId: number; tipo: string; entidade: string; entidadeId: number; descricao: string;
}): Promise<"criado" | "existia"> {
  const tipo = params.tipo as typeof alertasAuditoria.$inferInsert["tipo"];
  const criticidade = CRITICIDADE[params.tipo] ?? "media";
  const [existente] = await db.select({ id: alertasAuditoria.id })
    .from(alertasAuditoria)
    .where(and(
      eq(alertasAuditoria.tipo, tipo),
      eq(alertasAuditoria.entidade, params.entidade),
      eq(alertasAuditoria.entidadeId, params.entidadeId),
      eq(alertasAuditoria.ugId, params.ugId),
      ne(alertasAuditoria.status, "resolvido"),
    )).limit(1);
  if (existente) return "existia";
  await db.insert(alertasAuditoria).values({
    ugId: params.ugId, tipo, entidade: params.entidade,
    entidadeId: params.entidadeId, criticidade, descricao: params.descricao,
  });
  return "criado";
}

/** Resolve alertas de um tipo/entidade quando a condição se normalizou */
async function resolverNormalizados(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, params: {
  ugId: number; tipo: string; entidade: string; idsAtivos: number[];
}): Promise<number> {
  // Busca alertas abertos que não estão na lista de IDs ativos
  const tipo = params.tipo as typeof alertasAuditoria.$inferInsert["tipo"];
  const abertos = await db.select({ id: alertasAuditoria.id, entidadeId: alertasAuditoria.entidadeId })
    .from(alertasAuditoria)
    .where(and(
      eq(alertasAuditoria.ugId, params.ugId),
      eq(alertasAuditoria.tipo, tipo),
      eq(alertasAuditoria.entidade, params.entidade),
      ne(alertasAuditoria.status, "resolvido"),
    ));
  let resolvidos = 0;
  for (const alerta of abertos) {
    if (!params.idsAtivos.includes(alerta.entidadeId)) {
      await db.update(alertasAuditoria).set({ status: "resolvido", resolvidoPorNormalizacao: true })
        .where(eq(alertasAuditoria.id, alerta.id));
      resolvidos++;
    }
  }
  return resolvidos;
}

export async function executarAlertas(entrada: EntradaAlertas): Promise<ResultadoAlertas> {
  const inicio = Date.now();
  const resultado: ResultadoAlertas = { criados: 0, atualizados: 0, resolvidosPorNormalizacao: 0, porTipo: {} };
  const ugId = entrada.unidadeGestoraId;

  const db = await getDb();
  if (!db) throw new Error("DB indisponível");

  const hoje = new Date();

  // Prazos configuráveis (padrões documentados)
  const diasTermoPendente = await getConfig(db, "alerta.termo_pendente.dias", 30);         // padrão: 30 dias
  const diasPendenciaDominial = await getConfig(db, "alerta.pendencia_dominial.dias", 90); // padrão: 90 dias
  const diasManutencaoVencida = await getConfig(db, "alerta.manutencao_vencida.dias", 0);  // padrão: vencida hoje
  const diasReavaliacaoVencida = await getConfig(db, "alerta.reavaliacao_vencida.dias", 1825); // padrão: 5 anos

  // ── 1. Termo pendente ────────────────────────────────────────────────────
  {
    const limiteData = new Date(hoje.getTime() - diasTermoPendente * 86400000);
    const bensComResponsavel = await db.select({ id: bensMoveisTable.id })
      .from(bensMoveisTable)
      .where(and(eq(bensMoveisTable.ugId, ugId), eq(bensMoveisTable.situacao, "ativo"), ne(bensMoveisTable.responsavelId, 0)));
    const bensComTermo = await db.select({ bemId: termosItens.bemId })
      .from(termosItens)
      .leftJoin(termosResponsabilidade, eq(termosItens.termoId, termosResponsabilidade.id))
      .where(and(eq(termosResponsabilidade.ugId, ugId), ne(termosResponsabilidade.situacao, "encerrado")));
    const idsComTermo = new Set(bensComTermo.map(b => b.bemId));
    const idsSemTermo: number[] = [];
    for (const bem of bensComResponsavel) {
      if (!idsComTermo.has(bem.id)) {
        const r = await upsertAlerta(db, { ugId, tipo: "termo_pendente", entidade: "bens_moveis", entidadeId: bem.id, descricao: `Bem sem termo de responsabilidade ativo há mais de ${diasTermoPendente} dias` });
        if (r === "criado") { resultado.criados++; resultado.porTipo["termo_pendente"] = (resultado.porTipo["termo_pendente"] ?? 0) + 1; }
        idsSemTermo.push(bem.id);
      }
    }
    resultado.resolvidosPorNormalizacao += await resolverNormalizados(db, { ugId, tipo: "termo_pendente", entidade: "bens_moveis", idsAtivos: idsSemTermo });
  }

  // ── 2. Pendência dominial ────────────────────────────────────────────────
  {
    const limiteData = new Date(hoje.getTime() - diasPendenciaDominial * 86400000);
    const pendencias = await db.select({ id: pendenciasImoveis.id, imovelId: pendenciasImoveis.imovelId })
      .from(pendenciasImoveis)
      .leftJoin(bensImoveis, eq(pendenciasImoveis.imovelId, bensImoveis.id))
      .where(and(eq(bensImoveis.ugId, ugId), ne(pendenciasImoveis.situacao, "resolvida"), lte(pendenciasImoveis.createdAt, limiteData)));
    const idsAtivos: number[] = [];
    for (const p of pendencias) {
      const r = await upsertAlerta(db, { ugId, tipo: "pendencia_dominial", entidade: "pendencias_imoveis", entidadeId: p.id, descricao: `Pendência dominial sem movimentação há mais de ${diasPendenciaDominial} dias` });
      if (r === "criado") { resultado.criados++; resultado.porTipo["pendencia_dominial"] = (resultado.porTipo["pendencia_dominial"] ?? 0) + 1; }
      idsAtivos.push(p.id);
    }
    resultado.resolvidosPorNormalizacao += await resolverNormalizados(db, { ugId, tipo: "pendencia_dominial", entidade: "pendencias_imoveis", idsAtivos });
  }

  // ── 3. Cessão vencida ────────────────────────────────────────────────────
  {
    const cessoesVencidas = await db.select({ id: cessoesImoveis.id })
      .from(cessoesImoveis)
      .leftJoin(bensImoveis, eq(cessoesImoveis.imovelId, bensImoveis.id))
      .where(and(eq(bensImoveis.ugId, ugId), eq(cessoesImoveis.situacao, "vigente"), lte(cessoesImoveis.dataFim, hoje)));
    const idsAtivos: number[] = [];
    for (const c of cessoesVencidas) {
      const r = await upsertAlerta(db, { ugId, tipo: "cessao_vencida", entidade: "cessoes_imoveis", entidadeId: c.id, descricao: "Cessão com prazo vencido sem devolução ou renovação registrada" });
      if (r === "criado") { resultado.criados++; resultado.porTipo["cessao_vencida"] = (resultado.porTipo["cessao_vencida"] ?? 0) + 1; }
      idsAtivos.push(c.id);
    }
    resultado.resolvidosPorNormalizacao += await resolverNormalizados(db, { ugId, tipo: "cessao_vencida", entidade: "cessoes_imoveis", idsAtivos });
  }

  // ── 4. Reavaliação vencida ───────────────────────────────────────────────
  {
    const limiteData = new Date(hoje.getTime() - diasReavaliacaoVencida * 86400000);
    const imoveisSemAval = await db.select({ id: bensImoveis.id })
      .from(bensImoveis)
      .where(and(eq(bensImoveis.ugId, ugId), lte(bensImoveis.dataAvaliacao, limiteData)));
    const idsAtivos: number[] = [];
    for (const im of imoveisSemAval) {
      const r = await upsertAlerta(db, { ugId, tipo: "reavaliacao_vencida", entidade: "bens_imoveis", entidadeId: im.id, descricao: `Imóvel sem avaliação nos últimos ${diasReavaliacaoVencida} dias` });
      if (r === "criado") { resultado.criados++; resultado.porTipo["reavaliacao_vencida"] = (resultado.porTipo["reavaliacao_vencida"] ?? 0) + 1; }
      idsAtivos.push(im.id);
    }
    resultado.resolvidosPorNormalizacao += await resolverNormalizados(db, { ugId, tipo: "reavaliacao_vencida", entidade: "bens_imoveis", idsAtivos });
  }

  // ── 5. Estoque mínimo ────────────────────────────────────────────────────
  {
    const itensAbaixo = await db.select({ id: almoxItens.id, nome: almoxItens.nome })
      .from(almoxItens)
      .leftJoin(estoque, eq(almoxItens.id, estoque.itemId))
      .where(and(
        sql`${estoque.quantidade} < ${almoxItens.estoqueMinimo}`,
        ne(almoxItens.estoqueMinimo, "0"),
      ));
    const idsAtivos: number[] = [];
    for (const item of itensAbaixo) {
      const r = await upsertAlerta(db, { ugId, tipo: "estoque_minimo", entidade: "almox_itens", entidadeId: item.id, descricao: `Item "${item.nome}" com saldo abaixo do estoque mínimo` });
      if (r === "criado") { resultado.criados++; resultado.porTipo["estoque_minimo"] = (resultado.porTipo["estoque_minimo"] ?? 0) + 1; }
      idsAtivos.push(item.id);
    }
    resultado.resolvidosPorNormalizacao += await resolverNormalizados(db, { ugId, tipo: "estoque_minimo", entidade: "almox_itens", idsAtivos });
  }

  // ── 6. Manutenção vencida ────────────────────────────────────────────────
  {
    const manutencoesVencidas = await db.select({ id: manutencoes.id })
      .from(manutencoes)
      .leftJoin(bensMoveisTable, eq(manutencoes.bemId, bensMoveisTable.id))
      .where(and(
        eq(bensMoveisTable.ugId, ugId),
        ne(manutencoes.situacao, "concluida"),
        lt(manutencoes.dataInicio, hoje),
      ));
    const idsAtivos: number[] = [];
    for (const m of manutencoesVencidas) {
      const r = await upsertAlerta(db, { ugId, tipo: "manutencao_vencida", entidade: "manutencoes", entidadeId: m.id, descricao: "Manutenção preventiva programada e vencida sem conclusão" });
      if (r === "criado") { resultado.criados++; resultado.porTipo["manutencao_vencida"] = (resultado.porTipo["manutencao_vencida"] ?? 0) + 1; }
      idsAtivos.push(m.id);
    }
    resultado.resolvidosPorNormalizacao += await resolverNormalizados(db, { ugId, tipo: "manutencao_vencida", entidade: "manutencoes", idsAtivos });
  }

  // ── 7. Divergência recorrente ────────────────────────────────────────────
  {
    const inventariosUg = await db.select({ id: inventarios.id })
      .from(inventarios)
      .where(and(eq(inventarios.ugId, ugId), eq(inventarios.situacao, "concluido")))
      .orderBy(sql`${inventarios.dataFim} DESC`).limit(2);
    if (inventariosUg.length >= 2) {
      const [inv1, inv2] = inventariosUg as [typeof inventariosUg[0], typeof inventariosUg[0]];
      // Bens com divergência nos dois inventários consecutivos
      const divs1 = await db.select({ bemId: inventarioColetas.bemId })
        .from(inventarioColetas)
        .where(and(eq(inventarioColetas.inventarioId, inv1.id), ne(inventarioColetas.situacaoEncontrada, "encontrado")));
      const divs2 = await db.select({ bemId: inventarioColetas.bemId })
        .from(inventarioColetas)
        .where(and(eq(inventarioColetas.inventarioId, inv2.id), ne(inventarioColetas.situacaoEncontrada, "encontrado")));
      const ids2 = new Set(divs2.map(d => d.bemId));
      const idsAtivos: number[] = [];
      for (const d of divs1) {
        if (ids2.has(d.bemId)) {
          const r = await upsertAlerta(db, { ugId, tipo: "divergencia_recorrente", entidade: "bens_moveis", entidadeId: d.bemId, descricao: "Bem com divergência não tratada em dois inventários consecutivos" });
          if (r === "criado") { resultado.criados++; resultado.porTipo["divergencia_recorrente"] = (resultado.porTipo["divergencia_recorrente"] ?? 0) + 1; }
          idsAtivos.push(d.bemId);
        }
      }
      resultado.resolvidosPorNormalizacao += await resolverNormalizados(db, { ugId, tipo: "divergencia_recorrente", entidade: "bens_moveis", idsAtivos });
    }
  }

  console.log(`[Worker Alertas] UG=${ugId} — criados=${resultado.criados} resolvidosPorNormalizacao=${resultado.resolvidosPorNormalizacao} duração=${Date.now() - inicio}ms`);
  return resultado;
}
