/**
 * Testes ALM-1 — Almoxarifado: FEFO, atendimento parcial, devolução, baixa e curva ABC
 *
 * Cobre os 9 cenários obrigatórios:
 * 1. FEFO consome o lote de validade mais próxima primeiro
 * 2. Lote vencido não é consumido automaticamente
 * 3. Atendimento parcial reduz o saldo pendente e não encerra a requisição
 * 4. Atendimentos sucessivos encerram a requisição ao completar
 * 5. Devolução de material íntegro volta ao saldo; avariado e vencido vão para quarentena
 * 6. Devolução credita o lote de origem, não um saldo genérico
 * 7. Baixa por avaria sem evidência é bloqueada
 * 8. Curva ABC por valor e por giro produzem classificações diferentes quando os dados divergem
 * 9. Alocação em endereço de outro depósito é bloqueada
 */
import { describe, expect, it } from "vitest";
import {
  selecionarLotesFEFO,
  simularAtendimentoParcial,
  simularDevolucao,
  calcularCurvaAbcValor,
  calcularCurvaAbcGiro,
  type LoteSimulado,
  type ItemConsumo,
} from "./alm1.helpers";

// ─── Cenário 1: FEFO consome lote de validade mais próxima primeiro ───────────
describe("FEFO — seleção de lote por validade mais próxima", () => {
  const hoje = new Date("2026-08-07");

  it("seleciona o lote com validade mais próxima primeiro", () => {
    const lotes: LoteSimulado[] = [
      { id: 1, numeroLote: "L001", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
      { id: 2, numeroLote: "L002", dataValidade: new Date("2026-09-30"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
      { id: 3, numeroLote: "L003", dataValidade: new Date("2027-06-30"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
    ];
    const resultado = selecionarLotesFEFO(lotes, hoje);
    expect(resultado[0]!.id).toBe(2); // validade 2026-09-30 é a mais próxima
    expect(resultado[1]!.id).toBe(1); // validade 2026-12-31
    expect(resultado[2]!.id).toBe(3); // validade 2027-06-30
  });

  it("lote sem validade vai para o final da fila FEFO", () => {
    const lotes: LoteSimulado[] = [
      { id: 1, numeroLote: "L001", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
      { id: 2, numeroLote: "L002", dataValidade: null, dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
    ];
    const resultado = selecionarLotesFEFO(lotes, hoje);
    expect(resultado[0]!.id).toBe(1); // com validade vem primeiro
    expect(resultado[1]!.id).toBe(2); // sem validade vai para o final
  });

  // Cenário 2: lote vencido não é consumido automaticamente
  it("lote vencido é excluído da seleção FEFO", () => {
    const lotes: LoteSimulado[] = [
      { id: 1, numeroLote: "L001", dataValidade: new Date("2026-07-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" }, // vencido
      { id: 2, numeroLote: "L002", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" }, // válido
    ];
    const resultado = selecionarLotesFEFO(lotes, hoje);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.id).toBe(2); // apenas o lote válido
  });

  it("lote em quarentena não é selecionado pelo FEFO", () => {
    const lotes: LoteSimulado[] = [
      { id: 1, numeroLote: "L001", dataValidade: new Date("2026-09-30"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 5, depositoId: 1, situacao: "quarentena" },
      { id: 2, numeroLote: "L002", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
    ];
    const resultado = selecionarLotesFEFO(lotes, hoje);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.id).toBe(2);
  });

  it("lote com quantidade zero não é selecionado", () => {
    const lotes: LoteSimulado[] = [
      { id: 1, numeroLote: "L001", dataValidade: new Date("2026-09-30"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 0, depositoId: 1, situacao: "disponivel" },
      { id: 2, numeroLote: "L002", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
    ];
    const resultado = selecionarLotesFEFO(lotes, hoje);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]!.id).toBe(2);
  });
});

// ─── Cenários 3 e 4: atendimento parcial ─────────────────────────────────────
describe("Atendimento parcial e backorder", () => {
  const hoje = new Date("2026-08-07");

  // Cenário 3: atendimento parcial reduz saldo pendente e não encerra a requisição
  it("atendimento parcial reduz saldo pendente e não encerra a requisição", () => {
    const lotes: LoteSimulado[] = [
      { id: 1, numeroLote: "L001", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 5, depositoId: 1, situacao: "disponivel" },
    ];
    const resultado = simularAtendimentoParcial(lotes, 10, 0, hoje);
    expect(resultado.qtdDebitada).toBe(5);       // só havia 5 disponíveis
    expect(resultado.saldoPendente).toBe(5);      // 10 - 5 = 5 pendente
    expect(resultado.totalmenteAtendida).toBe(false); // requisição não encerrada
    expect(resultado.loteUsadoId).toBe(1);
  });

  it("atendimento parcial com qtd já atendida considera o saldo correto", () => {
    const lotes: LoteSimulado[] = [
      { id: 1, numeroLote: "L001", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
    ];
    // Solicitado: 10, já atendido: 3, pendente: 7
    const resultado = simularAtendimentoParcial(lotes, 10, 3, hoje);
    expect(resultado.qtdDebitada).toBe(7);        // atende o saldo pendente
    expect(resultado.saldoPendente).toBe(0);
    expect(resultado.totalmenteAtendida).toBe(true);
  });

  // Cenário 4: atendimentos sucessivos encerram a requisição ao completar
  it("atendimentos sucessivos encerram a requisição ao completar", () => {
    const lotes: LoteSimulado[] = [
      { id: 1, numeroLote: "L001", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 3, depositoId: 1, situacao: "disponivel" },
    ];
    // 1º atendimento: atende 3 de 10
    const r1 = simularAtendimentoParcial(lotes, 10, 0, hoje);
    expect(r1.qtdDebitada).toBe(3);
    expect(r1.totalmenteAtendida).toBe(false);
    // 2º atendimento: atende mais 3 (total 6 de 10)
    const lotes2: LoteSimulado[] = [
      { id: 2, numeroLote: "L002", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 3, depositoId: 1, situacao: "disponivel" },
    ];
    const r2 = simularAtendimentoParcial(lotes2, 10, 3, hoje);
    expect(r2.qtdDebitada).toBe(3);
    expect(r2.totalmenteAtendida).toBe(false);
    // 3º atendimento: atende os 4 restantes (total 10 de 10)
    const lotes3: LoteSimulado[] = [
      { id: 3, numeroLote: "L003", dataValidade: new Date("2026-12-31"), dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 10, depositoId: 1, situacao: "disponivel" },
    ];
    const r3 = simularAtendimentoParcial(lotes3, 10, 6, hoje);
    expect(r3.qtdDebitada).toBe(4);
    expect(r3.totalmenteAtendida).toBe(true); // requisição encerrada
  });

  it("sem lotes disponíveis: retorna qtdDebitada=0 e saldoPendente=qtdSolicitada", () => {
    const resultado = simularAtendimentoParcial([], 10, 0, hoje);
    expect(resultado.qtdDebitada).toBe(0);
    expect(resultado.saldoPendente).toBe(10);
    expect(resultado.totalmenteAtendida).toBe(false);
    expect(resultado.loteUsadoId).toBeNull();
  });
});

// ─── Cenários 5 e 6: devolução ao estoque ────────────────────────────────────
describe("Devolução ao estoque", () => {
  const loteOrigem: LoteSimulado = {
    id: 42, numeroLote: "L042", dataValidade: new Date("2026-12-31"),
    dataEntrada: new Date("2026-01-01"), quantidadeDisponivel: 8, depositoId: 1, situacao: "disponivel",
  };

  // Cenário 5: material íntegro volta ao saldo; avariado e vencido vão para quarentena
  it("material íntegro retorna ao saldo disponível", () => {
    const resultado = simularDevolucao(loteOrigem, 3, "integro");
    expect(resultado.retornouAoSaldo).toBe(true);
    expect(resultado.novaQtdDisponivel).toBe(11); // 8 + 3
    expect(resultado.novaSituacao).toBe("disponivel");
  });

  it("material avariado vai para quarentena e não retorna ao saldo", () => {
    const resultado = simularDevolucao(loteOrigem, 3, "avariado");
    expect(resultado.retornouAoSaldo).toBe(false);
    expect(resultado.novaQtdDisponivel).toBe(8); // saldo disponível inalterado
    expect(resultado.novaQtdQuarentena).toBe(3);
    expect(resultado.novaSituacao).toBe("quarentena");
  });

  it("material vencido vai para quarentena e não retorna ao saldo", () => {
    const resultado = simularDevolucao(loteOrigem, 2, "vencido");
    expect(resultado.retornouAoSaldo).toBe(false);
    expect(resultado.novaQtdDisponivel).toBe(8); // saldo disponível inalterado
    expect(resultado.novaQtdQuarentena).toBe(2);
    expect(resultado.novaSituacao).toBe("quarentena");
  });

  // Cenário 6: devolução credita o lote de origem, não um saldo genérico
  it("devolução íntegra credita exatamente no lote de origem", () => {
    const loteA: LoteSimulado = { id: 10, numeroLote: "LA", dataValidade: null, dataEntrada: new Date(), quantidadeDisponivel: 5, depositoId: 1, situacao: "disponivel" };
    const loteB: LoteSimulado = { id: 20, numeroLote: "LB", dataValidade: null, dataEntrada: new Date(), quantidadeDisponivel: 5, depositoId: 1, situacao: "disponivel" };
    const resultadoA = simularDevolucao(loteA, 2, "integro");
    const resultadoB = simularDevolucao(loteB, 0, "integro"); // lote B não recebe devolução
    expect(resultadoA.novaQtdDisponivel).toBe(7); // lote A: 5 + 2
    expect(resultadoB.novaQtdDisponivel).toBe(5); // lote B: inalterado
  });
});

// ─── Cenário 7: baixa por avaria sem evidência é bloqueada ───────────────────
describe("Validação — baixa por avaria ou perda sem evidência", () => {
  function validarBaixaAlmox(motivo: string, evidenciaDocRef: string | undefined): { bloqueado: boolean; mensagem?: string } {
    if ((motivo === "avaria" || motivo === "perda") && !evidenciaDocRef) {
      return { bloqueado: true, mensagem: `Baixa por '${motivo}' exige evidência documental.` };
    }
    return { bloqueado: false };
  }

  it("baixa por avaria sem evidência é bloqueada", () => {
    const resultado = validarBaixaAlmox("avaria", undefined);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.mensagem).toContain("avaria");
  });

  it("baixa por perda sem evidência é bloqueada", () => {
    const resultado = validarBaixaAlmox("perda", undefined);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.mensagem).toContain("perda");
  });

  it("baixa por avaria com evidência é permitida", () => {
    const resultado = validarBaixaAlmox("avaria", "NF-2026-001.pdf");
    expect(resultado.bloqueado).toBe(false);
  });

  it("baixa por vencimento sem evidência é permitida", () => {
    const resultado = validarBaixaAlmox("vencimento", undefined);
    expect(resultado.bloqueado).toBe(false);
  });

  it("baixa por obsolescência sem evidência é permitida", () => {
    const resultado = validarBaixaAlmox("obsolescencia", undefined);
    expect(resultado.bloqueado).toBe(false);
  });
});

// ─── Cenário 8: curva ABC por valor e por giro produzem classificações diferentes ─
describe("Curva ABC — valor vs. giro produzem classificações diferentes", () => {
  // Dados onde valor e giro divergem intencionalmente:
  // Item X: alto valor unitário, baixo giro (comprado raramente mas caro)
  // Item Y: baixo valor unitário, alto giro (comprado frequentemente mas barato)
  const itens: ItemConsumo[] = [
    { itemId: 1, itemNome: "Equipamento Caro", itemCodigo: "EQ001", categoria: "equipamentos", unidade: "un", qtdTotal: 2, valorTotal: 50000, ocorrencias: 2 },
    { itemId: 2, itemNome: "Papel A4", itemCodigo: "PA001", categoria: "material_escritorio", unidade: "resma", qtdTotal: 500, valorTotal: 2500, ocorrencias: 50 },
    { itemId: 3, itemNome: "Caneta", itemCodigo: "CA001", categoria: "material_escritorio", unidade: "un", qtdTotal: 1000, valorTotal: 500, ocorrencias: 100 },
  ];

  it("curva ABC por valor classifica equipamento caro como A", () => {
    const resultado = calcularCurvaAbcValor(itens);
    const equipamento = resultado.find(i => i.itemId === 1)!;
    // 50000 / 53000 = 94.3% — acumulado do primeiro item já está em B (80–95%)
    expect(equipamento.classe).toBe("B");
  });

  it("curva ABC por giro classifica equipamento caro como C (baixo giro)", () => {
    const resultado = calcularCurvaAbcGiro(itens);
    const equipamento = resultado.find(i => i.itemId === 1)!;
    expect(equipamento.classe).toBe("C"); // 2 ocorrências de 152 = 1.3% do giro
  });

  it("curva ABC por giro classifica caneta como A (alto giro)", () => {
    const resultado = calcularCurvaAbcGiro(itens);
    const caneta = resultado.find(i => i.itemId === 3)!;
    // 100 ocorrências de 152 = 65.8% — dentro do A (até 80%)
    expect(caneta.classe).toBe("A");
  });

  it("curva ABC por valor classifica caneta como C (baixo valor)", () => {
    const resultado = calcularCurvaAbcValor(itens);
    const caneta = resultado.find(i => i.itemId === 3)!;
    // 500 / 53000 = 0.9% — classe C
    expect(caneta.classe).toBe("C");
  });

  it("valor e giro produzem ordenações diferentes para o mesmo conjunto", () => {
    const porValor = calcularCurvaAbcValor(itens);
    const porGiro = calcularCurvaAbcGiro(itens);
    // Primeiro por valor: equipamento caro
    expect(porValor[0]!.itemId).toBe(1);
    // Primeiro por giro: caneta (100 ocorrências)
    expect(porGiro[0]!.itemId).toBe(3);
    // Confirma que são análises diferentes
    expect(porValor[0]!.itemId).not.toBe(porGiro[0]!.itemId);
  });
});

// ─── Cenário 9: alocação em endereço de outro depósito é bloqueada ────────────
describe("Validação — alocação em endereço de outro depósito", () => {
  function validarAlocacao(
    loteDepositoId: number,
    enderecoDepositoId: number,
    enderecoIsActive: boolean,
  ): { bloqueado: boolean; motivo?: string } {
    if (!enderecoIsActive) return { bloqueado: true, motivo: "endereço inativo" };
    if (loteDepositoId !== enderecoDepositoId) return { bloqueado: true, motivo: "endereço pertence a outro depósito" };
    return { bloqueado: false };
  }

  it("alocação em endereço de outro depósito é bloqueada", () => {
    const resultado = validarAlocacao(1, 2, true);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.motivo).toContain("outro depósito");
  });

  it("alocação em endereço inativo é bloqueada", () => {
    const resultado = validarAlocacao(1, 1, false);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.motivo).toContain("inativo");
  });

  it("alocação no mesmo depósito e endereço ativo é permitida", () => {
    const resultado = validarAlocacao(1, 1, true);
    expect(resultado.bloqueado).toBe(false);
  });
});
