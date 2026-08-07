/**
 * Worker do Índice de Saúde Patrimonial (ISP)
 * Calcula 6 dimensões normalizadas de 0 a 100 para uma UG e competência.
 * Dimensão não aplicável → null (excluída da média, não zero).
 * Idempotente: recalcular a mesma competência sobrescreve a linha existente.
 */
import { and, eq, ne, sql } from "drizzle-orm";
import {
  bensMoveisTable, bensImoveis, configuracoesSistema,
  indiceSaudePatrimonial, inventarioColetas, inventarios,
  pendenciasImoveis, termosItens, termosResponsabilidade,
} from "../../drizzle/schema";
import { getDb } from "../db";

export interface EntradaISP {
  unidadeGestoraId: number;
  competencia: string; // YYYY-MM
}

export interface ResultadoISP {
  ugId: number;
  competencia: string;
  completudeCadastral: number | null;
  aderenciaDocumental: number | null;
  tempestividadeInventario: number | null;
  tratamentoDivergencias: number | null;
  regularidadeDominial: number | null;
  regularidadeAvaliacoes: number | null;
  indiceGeral: number;
  totalBensAtivos: number;
}

/** Busca configuração com valor padrão numérico */
async function getConfig(db: NonNullable<Awaited<ReturnType<typeof getDb>>>, chave: string, padrao: number): Promise<number> {
  const [row] = await db.select().from(configuracoesSistema).where(eq(configuracoesSistema.chave, chave)).limit(1);
  return row ? parseFloat(row.valor) : padrao;
}

/** Média ponderada ignorando dimensões null */
function mediaPonderada(dimensoes: Array<{ valor: number | null; peso: number }>): number {
  const aplicaveis = dimensoes.filter(d => d.valor !== null) as Array<{ valor: number; peso: number }>;
  if (aplicaveis.length === 0) return 0;
  const somaPesos = aplicaveis.reduce((acc, d) => acc + d.peso, 0);
  const somaValores = aplicaveis.reduce((acc, d) => acc + d.valor * d.peso, 0);
  return somaPesos > 0 ? somaValores / somaPesos : 0;
}

export async function executarISP(entrada: EntradaISP): Promise<ResultadoISP> {
  const inicio = Date.now();
  const ugId = entrada.unidadeGestoraId;

  const db = await getDb();
  if (!db) throw new Error("DB indisponível");

  // Pesos configuráveis (padrão: iguais = 1.0 cada)
  const pesoCompletude = await getConfig(db, "isp.peso.completudeCadastral", 1.0);
  const pesoAderencia = await getConfig(db, "isp.peso.aderenciaDocumental", 1.0);
  const pesoInventario = await getConfig(db, "isp.peso.tempestividadeInventario", 1.0);
  const pesoDivergencias = await getConfig(db, "isp.peso.tratamentoDivergencias", 1.0);
  const pesoDominial = await getConfig(db, "isp.peso.regularidadeDominial", 1.0);
  const pesoAvaliacoes = await getConfig(db, "isp.peso.regularidadeAvaliacoes", 1.0);
  const diasValidadeAvaliacao = await getConfig(db, "isp.dias.validadeAvaliacao", 1825); // 5 anos
  const diasPeriodicidadeInventario = await getConfig(db, "isp.dias.periodicidadeInventario", 365); // 1 ano

  // Total de bens ativos
  const [totalRow] = await db.select({ total: sql<number>`COUNT(*)` })
    .from(bensMoveisTable)
    .where(and(eq(bensMoveisTable.ugId, ugId), eq(bensMoveisTable.situacao, "ativo")));
  const totalBensAtivos = Number(totalRow?.total ?? 0);

  // ── D1: Completude Cadastral ─────────────────────────────────────────────
  // Campos obrigatórios: descricao, valorAquisicao, classeId, localizacaoUaId, dataAquisicao
  let completudeCadastral: number | null = null;
  if (totalBensAtivos > 0) {
    const [completos] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(bensMoveisTable)
      .where(and(
        eq(bensMoveisTable.ugId, ugId),
        eq(bensMoveisTable.situacao, "ativo"),
        ne(bensMoveisTable.descricao, ""),
        sql`${bensMoveisTable.valorAquisicao} > 0`,
        sql`${bensMoveisTable.classeId} IS NOT NULL`,
        sql`${bensMoveisTable.localizacaoUaId} IS NOT NULL`,
        sql`${bensMoveisTable.dataAquisicao} IS NOT NULL`,
      ));
    completudeCadastral = Math.round((Number(completos?.total ?? 0) / totalBensAtivos) * 100);
  }

  // ── D2: Aderência Documental ─────────────────────────────────────────────
  // Percentual de bens com termo de responsabilidade ativo
  let aderenciaDocumental: number | null = null;
  if (totalBensAtivos > 0) {
    const bensComTermo = await db.select({ bemId: termosItens.bemId })
      .from(termosItens)
      .leftJoin(termosResponsabilidade, eq(termosItens.termoId, termosResponsabilidade.id))
      .where(and(eq(termosResponsabilidade.ugId, ugId), ne(termosResponsabilidade.situacao, "encerrado")));
    const idsComTermo = new Set(bensComTermo.map(b => b.bemId));
    aderenciaDocumental = Math.round((idsComTermo.size / totalBensAtivos) * 100);
  }

  // ── D3: Tempestividade do Inventário ────────────────────────────────────
  // Proximidade entre o último inventário concluído e a periodicidade configurada
  let tempestividadeInventario: number | null = null;
  const [ultimoInv] = await db.select({ dataFim: inventarios.dataFim })
    .from(inventarios)
    .where(and(eq(inventarios.ugId, ugId), eq(inventarios.situacao, "concluido")))
    .orderBy(sql`${inventarios.dataFim} DESC`).limit(1);
  if (ultimoInv?.dataFim) {
    const diasDesdeUltimo = Math.floor((Date.now() - new Date(ultimoInv.dataFim).getTime()) / 86400000);
    // Score: 100 se dentro da periodicidade, decai linearmente até 0 no dobro da periodicidade
    tempestividadeInventario = Math.max(0, Math.round(100 - (diasDesdeUltimo / diasPeriodicidadeInventario) * 100));
  }

  // ── D4: Tratamento de Divergências ──────────────────────────────────────
  let tratamentoDivergencias: number | null = null;
  const invsConcluidos = await db.select({ id: inventarios.id })
    .from(inventarios)
    .where(and(eq(inventarios.ugId, ugId), eq(inventarios.situacao, "concluido")));
  if (invsConcluidos.length > 0) {
    const ids = invsConcluidos.map(i => i.id);
    const [totalDiv] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(inventarioColetas)
      .where(and(
        sql`${inventarioColetas.inventarioId} IN (${sql.join(ids.map(id => sql`${id}`), sql`, `)})`,
        ne(inventarioColetas.situacaoEncontrada, "encontrado"),
      ));
    const total = Number(totalDiv?.total ?? 0);
    tratamentoDivergencias = total === 0 ? 100 : 0; // simplificado: sem divergências = 100
  }

  // ── D5: Regularidade Dominial ────────────────────────────────────────────
  let regularidadeDominial: number | null = null;
  const [totalImoveis] = await db.select({ total: sql<number>`COUNT(*)` })
    .from(bensImoveis).where(eq(bensImoveis.ugId, ugId));
  const totalImoveisN = Number(totalImoveis?.total ?? 0);
  if (totalImoveisN > 0) {
    const [semPendencia] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(bensImoveis)
      .where(and(eq(bensImoveis.ugId, ugId), eq(bensImoveis.situacaoDominial, "regular")));
    regularidadeDominial = Math.round((Number(semPendencia?.total ?? 0) / totalImoveisN) * 100);
  }

  // ── D6: Regularidade de Avaliações ──────────────────────────────────────
  let regularidadeAvaliacoes: number | null = null;
  if (totalImoveisN > 0) {
    const limiteAvaliacao = new Date(Date.now() - diasValidadeAvaliacao * 86400000);
    const [avaliadosRecentes] = await db.select({ total: sql<number>`COUNT(*)` })
      .from(bensImoveis)
      .where(and(
        eq(bensImoveis.ugId, ugId),
        sql`${bensImoveis.dataAvaliacao} >= ${limiteAvaliacao}`,
      ));
    regularidadeAvaliacoes = Math.round((Number(avaliadosRecentes?.total ?? 0) / totalImoveisN) * 100);
  }

  // ── Índice Geral ─────────────────────────────────────────────────────────
  const indiceGeral = Math.round(mediaPonderada([
    { valor: completudeCadastral, peso: pesoCompletude },
    { valor: aderenciaDocumental, peso: pesoAderencia },
    { valor: tempestividadeInventario, peso: pesoInventario },
    { valor: tratamentoDivergencias, peso: pesoDivergencias },
    { valor: regularidadeDominial, peso: pesoDominial },
    { valor: regularidadeAvaliacoes, peso: pesoAvaliacoes },
  ]));

  // ── Persistência (idempotente via onDuplicateKeyUpdate) ──────────────────
  await db.insert(indiceSaudePatrimonial).values({
    ugId,
    competencia: entrada.competencia,
    completudeCadastral: completudeCadastral !== null ? String(completudeCadastral) : null,
    aderenciaDocumental: aderenciaDocumental !== null ? String(aderenciaDocumental) : null,
    tempestividadeInventario: tempestividadeInventario !== null ? String(tempestividadeInventario) : null,
    tratamentoDivergencias: tratamentoDivergencias !== null ? String(tratamentoDivergencias) : null,
    regularidadeDominial: regularidadeDominial !== null ? String(regularidadeDominial) : null,
    regularidadeAvaliacoes: regularidadeAvaliacoes !== null ? String(regularidadeAvaliacoes) : null,
    indiceGeral: String(indiceGeral),
    totalBensAtivos,
  }).onDuplicateKeyUpdate({
    set: {
      completudeCadastral: completudeCadastral !== null ? String(completudeCadastral) : null,
      aderenciaDocumental: aderenciaDocumental !== null ? String(aderenciaDocumental) : null,
      tempestividadeInventario: tempestividadeInventario !== null ? String(tempestividadeInventario) : null,
      tratamentoDivergencias: tratamentoDivergencias !== null ? String(tratamentoDivergencias) : null,
      regularidadeDominial: regularidadeDominial !== null ? String(regularidadeDominial) : null,
      regularidadeAvaliacoes: regularidadeAvaliacoes !== null ? String(regularidadeAvaliacoes) : null,
      indiceGeral: String(indiceGeral),
      totalBensAtivos,
    },
  });

  const resultado: ResultadoISP = {
    ugId, competencia: entrada.competencia,
    completudeCadastral, aderenciaDocumental, tempestividadeInventario,
    tratamentoDivergencias, regularidadeDominial, regularidadeAvaliacoes,
    indiceGeral, totalBensAtivos,
  };

  console.log(`[Worker ISP] UG=${ugId} competência=${entrada.competencia} — indiceGeral=${indiceGeral} duração=${Date.now() - inicio}ms`);
  return resultado;
}
