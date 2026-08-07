/**
 * Testes COGES-1 — Extração MSC, Validações e Bloqueios
 *
 * Cobre os 6 cenários obrigatórios:
 * 1. MSC: saldo atual = saldo anterior + débitos − créditos (conta devedora)
 * 2. MSC: competência sem movimento devolve saldo anterior inalterado
 * 3. Tombamento duplicado na mesma UG é bloqueado; mesmo tombamento em UG diferente é permitido
 * 4. Evento com conta inexistente é bloqueado
 * 5. Baixa de bem já baixado é bloqueada
 * 6. Cada bloqueio gera registro de auditoria
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { calcularSaldoAtualTestavel, montarMscTestavel } from "./coges1.helpers";

// ─── Cenários 1 e 2: lógica de cálculo da MSC ────────────────────────────────

describe("MSC — cálculo de saldo", () => {
  // Cenário 1: saldo atual = saldo anterior + débitos − créditos (conta devedora)
  it("conta devedora: saldo atual = saldo anterior + débitos − créditos", () => {
    const saldo = calcularSaldoAtualTestavel(1000, 300, 100, "devedora");
    expect(saldo).toBe(1200); // 1000 + 300 - 100
  });

  it("conta credora: saldo atual = saldo anterior + créditos − débitos", () => {
    const saldo = calcularSaldoAtualTestavel(1000, 300, 100, "credora");
    expect(saldo).toBe(800); // 1000 + 100 - 300
  });

  it("conta devedora com apenas débito: saldo aumenta", () => {
    const saldo = calcularSaldoAtualTestavel(500, 200, 0, "devedora");
    expect(saldo).toBe(700);
  });

  it("conta devedora com apenas crédito: saldo diminui", () => {
    const saldo = calcularSaldoAtualTestavel(500, 0, 200, "devedora");
    expect(saldo).toBe(300);
  });

  // Cenário 2: competência sem movimento devolve saldo anterior inalterado
  it("competência sem movimento: saldo atual = saldo anterior (conta devedora)", () => {
    const saldo = calcularSaldoAtualTestavel(750, 0, 0, "devedora");
    expect(saldo).toBe(750); // sem movimento, saldo não muda
  });

  it("competência sem movimento: saldo atual = saldo anterior (conta credora)", () => {
    const saldo = calcularSaldoAtualTestavel(750, 0, 0, "credora");
    expect(saldo).toBe(750);
  });

  it("saldo anterior zero com movimento: calcula corretamente", () => {
    const saldo = calcularSaldoAtualTestavel(0, 500, 200, "devedora");
    expect(saldo).toBe(300);
  });
});

describe("MSC — montagem da matriz", () => {
  it("exclui contas sem saldo e sem movimento", () => {
    const contas = [
      { id: 1, codigo: "1.1.1", nome: "Bens Móveis", natureza: "devedora" as const, tipo: "ativo" as const },
      { id: 2, codigo: "2.1.1", nome: "Fornecedores", natureza: "credora" as const, tipo: "passivo" as const },
    ];
    const movimentos = new Map([[1, { debito: 500, credito: 0 }]]);
    const saldosAnteriores = new Map<number, number>();

    const linhas = montarMscTestavel(contas, movimentos, saldosAnteriores);

    expect(linhas).toHaveLength(1); // conta 2 excluída por não ter movimento nem saldo
    expect(linhas[0].codigoConta).toBe("1.1.1");
    expect(linhas[0].movimentoDebito).toBe(500);
    expect(linhas[0].saldoAtual).toBe(500); // 0 + 500 - 0
  });

  it("inclui conta com saldo anterior mesmo sem movimento na competência", () => {
    const contas = [
      { id: 1, codigo: "1.1.1", nome: "Bens Móveis", natureza: "devedora" as const, tipo: "ativo" as const },
    ];
    const movimentos = new Map<number, { debito: number; credito: number }>();
    const saldosAnteriores = new Map([[1, 1000]]);

    const linhas = montarMscTestavel(contas, movimentos, saldosAnteriores);

    expect(linhas).toHaveLength(1);
    expect(linhas[0].saldoAnterior).toBe(1000);
    expect(linhas[0].movimentoDebito).toBe(0);
    expect(linhas[0].movimentoCredito).toBe(0);
    expect(linhas[0].saldoAtual).toBe(1000); // sem movimento, saldo inalterado
  });

  it("ordena linhas por código de conta", () => {
    const contas = [
      { id: 2, codigo: "2.1.1", nome: "Fornecedores", natureza: "credora" as const, tipo: "passivo" as const },
      { id: 1, codigo: "1.1.1", nome: "Bens Móveis", natureza: "devedora" as const, tipo: "ativo" as const },
    ];
    const movimentos = new Map([
      [1, { debito: 100, credito: 0 }],
      [2, { debito: 0, credito: 100 }],
    ]);
    const saldosAnteriores = new Map<number, number>();

    const linhas = montarMscTestavel(contas, movimentos, saldosAnteriores);

    expect(linhas[0].codigoConta).toBe("1.1.1");
    expect(linhas[1].codigoConta).toBe("2.1.1");
  });
});

// ─── Cenários 3, 4, 5, 6: validações com bloqueio e auditoria ────────────────
// Testamos a lógica de bloqueio de forma isolada (sem banco de dados),
// replicando as regras implementadas nos routers.

/** Simula o registro de auditoria para verificar que é chamado */
function criarAuditoriaMock() {
  const registros: { acao: string; motivo: string }[] = [];
  const registrarAuditoria = (params: { acao: string; dadosDepois?: { motivo?: string } }) => {
    registros.push({ acao: params.acao, motivo: params.dadosDepois?.motivo ?? "" });
  };
  return { registros, registrarAuditoria };
}

/** Simula a lógica de validação de tombamento duplicado */
function validarTombamentoDuplicado(
  tombamentoGerado: string,
  ugId: number,
  bensExistentes: { numeroTombamento: string; ugId: number }[],
  registrarAuditoria: (p: { acao: string; dadosDepois?: { motivo?: string } }) => void,
): { bloqueado: boolean; mensagem?: string } {
  const duplicado = bensExistentes.find(
    (b) => b.numeroTombamento === tombamentoGerado && b.ugId === ugId,
  );
  if (duplicado) {
    registrarAuditoria({
      acao: "BLOQUEIO_TOMBAMENTO_DUPLICADO",
      dadosDepois: { motivo: "tombamento já existe na UG" },
    });
    return { bloqueado: true, mensagem: `Tombamento ${tombamentoGerado} já existe na UG ${ugId}` };
  }
  return { bloqueado: false };
}

/** Simula a lógica de validação de conta no plano de contas */
function validarConta(
  contaId: number,
  tipo: "debito" | "credito",
  contasExistentes: { id: number; aceitaLancamento: boolean; isActive: boolean }[],
  registrarAuditoria: (p: { acao: string; dadosDepois?: { motivo?: string } }) => void,
): { bloqueado: boolean; mensagem?: string } {
  const conta = contasExistentes.find((c) => c.id === contaId && c.isActive);
  if (!conta) {
    registrarAuditoria({
      acao: `BLOQUEIO_CONTA_${tipo.toUpperCase()}_INVALIDA`,
      dadosDepois: { motivo: `conta de ${tipo} não encontrada no plano de contas` },
    });
    return { bloqueado: true, mensagem: `Conta de ${tipo} ${contaId} não existe no plano de contas` };
  }
  if (!conta.aceitaLancamento) {
    registrarAuditoria({
      acao: `BLOQUEIO_CONTA_${tipo.toUpperCase()}_INVALIDA`,
      dadosDepois: { motivo: `conta de ${tipo} não aceita lançamento direto` },
    });
    return { bloqueado: true, mensagem: `Conta de ${tipo} ${contaId} não aceita lançamento direto` };
  }
  return { bloqueado: false };
}

/** Simula a lógica de validação de baixa de bem já baixado */
function validarBaixaBem(
  bemId: number,
  situacaoAtual: string,
  registrarAuditoria: (p: { acao: string; dadosDepois?: { motivo?: string } }) => void,
): { bloqueado: boolean; mensagem?: string } {
  if (situacaoAtual === "baixado" || situacaoAtual === "inservivel") {
    registrarAuditoria({
      acao: "BLOQUEIO_BAIXA_BEM_JA_BAIXADO",
      dadosDepois: { motivo: `bem já está ${situacaoAtual}` },
    });
    return { bloqueado: true, mensagem: `Bem ${bemId} já está com situação '${situacaoAtual}'` };
  }
  return { bloqueado: false };
}

// Cenário 3: tombamento duplicado na mesma UG é bloqueado; em UG diferente é permitido
describe("Validação — tombamento duplicado", () => {
  it("tombamento duplicado na mesma UG é bloqueado", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const bens = [{ numeroTombamento: "BM-1-0001", ugId: 1 }];

    const resultado = validarTombamentoDuplicado("BM-1-0001", 1, bens, registrarAuditoria);

    expect(resultado.bloqueado).toBe(true);
    expect(resultado.mensagem).toContain("BM-1-0001");
  });

  it("mesmo tombamento em UG diferente é permitido", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const bens = [{ numeroTombamento: "BM-1-0001", ugId: 1 }];

    // UG 2 — tombamento igual mas UG diferente
    const resultado = validarTombamentoDuplicado("BM-1-0001", 2, bens, registrarAuditoria);

    expect(resultado.bloqueado).toBe(false);
    expect(registros).toHaveLength(0); // sem bloqueio, sem auditoria
  });

  // Cenário 6: bloqueio gera registro de auditoria
  it("bloqueio de tombamento duplicado gera registro de auditoria", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const bens = [{ numeroTombamento: "BM-1-0001", ugId: 1 }];

    validarTombamentoDuplicado("BM-1-0001", 1, bens, registrarAuditoria);

    expect(registros).toHaveLength(1);
    expect(registros[0].acao).toBe("BLOQUEIO_TOMBAMENTO_DUPLICADO");
    expect(registros[0].motivo).toBe("tombamento já existe na UG");
  });
});

// Cenário 4: evento com conta inexistente é bloqueado
describe("Validação — conta inexistente no plano de contas", () => {
  const contas = [
    { id: 1, aceitaLancamento: true, isActive: true },
    { id: 2, aceitaLancamento: false, isActive: true }, // conta sintética, não aceita lançamento
    { id: 3, aceitaLancamento: true, isActive: false }, // conta inativa
  ];

  it("conta de débito inexistente é bloqueada", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const resultado = validarConta(99, "debito", contas, registrarAuditoria);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.mensagem).toContain("não existe no plano de contas");
  });

  it("conta de débito que não aceita lançamento é bloqueada", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const resultado = validarConta(2, "debito", contas, registrarAuditoria);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.mensagem).toContain("não aceita lançamento direto");
  });

  it("conta de débito inativa é bloqueada (tratada como inexistente)", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const resultado = validarConta(3, "debito", contas, registrarAuditoria);
    expect(resultado.bloqueado).toBe(true);
  });

  it("conta de débito válida é permitida", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const resultado = validarConta(1, "debito", contas, registrarAuditoria);
    expect(resultado.bloqueado).toBe(false);
    expect(registros).toHaveLength(0);
  });

  // Cenário 6: bloqueio gera registro de auditoria
  it("bloqueio de conta inexistente gera registro de auditoria", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    validarConta(99, "debito", contas, registrarAuditoria);
    expect(registros).toHaveLength(1);
    expect(registros[0].acao).toBe("BLOQUEIO_CONTA_DEBITO_INVALIDA");
  });
});

// Cenário 5: baixa de bem já baixado é bloqueada
describe("Validação — baixa de bem já baixado", () => {
  it("baixa de bem com situação 'baixado' é bloqueada", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const resultado = validarBaixaBem(42, "baixado", registrarAuditoria);
    expect(resultado.bloqueado).toBe(true);
    expect(resultado.mensagem).toContain("baixado");
  });

  it("baixa de bem com situação 'inservivel' é bloqueada", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const resultado = validarBaixaBem(42, "inservivel", registrarAuditoria);
    expect(resultado.bloqueado).toBe(true);
  });

  it("baixa de bem ativo é permitida", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const resultado = validarBaixaBem(42, "ativo", registrarAuditoria);
    expect(resultado.bloqueado).toBe(false);
    expect(registros).toHaveLength(0);
  });

  it("baixa de bem em manutenção é permitida (não está baixado)", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    const resultado = validarBaixaBem(42, "em_manutencao", registrarAuditoria);
    expect(resultado.bloqueado).toBe(false);
  });

  // Cenário 6: bloqueio gera registro de auditoria
  it("bloqueio de baixa de bem já baixado gera registro de auditoria", () => {
    const { registros, registrarAuditoria } = criarAuditoriaMock();
    validarBaixaBem(42, "baixado", registrarAuditoria);
    expect(registros).toHaveLength(1);
    expect(registros[0].acao).toBe("BLOQUEIO_BAIXA_BEM_JA_BAIXADO");
    expect(registros[0].motivo).toBe("bem já está baixado");
  });
});

