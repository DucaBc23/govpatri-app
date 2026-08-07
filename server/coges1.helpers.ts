/**
 * Funções auxiliares testáveis da lógica MSC/SICONFI.
 * Exportadas separadamente para permitir testes unitários sem banco de dados.
 */
import type { LinhaMSC } from "./routers/msc";

/**
 * Calcula o saldo atual a partir do saldo anterior e dos movimentos.
 * Exportada para testes unitários.
 */
export function calcularSaldoAtualTestavel(
  saldoAnterior: number,
  movimentoDebito: number,
  movimentoCredito: number,
  natureza: "devedora" | "credora",
): number {
  if (natureza === "devedora") {
    return saldoAnterior + movimentoDebito - movimentoCredito;
  }
  return saldoAnterior + movimentoCredito - movimentoDebito;
}

/**
 * Monta a matriz MSC a partir de contas, movimentos e saldos anteriores.
 * Exportada para testes unitários — mesma lógica do mscRouter.gerar.
 */
export function montarMscTestavel(
  contas: { id: number; codigo: string; nome: string; natureza: "devedora" | "credora"; tipo: string }[],
  movimentos: Map<number, { debito: number; credito: number }>,
  saldosAnteriores: Map<number, number>,
): LinhaMSC[] {
  const linhas: LinhaMSC[] = [];
  for (const conta of contas) {
    const movs = movimentos.get(conta.id) ?? { debito: 0, credito: 0 };
    const saldoAnterior = saldosAnteriores.get(conta.id) ?? 0;
    if (saldoAnterior === 0 && movs.debito === 0 && movs.credito === 0) continue;
    const saldoAtual = calcularSaldoAtualTestavel(saldoAnterior, movs.debito, movs.credito, conta.natureza);
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
  return linhas.sort((a, b) => a.codigoConta.localeCompare(b.codigoConta));
}

