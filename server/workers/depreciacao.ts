/**
 * Worker de Depreciação Mensal
 * Calcula a depreciação pelo método linear para bens móveis e imóveis.
 * Idempotente: reexecução pula bens já processados na competência.
 * Terrenos não depreciam; métodos não implementados retornam não elegível.
 */
import { and, eq, lte, sql } from "drizzle-orm";
import {
  bensMoveisTable, bensImoveis, classesBens,
  depreciacaoMensal, eventosPatrimoniais, periodosContabeis,
  planoContas,
} from "../../drizzle/schema";
import { getDb } from "../db";

export interface EntradaDepreciacao {
  unidadeGestoraId: number;
  competencia: string; // YYYY-MM
}

export interface ResultadoDepreciacao {
  processados: number;
  pulados: number;
  naoElegiveis: number;
  valorTotalDepreciado: number;
  erros: Array<{ entidade: string; entidadeId: number; motivo: string }>;
}

/** Último dia do mês a partir de YYYY-MM */
function ultimoDiaMes(competencia: string): Date {
  const [ano, mes] = competencia.split("-").map(Number) as [number, number];
  return new Date(ano, mes, 0); // dia 0 do próximo mês = último dia do mês atual
}

/** Calcula depreciação linear de um bem, retorna null se não elegível */
function calcularLinear(params: {
  valorAquisicao: number;
  valorResidualPerc: number;
  vidaUtilMeses: number;
  depreciacaoAcumuladaAnterior: number;
}): { depreciacaoMes: number; depreciacaoAcumuladaAtual: number; valorLiquido: number } | null {
  const { valorAquisicao, valorResidualPerc, vidaUtilMeses, depreciacaoAcumuladaAnterior } = params;
  const valorResidual = valorAquisicao * (valorResidualPerc / 100);
  const baseDepreciavel = valorAquisicao - valorResidual;

  // Bem já integralmente depreciado
  if (depreciacaoAcumuladaAnterior >= baseDepreciavel) return null;

  const depreciacaoParcela = baseDepreciavel / vidaUtilMeses;
  const restante = baseDepreciavel - depreciacaoAcumuladaAnterior;

  // Último mês: ajusta para fechar exatamente sem resíduo de centavos
  const depreciacaoMes = Math.min(depreciacaoParcela, restante);
  const depreciacaoAcumuladaAtual = depreciacaoAcumuladaAnterior + depreciacaoMes;
  const valorLiquido = valorAquisicao - depreciacaoAcumuladaAtual;

  return { depreciacaoMes, depreciacaoAcumuladaAtual, valorLiquido };
}

export async function executarDepreciacao(entrada: EntradaDepreciacao): Promise<ResultadoDepreciacao> {
  const inicio = Date.now();
  const resultado: ResultadoDepreciacao = { processados: 0, pulados: 0, naoElegiveis: 0, valorTotalDepreciado: 0, erros: [] };

  const db = await getDb();
  if (!db) throw new Error("DB indisponível");

  // Guarda: verificar se o período está fechado
  const dataFim = ultimoDiaMes(entrada.competencia);
  const [ano, mes] = entrada.competencia.split("-").map(Number) as [number, number];
  const [periodo] = await db.select().from(periodosContabeis)
    .where(and(
      eq(periodosContabeis.ugId, entrada.unidadeGestoraId),
      eq(periodosContabeis.ano, ano),
      eq(periodosContabeis.mes, mes),
    )).limit(1);

  if (periodo?.situacao === "fechado") {
    return { ...resultado, erros: [{ entidade: "periodo", entidadeId: periodo.id, motivo: "Período já fechado — depreciação bloqueada" }] };
  }

  // Buscar conta de depreciação padrão no plano de contas
  const [contaDepr] = await db.select().from(planoContas)
    .where(and(eq(planoContas.tipo, "variacao"), eq(planoContas.isActive, true))).limit(1);

  // ── Bens Móveis ──────────────────────────────────────────────────────────
  const bens = await db.select({
    id: bensMoveisTable.id,
    valorAquisicao: bensMoveisTable.valorAquisicao,
    valorAtual: bensMoveisTable.valorAtual,
    classeId: bensMoveisTable.classeId,
    vidaUtilAnos: classesBens.vidaUtilAnos,
    taxaDepreciacaoAnual: classesBens.taxaDepreciacaoAnual,
    valorResidualPerc: classesBens.valorResidualPerc,
    contaPcasp: classesBens.contaPcasp,
  }).from(bensMoveisTable)
    .leftJoin(classesBens, eq(bensMoveisTable.classeId, classesBens.id))
    .where(and(
      eq(bensMoveisTable.ugId, entrada.unidadeGestoraId),
      eq(bensMoveisTable.situacao, "ativo"),
    ));

  for (const bem of bens) {
    try {
      // Verificar idempotência: já foi processado nesta competência?
      const [jaProcessado] = await db.select({ id: depreciacaoMensal.id })
        .from(depreciacaoMensal)
        .where(and(
          eq(depreciacaoMensal.bemId, bem.id),
          eq(depreciacaoMensal.periodoId, periodo?.id ?? 0),
        )).limit(1);

      if (jaProcessado) { resultado.pulados++; continue; }

      // Verificar elegibilidade
      if (!bem.valorAquisicao || parseFloat(String(bem.valorAquisicao)) <= 0) {
        resultado.naoElegiveis++;
        resultado.erros.push({ entidade: "bens_moveis", entidadeId: bem.id, motivo: "valorAquisicao ausente ou zero" });
        continue;
      }
      if (!bem.vidaUtilAnos || !bem.taxaDepreciacaoAnual) {
        resultado.naoElegiveis++;
        resultado.erros.push({ entidade: "bens_moveis", entidadeId: bem.id, motivo: "Classe sem vidaUtilAnos ou taxaDepreciacaoAnual" });
        continue;
      }

      const valorAquisicao = parseFloat(String(bem.valorAquisicao));
      const valorResidualPerc = parseFloat(String(bem.valorResidualPerc ?? "10")) * 100; // schema guarda como 0.10 = 10%
      const vidaUtilMeses = bem.vidaUtilAnos * 12;

      // Depreciação acumulada anterior (soma de todas as linhas anteriores)
      const [acumRow] = await db.select({ total: sql<string>`COALESCE(SUM(valorDepreciado), 0)` })
        .from(depreciacaoMensal)
        .where(eq(depreciacaoMensal.bemId, bem.id));
      const depreciacaoAcumuladaAnterior = parseFloat(String(acumRow?.total ?? "0"));

      const calc = calcularLinear({ valorAquisicao, valorResidualPerc, vidaUtilMeses, depreciacaoAcumuladaAnterior });
      if (!calc) { resultado.naoElegiveis++; continue; } // já totalmente depreciado

      // Inserir evento patrimonial de depreciação
      let eventoId: number | undefined;
      if (periodo && contaDepr) {
        const [evRow] = await db.insert(eventosPatrimoniais).values({
          ugId: entrada.unidadeGestoraId,
          periodoId: periodo.id,
          tipo: "depreciacao",
          bemMovelId: bem.id,
          contaDebitoId: contaDepr.id,
          contaCreditoId: contaDepr.id,
          valor: String(calc.depreciacaoMes.toFixed(2)),
          historico: `Depreciação mensal — competência ${entrada.competencia}`,
          createdByUserId: 1, // sistema
        });
        eventoId = evRow.insertId;
      }

      // Inserir linha de depreciação (idempotente via onDuplicateKeyUpdate)
      await db.insert(depreciacaoMensal).values({
        bemId: bem.id,
        ugId: entrada.unidadeGestoraId,
        periodoId: periodo?.id ?? 0,
        valorDepreciado: String(calc.depreciacaoMes.toFixed(2)),
        valorAcumulado: String(calc.depreciacaoAcumuladaAtual.toFixed(2)),
        valorResidual: String((valorAquisicao * (valorResidualPerc / 100)).toFixed(2)),
        eventoId,
      }).onDuplicateKeyUpdate({ set: { valorDepreciado: String(calc.depreciacaoMes.toFixed(2)) } });

      // Atualizar valorAtual do bem
      await db.update(bensMoveisTable)
        .set({ valorAtual: String(calc.valorLiquido.toFixed(2)) })
        .where(eq(bensMoveisTable.id, bem.id));

      resultado.processados++;
      resultado.valorTotalDepreciado += calc.depreciacaoMes;
    } catch (err) {
      resultado.erros.push({ entidade: "bens_moveis", entidadeId: bem.id, motivo: String(err) });
    }
  }

  // ── Bens Imóveis ─────────────────────────────────────────────────────────
  const imoveis = await db.select().from(bensImoveis)
    .where(eq(bensImoveis.ugId, entrada.unidadeGestoraId));

  for (const imovel of imoveis) {
    try {
      // Terrenos não depreciam
      if (imovel.tipo === "terreno") {
        resultado.naoElegiveis++;
        resultado.erros.push({ entidade: "bens_imoveis", entidadeId: imovel.id, motivo: "Terreno não deprecia" });
        continue;
      }
      // Sem valor de avaliação não é possível calcular
      if (!imovel.valorAvaliacao || parseFloat(String(imovel.valorAvaliacao)) <= 0) {
        resultado.naoElegiveis++;
        resultado.erros.push({ entidade: "bens_imoveis", entidadeId: imovel.id, motivo: "valorAvaliacao ausente — não é possível separar terreno de edificação" });
        continue;
      }
      // Idempotência
      const [jaProcessado] = await db.select({ id: depreciacaoMensal.id })
        .from(depreciacaoMensal)
        .where(and(
          eq(depreciacaoMensal.bemId, imovel.id),
          eq(depreciacaoMensal.periodoId, periodo?.id ?? 0),
        )).limit(1);
      if (jaProcessado) { resultado.pulados++; continue; }

      // Vida útil padrão de edificações: 25 anos, residual 10%
      const valorAquisicao = parseFloat(String(imovel.valorAvaliacao));
      const vidaUtilMeses = 25 * 12;
      const valorResidualPerc = 10;
      const [acumRow] = await db.select({ total: sql<string>`COALESCE(SUM(valorDepreciado), 0)` })
        .from(depreciacaoMensal).where(eq(depreciacaoMensal.bemId, imovel.id));
      const depreciacaoAcumuladaAnterior = parseFloat(String(acumRow?.total ?? "0"));

      const calc = calcularLinear({ valorAquisicao, valorResidualPerc, vidaUtilMeses, depreciacaoAcumuladaAnterior });
      if (!calc) { resultado.naoElegiveis++; continue; }

      await db.insert(depreciacaoMensal).values({
        bemId: imovel.id,
        ugId: entrada.unidadeGestoraId,
        periodoId: periodo?.id ?? 0,
        valorDepreciado: String(calc.depreciacaoMes.toFixed(2)),
        valorAcumulado: String(calc.depreciacaoAcumuladaAtual.toFixed(2)),
        valorResidual: String((valorAquisicao * (valorResidualPerc / 100)).toFixed(2)),
      }).onDuplicateKeyUpdate({ set: { valorDepreciado: String(calc.depreciacaoMes.toFixed(2)) } });

      resultado.processados++;
      resultado.valorTotalDepreciado += calc.depreciacaoMes;
    } catch (err) {
      resultado.erros.push({ entidade: "bens_imoveis", entidadeId: imovel.id, motivo: String(err) });
    }
  }

  console.log(`[Worker Depreciação] UG=${entrada.unidadeGestoraId} competência=${entrada.competencia} — processados=${resultado.processados} pulados=${resultado.pulados} naoElegiveis=${resultado.naoElegiveis} valorTotal=${resultado.valorTotalDepreciado.toFixed(2)} duração=${Date.now() - inicio}ms`);
  return resultado;
}

/** Exporta a função de cálculo puro para uso nos testes unitários */
export { calcularLinear };
