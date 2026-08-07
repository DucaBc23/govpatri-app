/**
 * Módulo MSC/SICONFI — Matriz de Saldos Contábeis
 *
 * Gera a matriz consolidada por conta contábil para uma UG e competência,
 * com saldo anterior, movimento a débito, movimento a crédito e saldo atual.
 *
 * IMPORTANTE: o layout oficial do arquivo MSC/SICONFI (RREO, RGF, etc.) deve
 * ser confirmado com o ente na implantação. A função `adaptarLayoutSiconfi`
 * abaixo é um adaptador isolado — layout a confirmar com o ente na implantação.
 * Não representa o layout oficial do SICONFI, que varia por exercício e módulo.
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { planoContas, eventosPatrimoniais, periodosContabeis } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

/** Linha da Matriz de Saldos Contábeis */
export interface LinhaMSC {
  /** Código da conta no PCASP */
  codigoConta: string;
  /** Nome da conta */
  nomeConta: string;
  /** Natureza: devedora ou credora */
  natureza: string;
  /** Tipo: ativo, passivo, patrimonio, receita, despesa, variacao */
  tipo: string;
  /** Saldo no início da competência (final da competência anterior) */
  saldoAnterior: number;
  /** Total de movimentos a débito na competência */
  movimentoDebito: number;
  /** Total de movimentos a crédito na competência */
  movimentoCredito: number;
  /** Saldo atual = saldoAnterior + débitos − créditos (conta devedora)
   *  ou saldoAnterior + créditos − débitos (conta credora) */
  saldoAtual: number;
}

/**
 * Calcula o saldo atual a partir do saldo anterior e dos movimentos,
 * respeitando a natureza da conta (devedora ou credora).
 *
 * Conta devedora: saldo aumenta com débito, diminui com crédito.
 * Conta credora:  saldo aumenta com crédito, diminui com débito.
 */
function calcularSaldoAtual(
  saldoAnterior: number,
  movimentoDebito: number,
  movimentoCredito: number,
  natureza: string,
): number {
  if (natureza === "devedora") {
    return saldoAnterior + movimentoDebito - movimentoCredito;
  }
  return saldoAnterior + movimentoCredito - movimentoDebito;
}

/**
 * Adaptador de layout MSC/SICONFI.
 *
 * LAYOUT A CONFIRMAR COM O ENTE NA IMPLANTAÇÃO.
 * Esta função gera um CSV com os campos mínimos esperados pelo SICONFI,
 * mas o separador, a codificação, os campos obrigatórios e a ordem das
 * colunas devem ser validados contra a especificação oficial do exercício.
 *
 * Referência: https://siconfi.tesouro.gov.br (acesso restrito ao ente)
 */
function adaptarLayoutSiconfi(linhas: LinhaMSC[], ugId: number, competencia: string): string {
  // LAYOUT A CONFIRMAR COM O ENTE NA IMPLANTAÇÃO
  const cabecalho = [
    "UG_ID",
    "COMPETENCIA",
    "CODIGO_CONTA",
    "NOME_CONTA",
    "NATUREZA",
    "TIPO",
    "SALDO_ANTERIOR",
    "MOVIMENTO_DEBITO",
    "MOVIMENTO_CREDITO",
    "SALDO_ATUAL",
  ].join(";");

  const linhasCSV = linhas.map((l) =>
    [
      ugId,
      competencia,
      l.codigoConta,
      `"${l.nomeConta.replace(/"/g, '""')}"`,
      l.natureza,
      l.tipo,
      l.saldoAnterior.toFixed(2),
      l.movimentoDebito.toFixed(2),
      l.movimentoCredito.toFixed(2),
      l.saldoAtual.toFixed(2),
    ].join(";"),
  );

  return [cabecalho, ...linhasCSV].join("\n");
}

/**
 * Gera o CSV padrão interno (separador vírgula, UTF-8).
 * Diferente do adaptarLayoutSiconfi, este é o formato de exportação
 * para uso interno e ferramentas de BI.
 */
function gerarCsvInterno(linhas: LinhaMSC[], ugId: number, competencia: string): string {
  const cabecalho = "ugId,competencia,codigoConta,nomeConta,natureza,tipo,saldoAnterior,movimentoDebito,movimentoCredito,saldoAtual";
  const rows = linhas.map((l) =>
    [
      ugId,
      competencia,
      l.codigoConta,
      `"${l.nomeConta.replace(/"/g, '""')}"`,
      l.natureza,
      l.tipo,
      l.saldoAnterior.toFixed(2),
      l.movimentoDebito.toFixed(2),
      l.movimentoCredito.toFixed(2),
      l.saldoAtual.toFixed(2),
    ].join(","),
  );
  return [cabecalho, ...rows].join("\n");
}

/** Dicionário de campos da MSC (documentado no código conforme requisito) */
export const DICIONARIO_MSC = {
  ugId: "Identificador da Unidade Gestora (FK → unidades_gestoras.id)",
  competencia: "Competência no formato AAAA-MM",
  codigoConta: "Código da conta no PCASP (ex: 1.1.1.1.1.00.00)",
  nomeConta: "Nome da conta conforme plano de contas",
  natureza: "Natureza da conta: 'devedora' ou 'credora'",
  saldoAnterior: "Saldo acumulado até o final da competência anterior (em R$)",
  movimentoDebito: "Soma dos valores lançados a débito na competência (em R$)",
  movimentoCredito: "Soma dos valores lançados a crédito na competência (em R$)",
  saldoAtual: "Saldo após os movimentos da competência (em R$). " +
    "Conta devedora: saldoAnterior + débitos − créditos. " +
    "Conta credora: saldoAnterior + créditos − débitos.",
};

export const mscRouter = router({
  /**
   * Gera a Matriz de Saldos Contábeis para uma UG e competência.
   * Retorna a matriz, o CSV interno, o JSON e o CSV no layout SICONFI
   * (layout a confirmar com o ente na implantação).
   */
  gerar: protectedProcedure
    .input(z.object({
      unidadeGestoraId: z.number().int().positive(),
      /** Competência no formato AAAA-MM, ex: "2026-01" */
      competencia: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado: AAAA-MM"),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      const [ano, mes] = input.competencia.split("-").map(Number);

      // 1. Buscar o período da competência solicitada
      const [periodo] = await db
        .select()
        .from(periodosContabeis)
        .where(
          and(
            eq(periodosContabeis.ugId, input.unidadeGestoraId),
            eq(periodosContabeis.ano, ano),
            eq(periodosContabeis.mes, mes),
          ),
        )
        .limit(1);

      // 2. Buscar o período anterior para calcular saldo anterior
      const mesPrev = mes === 1 ? 12 : mes - 1;
      const anoPrev = mes === 1 ? ano - 1 : ano;
      const [periodoPrev] = await db
        .select()
        .from(periodosContabeis)
        .where(
          and(
            eq(periodosContabeis.ugId, input.unidadeGestoraId),
            eq(periodosContabeis.ano, anoPrev),
            eq(periodosContabeis.mes, mesPrev),
          ),
        )
        .limit(1);

      // 3. Buscar todas as contas do plano de contas que aceitam lançamento
      const contas = await db
        .select()
        .from(planoContas)
        .where(and(eq(planoContas.aceitaLancamento, true), eq(planoContas.isActive, true)));

      if (contas.length === 0) {
        return {
          competencia: input.competencia,
          unidadeGestoraId: input.unidadeGestoraId,
          periodoId: periodo?.id ?? null,
          linhas: [] as LinhaMSC[],
          csvInterno: "",
          csvSiconfi: "// LAYOUT A CONFIRMAR COM O ENTE NA IMPLANTAÇÃO\n",
          json: JSON.stringify({ competencia: input.competencia, linhas: [] }, null, 2),
          dicionario: DICIONARIO_MSC,
        };
      }

      // 4. Calcular movimentos da competência por conta (débito e crédito)
      const movimentosCompetencia = new Map<number, { debito: number; credito: number }>();

      if (periodo) {
        // Movimentos a débito: eventos onde contaDebitoId = conta
        const debitosRows = await db
          .select({
            contaId: eventosPatrimoniais.contaDebitoId,
            total: sql<string>`SUM(${eventosPatrimoniais.valor})`,
          })
          .from(eventosPatrimoniais)
          .where(
            and(
              eq(eventosPatrimoniais.ugId, input.unidadeGestoraId),
              eq(eventosPatrimoniais.periodoId, periodo.id),
            ),
          )
          .groupBy(eventosPatrimoniais.contaDebitoId);

        for (const row of debitosRows) {
          const atual = movimentosCompetencia.get(row.contaId) ?? { debito: 0, credito: 0 };
          atual.debito += parseFloat(row.total ?? "0");
          movimentosCompetencia.set(row.contaId, atual);
        }

        // Movimentos a crédito: eventos onde contaCreditoId = conta
        const creditosRows = await db
          .select({
            contaId: eventosPatrimoniais.contaCreditoId,
            total: sql<string>`SUM(${eventosPatrimoniais.valor})`,
          })
          .from(eventosPatrimoniais)
          .where(
            and(
              eq(eventosPatrimoniais.ugId, input.unidadeGestoraId),
              eq(eventosPatrimoniais.periodoId, periodo.id),
            ),
          )
          .groupBy(eventosPatrimoniais.contaCreditoId);

        for (const row of creditosRows) {
          const atual = movimentosCompetencia.get(row.contaId) ?? { debito: 0, credito: 0 };
          atual.credito += parseFloat(row.total ?? "0");
          movimentosCompetencia.set(row.contaId, atual);
        }
      }

      // 5. Calcular saldo anterior por conta (soma de todos os movimentos até o período anterior)
      const saldosAnteriores = new Map<number, number>();

      if (periodoPrev) {
        // Buscar todos os períodos até o anterior (inclusive)
        const todosEventosAnteriores = await db
          .select({
            contaDebitoId: eventosPatrimoniais.contaDebitoId,
            contaCreditoId: eventosPatrimoniais.contaCreditoId,
            valor: eventosPatrimoniais.valor,
          })
          .from(eventosPatrimoniais)
          .innerJoin(periodosContabeis, eq(eventosPatrimoniais.periodoId, periodosContabeis.id))
          .where(
            and(
              eq(eventosPatrimoniais.ugId, input.unidadeGestoraId),
              sql`(${periodosContabeis.ano} < ${ano} OR (${periodosContabeis.ano} = ${ano} AND ${periodosContabeis.mes} < ${mes}))`,
            ),
          );

        for (const ev of todosEventosAnteriores) {
          const conta = contas.find((c) => c.id === ev.contaDebitoId);
          const valor = parseFloat(String(ev.valor));

          // Débito aumenta conta devedora, diminui conta credora
          const saldoDebito = saldosAnteriores.get(ev.contaDebitoId) ?? 0;
          const naturezaDebito = conta?.natureza ?? "devedora";
          saldosAnteriores.set(
            ev.contaDebitoId,
            naturezaDebito === "devedora" ? saldoDebito + valor : saldoDebito - valor,
          );

          // Crédito aumenta conta credora, diminui conta devedora
          const contaCredito = contas.find((c) => c.id === ev.contaCreditoId);
          const saldoCredito = saldosAnteriores.get(ev.contaCreditoId) ?? 0;
          const naturezaCredito = contaCredito?.natureza ?? "credora";
          saldosAnteriores.set(
            ev.contaCreditoId,
            naturezaCredito === "credora" ? saldoCredito + valor : saldoCredito - valor,
          );
        }
      }

      // 6. Montar a matriz — incluir apenas contas com movimento ou saldo anterior
      const linhas: LinhaMSC[] = [];
      for (const conta of contas) {
        const movs = movimentosCompetencia.get(conta.id) ?? { debito: 0, credito: 0 };
        const saldoAnterior = saldosAnteriores.get(conta.id) ?? 0;

        // Incluir na matriz apenas se houver saldo ou movimento
        if (saldoAnterior === 0 && movs.debito === 0 && movs.credito === 0) continue;

        const saldoAtual = calcularSaldoAtual(saldoAnterior, movs.debito, movs.credito, conta.natureza);

        linhas.push({
          codigoConta: conta.codigo,
          nomeConta: conta.nome,
          natureza: conta.natureza,
          tipo: conta.tipo,
          saldoAnterior,
          movimentoDebito: movs.debito,
          movimentoCredito: movs.credito,
          saldoAtual,
        });
      }

      // Ordenar por código de conta
      linhas.sort((a, b) => a.codigoConta.localeCompare(b.codigoConta));

      const csvInterno = gerarCsvInterno(linhas, input.unidadeGestoraId, input.competencia);
      const csvSiconfi = adaptarLayoutSiconfi(linhas, input.unidadeGestoraId, input.competencia);
      const json = JSON.stringify(
        {
          competencia: input.competencia,
          unidadeGestoraId: input.unidadeGestoraId,
          geradoEm: new Date().toISOString(),
          dicionario: DICIONARIO_MSC,
          linhas,
        },
        null,
        2,
      );

      return {
        competencia: input.competencia,
        unidadeGestoraId: input.unidadeGestoraId,
        periodoId: periodo?.id ?? null,
        linhas,
        csvInterno,
        csvSiconfi,
        json,
        dicionario: DICIONARIO_MSC,
      };
    }),
});
