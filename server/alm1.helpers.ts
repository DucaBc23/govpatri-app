/**
 * Funções auxiliares testáveis da lógica ALM-1.
 * Exportadas separadamente para testes unitários sem banco de dados.
 */

export interface LoteSimulado {
  id: number;
  numeroLote: string;
  dataValidade: Date | null;
  dataEntrada: Date;
  quantidadeDisponivel: number;
  depositoId: number;
  situacao: "disponivel" | "quarentena" | "esgotado" | "vencido";
}

export interface ItemConsumo {
  itemId: number;
  itemNome: string;
  itemCodigo: string;
  categoria: string | null;
  unidade: string;
  qtdTotal: number;
  valorTotal: number;
  ocorrencias: number;
}

/**
 * Seleciona lotes por FEFO (First Expired, First Out).
 * Exclui lotes vencidos e lotes em quarentena.
 * Retorna os lotes ordenados por validade mais próxima primeiro.
 */
export function selecionarLotesFEFO(
  lotes: LoteSimulado[],
  hoje: Date,
): LoteSimulado[] {
  return lotes
    .filter(l =>
      l.situacao === "disponivel" &&
      l.quantidadeDisponivel > 0 &&
      (l.dataValidade === null || l.dataValidade >= hoje),
    )
    .sort((a, b) => {
      // Sem validade vai para o final (trata como validade infinita)
      if (a.dataValidade === null && b.dataValidade === null) return a.dataEntrada.getTime() - b.dataEntrada.getTime();
      if (a.dataValidade === null) return 1;
      if (b.dataValidade === null) return -1;
      const diff = a.dataValidade.getTime() - b.dataValidade.getTime();
      if (diff !== 0) return diff;
      return a.dataEntrada.getTime() - b.dataEntrada.getTime();
    });
}

/**
 * Simula o atendimento parcial de uma requisição com FEFO.
 * Retorna a quantidade debitada, o lote usado e o saldo pendente.
 */
export function simularAtendimentoParcial(
  lotes: LoteSimulado[],
  qtdSolicitada: number,
  qtdJaAtendida: number,
  hoje: Date,
): { qtdDebitada: number; loteUsadoId: number | null; saldoPendente: number; totalmenteAtendida: boolean } {
  const qtdPendente = qtdSolicitada - qtdJaAtendida;
  if (qtdPendente <= 0) return { qtdDebitada: 0, loteUsadoId: null, saldoPendente: 0, totalmenteAtendida: true };
  const lotesFEFO = selecionarLotesFEFO(lotes, hoje);
  if (lotesFEFO.length === 0) return { qtdDebitada: 0, loteUsadoId: null, saldoPendente: qtdPendente, totalmenteAtendida: false };
  const lote = lotesFEFO[0]!;
  const qtdDebitada = Math.min(qtdPendente, lote.quantidadeDisponivel);
  const saldoPendente = qtdPendente - qtdDebitada;
  const totalmenteAtendida = saldoPendente <= 0;
  return { qtdDebitada, loteUsadoId: lote.id, saldoPendente, totalmenteAtendida };
}

/**
 * Simula a devolução ao estoque.
 * Material íntegro retorna ao saldo disponível do lote de origem.
 * Avariado e vencido vão para quarentena.
 */
export function simularDevolucao(
  lote: LoteSimulado,
  quantidade: number,
  condicao: "integro" | "avariado" | "vencido",
): { retornouAoSaldo: boolean; novaQtdDisponivel: number; novaQtdQuarentena: number; novaSituacao: string } {
  if (condicao === "integro") {
    return {
      retornouAoSaldo: true,
      novaQtdDisponivel: lote.quantidadeDisponivel + quantidade,
      novaQtdQuarentena: 0,
      novaSituacao: "disponivel",
    };
  }
  return {
    retornouAoSaldo: false,
    novaQtdDisponivel: lote.quantidadeDisponivel,
    novaQtdQuarentena: quantidade,
    novaSituacao: "quarentena",
  };
}

/**
 * Calcula a Curva ABC por valor consumido.
 * A = acumulado até 80%, B = 80-95%, C = acima de 95%.
 */
export function calcularCurvaAbcValor(itens: ItemConsumo[]): (ItemConsumo & { percValor: number; percAcumulado: number; classe: "A" | "B" | "C" })[] {
  const totalValor = itens.reduce((acc, i) => acc + i.valorTotal, 0);
  const ordenados = [...itens].sort((a, b) => b.valorTotal - a.valorTotal);
  let acum = 0;
  return ordenados.map(i => {
    acum += i.valorTotal;
    const percAcum = totalValor > 0 ? (acum / totalValor) * 100 : 0;
    return {
      ...i,
      percValor: totalValor > 0 ? (i.valorTotal / totalValor) * 100 : 0,
      percAcumulado: percAcum,
      classe: percAcum <= 80 ? "A" : percAcum <= 95 ? "B" : "C",
    };
  });
}

/**
 * Calcula a Curva ABC por giro (ocorrências de saída).
 * Análise separada da curva por valor — podem produzir classificações diferentes.
 */
export function calcularCurvaAbcGiro(itens: ItemConsumo[]): (ItemConsumo & { percGiro: number; percAcumulado: number; classe: "A" | "B" | "C" })[] {
  const totalGiro = itens.reduce((acc, i) => acc + i.ocorrencias, 0);
  const ordenados = [...itens].sort((a, b) => b.ocorrencias - a.ocorrencias);
  let acum = 0;
  return ordenados.map(i => {
    acum += i.ocorrencias;
    const percAcum = totalGiro > 0 ? (acum / totalGiro) * 100 : 0;
    return {
      ...i,
      percGiro: totalGiro > 0 ? (i.ocorrencias / totalGiro) * 100 : 0,
      percAcumulado: percAcum,
      classe: percAcum <= 80 ? "A" : percAcum <= 95 ? "B" : "C",
    };
  });
}

