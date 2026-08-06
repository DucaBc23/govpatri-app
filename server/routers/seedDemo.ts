import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { createHash } from "crypto";
import {
  orgaos, unidadesGestoras, unidadesAdministrativas,
  classesBens, bensMoveisTable, movimentacoesBens,
  almoxItens, depositos, estoque,
  bensImoveis, ocupacoesImoveis, pendenciasImoveis,
  planoContas, periodosContabeis, eventosPatrimoniais, depreciacaoMensal,
  auditLogs, workflowModelos, inventarios,
} from "../../drizzle/schema";
import { sql } from "drizzle-orm";

function sha256(data: object): string {
  return createHash("sha256").update(JSON.stringify(data)).digest("hex");
}

export const seedDemoRouter = router({
  popular: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("DB indisponível");
    const userId = ctx.user.id;

    // ── 1. ÓRGÃOS ────────────────────────────────────────────────────────────
    await db.insert(orgaos).values([
      { codigo: "001", nome: "Secretaria de Estado da Administração", sigla: "SEAD", esfera: "estadual", uf: "MA", municipio: "São Luís" },
      { codigo: "002", nome: "Secretaria de Estado da Educação", sigla: "SEDUC", esfera: "estadual", uf: "MA", municipio: "São Luís" },
      { codigo: "003", nome: "Secretaria de Estado da Saúde", sigla: "SES", esfera: "estadual", uf: "MA", municipio: "São Luís" },
    ]).onDuplicateKeyUpdate({ set: { nome: sql`VALUES(nome)` } });

    const orgaoRows = await db.select().from(orgaos).limit(3);
    const [o1, o2, o3] = orgaoRows;

    // ── 2. UNIDADES GESTORAS ─────────────────────────────────────────────────
    await db.insert(unidadesGestoras).values([
      { orgaoId: o1.id, codigo: "001001", nome: "UG Central — SEAD", sigla: "UGC-SEAD", tipo: "ug_gestora" },
      { orgaoId: o1.id, codigo: "001002", nome: "Coordenadoria de Patrimônio", sigla: "COPAT", tipo: "ug_executora" },
      { orgaoId: o2.id, codigo: "002001", nome: "UG Central — SEDUC", sigla: "UGC-SEDUC", tipo: "ug_gestora" },
      { orgaoId: o2.id, codigo: "002002", nome: "Diretoria de Infraestrutura Escolar", sigla: "DIE", tipo: "ug_executora" },
      { orgaoId: o3.id, codigo: "003001", nome: "UG Central — SES", sigla: "UGC-SES", tipo: "ug_gestora" },
    ]).onDuplicateKeyUpdate({ set: { nome: sql`VALUES(nome)` } });

    const ugRows = await db.select().from(unidadesGestoras).limit(5);
    const [ug1, ug2, ug3, ug4, ug5] = ugRows;

    // ── 3. UNIDADES ADMINISTRATIVAS ──────────────────────────────────────────
    await db.insert(unidadesAdministrativas).values([
      { ugId: ug1.id, codigo: "001001-01", nome: "Diretoria Administrativa", sigla: "DIRAD" },
      { ugId: ug1.id, codigo: "001001-02", nome: "Setor de Almoxarifado Central", sigla: "SAC" },
      { ugId: ug2.id, codigo: "001002-01", nome: "Setor de Tombamento", sigla: "SETOM" },
      { ugId: ug2.id, codigo: "001002-02", nome: "Setor de Inventário", sigla: "SEINV" },
      { ugId: ug3.id, codigo: "002001-01", nome: "Coordenadoria Pedagógica", sigla: "COPEDA" },
      { ugId: ug4.id, codigo: "002002-01", nome: "Setor de Obras e Manutenção", sigla: "SEOM" },
      { ugId: ug5.id, codigo: "003001-01", nome: "Diretoria de Logística em Saúde", sigla: "DLS" },
    ]);

    const uaRows = await db.select().from(unidadesAdministrativas).limit(7);

    // ── 4. CLASSES DE BENS (PCASP) ───────────────────────────────────────────
    await db.insert(classesBens).values([
      { codigo: "1.2.3.1.1", nome: "Móveis e Utensílios", vidaUtilAnos: 10, taxaDepreciacaoAnual: "0.1000", valorResidualPerc: "0.1000", contaPcasp: "1.2.3.1.1" },
      { codigo: "1.2.3.1.2", nome: "Equipamentos de Processamento de Dados", vidaUtilAnos: 5, taxaDepreciacaoAnual: "0.2000", valorResidualPerc: "0.1000", contaPcasp: "1.2.3.1.2" },
      { codigo: "1.2.3.1.3", nome: "Aparelhos e Equipamentos de Comunicação", vidaUtilAnos: 10, taxaDepreciacaoAnual: "0.1000", valorResidualPerc: "0.1000", contaPcasp: "1.2.3.1.3" },
      { codigo: "1.2.3.1.6", nome: "Veículos em Geral", vidaUtilAnos: 5, taxaDepreciacaoAnual: "0.2000", valorResidualPerc: "0.2000", contaPcasp: "1.2.3.1.6" },
    ]).onDuplicateKeyUpdate({ set: { nome: sql`VALUES(nome)` } });

    const classeRows = await db.select().from(classesBens).limit(4);
    const cMov = classeRows.find(c => c.codigo === "1.2.3.1.1");
    const cTI  = classeRows.find(c => c.codigo === "1.2.3.1.2");
    const cCom = classeRows.find(c => c.codigo === "1.2.3.1.3");
    const cVei = classeRows.find(c => c.codigo === "1.2.3.1.6");

    // ── 5. PLANO DE CONTAS ───────────────────────────────────────────────────
    await db.insert(planoContas).values([
      { codigo: "1.2.3.1.1.00.00", nome: "Móveis e Utensílios", tipo: "ativo", natureza: "devedora", nivel: 7, aceitaLancamento: true },
      { codigo: "1.2.3.1.2.00.00", nome: "Equipamentos de Processamento de Dados", tipo: "ativo", natureza: "devedora", nivel: 7, aceitaLancamento: true },
      { codigo: "1.2.3.1.6.00.00", nome: "Veículos em Geral", tipo: "ativo", natureza: "devedora", nivel: 7, aceitaLancamento: true },
      { codigo: "1.2.9.1.1.00.00", nome: "Depreciação Acumulada — Bens Móveis", tipo: "ativo", natureza: "credora", nivel: 7, aceitaLancamento: true },
      { codigo: "3.3.1.1.1.00.00", nome: "Variação Patrimonial Diminutiva — Depreciação", tipo: "variacao", natureza: "credora", nivel: 7, aceitaLancamento: true },
      { codigo: "6.2.1.1.1.00.00", nome: "Incorporação de Bens Móveis", tipo: "variacao", natureza: "devedora", nivel: 7, aceitaLancamento: true },
    ]).onDuplicateKeyUpdate({ set: { nome: sql`VALUES(nome)` } });

    const contaRows = await db.select().from(planoContas).limit(10);
    const ctAtivo1  = contaRows.find(c => c.codigo === "1.2.3.1.1.00.00")!;
    const ctAtivo2  = contaRows.find(c => c.codigo === "1.2.3.1.2.00.00")!;
    const ctAtivo3  = contaRows.find(c => c.codigo === "1.2.3.1.6.00.00")!;
    const ctDepAcum = contaRows.find(c => c.codigo === "1.2.9.1.1.00.00")!;
    const ctDepVPD  = contaRows.find(c => c.codigo === "3.3.1.1.1.00.00")!;
    const ctIncorp  = contaRows.find(c => c.codigo === "6.2.1.1.1.00.00")!;

    // ── 6. PERÍODOS CONTÁBEIS ────────────────────────────────────────────────
    for (const ug of [ug1, ug2, ug3]) {
      for (let mes = 1; mes <= 6; mes++) {
        await db.insert(periodosContabeis).values({
          ugId: ug.id, ano: 2026, mes,
          situacao: mes < 6 ? "fechado" : "aberto",
        }).onDuplicateKeyUpdate({ set: { situacao: mes < 6 ? "fechado" : "aberto" } });
      }
    }
    const periodoRows = await db.select().from(periodosContabeis).limit(18);
    const getPeriodo = (ugId: number, mes: number) =>
      periodoRows.find(p => p.ugId === ugId && p.mes === mes && p.ano === 2026);

    // ── 7. BENS MÓVEIS ───────────────────────────────────────────────────────
    const bensDados = [
      { tombamento: "MA-001-000001", classeId: cMov?.id ?? 1, ugId: ug1.id, descricao: "Mesa de Escritório em L — Madeira MDF", marca: "Móveis Planejados BR", modelo: "Executive L-180", valor: "1850.00", situacao: "ativo" as const },
      { tombamento: "MA-001-000002", classeId: cMov?.id ?? 1, ugId: ug1.id, descricao: "Cadeira Presidente Giratória com Apoio de Braço", marca: "Flexform", modelo: "Presidente Plus", valor: "920.00", situacao: "ativo" as const },
      { tombamento: "MA-001-000003", classeId: cTI?.id ?? 2, ugId: ug1.id, descricao: "Computador Desktop — Core i7 12ª Geração, 16GB RAM, SSD 512GB", marca: "Dell", modelo: "OptiPlex 7010", valor: "4200.00", situacao: "ativo" as const },
      { tombamento: "MA-001-000004", classeId: cTI?.id ?? 2, ugId: ug1.id, descricao: "Monitor LED 27 Polegadas Full HD", marca: "LG", modelo: "27MK600M", valor: "1350.00", situacao: "ativo" as const },
      { tombamento: "MA-001-000005", classeId: cTI?.id ?? 2, ugId: ug1.id, descricao: "Notebook Corporativo — Core i5, 8GB RAM, SSD 256GB", marca: "Lenovo", modelo: "ThinkPad E14", valor: "3800.00", situacao: "ativo" as const },
      { tombamento: "MA-001-000006", classeId: cCom?.id ?? 3, ugId: ug1.id, descricao: "Projetor Multimídia 3500 Lumens HDMI/VGA", marca: "Epson", modelo: "PowerLite X49", valor: "2750.00", situacao: "ativo" as const },
      { tombamento: "MA-001-000007", classeId: cMov?.id ?? 1, ugId: ug1.id, descricao: "Armário de Aço 2 Portas com Chave", marca: "Metalúrgica Gaúcha", modelo: "Aro-2P", valor: "680.00", situacao: "em_manutencao" as const },
      { tombamento: "MA-001-000008", classeId: cVei?.id ?? 4, ugId: ug1.id, descricao: "Veículo Sedan — Uso Administrativo", marca: "Volkswagen", modelo: "Virtus 1.0 TSI", valor: "89000.00", situacao: "ativo" as const },
      { tombamento: "MA-002-000001", classeId: cTI?.id ?? 2, ugId: ug2.id, descricao: "Impressora Multifuncional Laser A4 Colorida", marca: "HP", modelo: "Color LaserJet Pro M479fdw", valor: "3200.00", situacao: "ativo" as const },
      { tombamento: "MA-002-000002", classeId: cMov?.id ?? 1, ugId: ug2.id, descricao: "Mesa de Reunião Oval 10 Lugares", marca: "Móveis Planejados BR", modelo: "Oval-10", valor: "4500.00", situacao: "ativo" as const },
      { tombamento: "MA-002-000003", classeId: cTI?.id ?? 2, ugId: ug2.id, descricao: "Servidor de Rede NAS 4 Baias", marca: "Synology", modelo: "DS423+", valor: "5800.00", situacao: "ativo" as const },
      { tombamento: "MA-002-000004", classeId: cVei?.id ?? 4, ugId: ug2.id, descricao: "Caminhonete Cabine Dupla — Uso Operacional", marca: "Ford", modelo: "Ranger XLS 2.2", valor: "145000.00", situacao: "ativo" as const },
      { tombamento: "MA-003-000001", classeId: cMov?.id ?? 1, ugId: ug3.id, descricao: "Carteira Escolar com Braço Regulável", marca: "Metalúrgica Educacional", modelo: "CE-BR", valor: "280.00", situacao: "ativo" as const },
      { tombamento: "MA-003-000002", classeId: cTI?.id ?? 2, ugId: ug3.id, descricao: "Lousa Digital Interativa 86 Polegadas", marca: "Newline", modelo: "TT-8621Q", valor: "12500.00", situacao: "ativo" as const },
      { tombamento: "MA-003-000003", classeId: cCom?.id ?? 3, ugId: ug3.id, descricao: "Sistema de Som Ambiente 6 Caixas Acústicas", marca: "JBL", modelo: "Control 1 Pro Kit", valor: "3200.00", situacao: "baixado" as const },
      { tombamento: "MA-003-000004", classeId: cVei?.id ?? 4, ugId: ug3.id, descricao: "Ônibus Escolar 46 Lugares", marca: "Mercedes-Benz", modelo: "OF 1721/59", valor: "320000.00", situacao: "cedido" as const },
    ];

    for (const b of bensDados) {
      await db.insert(bensMoveisTable).values({
        numeroTombamento: b.tombamento,
        classeId: b.classeId,
        ugId: b.ugId,
        descricao: b.descricao,
        marca: b.marca,
        modelo: b.modelo,
        valorAquisicao: b.valor,
        valorAtual: b.valor,
        situacao: b.situacao,
        dataAquisicao: new Date("2024-01-15"),
        localizacaoUaId: uaRows[0]?.id,
        responsavelId: userId,
      }).onDuplicateKeyUpdate({ set: { descricao: b.descricao } });
    }

    const bemRows = await db.select().from(bensMoveisTable).limit(20);

    // ── 8. MOVIMENTAÇÕES DE BENS ─────────────────────────────────────────────
    const movs = [
      { bemId: bemRows[0]?.id, tipo: "incorporacao" as const, ugOrigemId: ug1.id, ugDestinoId: ug1.id, justificativa: "Incorporação por compra — NF 12345", data: "2024-01-15" },
      { bemId: bemRows[2]?.id, tipo: "transferencia" as const, ugOrigemId: ug1.id, ugDestinoId: ug2.id, justificativa: "Transferência para COPAT — Ofício 2024/001", data: "2024-06-10" },
      { bemId: bemRows[6]?.id, tipo: "manutencao" as const, ugOrigemId: ug1.id, ugDestinoId: ug1.id, justificativa: "Encaminhado para manutenção preventiva", data: "2026-03-20" },
      { bemId: bemRows[14]?.id, tipo: "baixa" as const, ugOrigemId: ug3.id, ugDestinoId: ug3.id, justificativa: "Baixa por inservibilidade — Processo 2026/0042", data: "2026-02-28" },
      { bemId: bemRows[15]?.id, tipo: "cessao" as const, ugOrigemId: ug3.id, ugDestinoId: ug4.id, justificativa: "Cessão para DIE — Contrato 2025/0018", data: "2025-08-01" },
    ];
    for (const m of movs) {
      if (!m.bemId) continue;
      await db.insert(movimentacoesBens).values({
        bemId: m.bemId,
        tipo: m.tipo,
        ugOrigemId: m.ugOrigemId,
        ugDestinoId: m.ugDestinoId,
        dataMovimentacao: new Date(m.data),
        justificativa: m.justificativa,
        createdByUserId: userId,
      });
    }

    // ── 9. ALMOXARIFADO ──────────────────────────────────────────────────────
    await db.insert(depositos).values([
      { ugId: ug1.id, codigo: "DEP-001", nome: "Almoxarifado Central — SEAD", localizacao: "Térreo, Bloco B" },
      { ugId: ug3.id, codigo: "DEP-002", nome: "Almoxarifado SEDUC", localizacao: "Sala 12, 1º Andar" },
    ]).onDuplicateKeyUpdate({ set: { nome: sql`VALUES(nome)` } });

    const depRows = await db.select().from(depositos).limit(2);
    const [dep1, dep2] = depRows;

    await db.insert(almoxItens).values([
      { codigo: "MAT-001", nome: "Papel A4 75g/m² — Resma 500 folhas", unidadeMedida: "resma", categoria: "Material de Escritório", estoqueMinimo: "20", estoqueMaximo: "200" },
      { codigo: "MAT-002", nome: "Caneta Esferográfica Azul — Caixa 50un", unidadeMedida: "caixa", categoria: "Material de Escritório", estoqueMinimo: "5", estoqueMaximo: "50" },
      { codigo: "MAT-003", nome: "Toner HP LaserJet CF217A", unidadeMedida: "unidade", categoria: "Suprimentos de TI", estoqueMinimo: "3", estoqueMaximo: "20" },
      { codigo: "MAT-004", nome: "Álcool Gel 70% — Frasco 500ml", unidadeMedida: "frasco", categoria: "Higiene e Limpeza", estoqueMinimo: "10", estoqueMaximo: "100" },
      { codigo: "MAT-005", nome: "Giz Colorido — Caixa 50 Cores", unidadeMedida: "caixa", categoria: "Material Pedagógico", estoqueMinimo: "30", estoqueMaximo: "300" },
      { codigo: "MAT-006", nome: "Caderno Universitário 200 folhas", unidadeMedida: "unidade", categoria: "Material Pedagógico", estoqueMinimo: "50", estoqueMaximo: "500" },
    ]).onDuplicateKeyUpdate({ set: { nome: sql`VALUES(nome)` } });

    const itemRows = await db.select().from(almoxItens).limit(6);
    const estoqueDados = [
      { depositoId: dep1?.id, itemId: itemRows[0]?.id, quantidade: "85", valorUnitarioMedio: "28.9000" },
      { depositoId: dep1?.id, itemId: itemRows[1]?.id, quantidade: "12", valorUnitarioMedio: "18.5000" },
      { depositoId: dep1?.id, itemId: itemRows[2]?.id, quantidade: "7",  valorUnitarioMedio: "89.0000" },
      { depositoId: dep1?.id, itemId: itemRows[3]?.id, quantidade: "43", valorUnitarioMedio: "8.9000" },
      { depositoId: dep2?.id, itemId: itemRows[4]?.id, quantidade: "120", valorUnitarioMedio: "12.5000" },
      { depositoId: dep2?.id, itemId: itemRows[5]?.id, quantidade: "230", valorUnitarioMedio: "9.8000" },
    ];
    for (const e of estoqueDados) {
      if (!e.depositoId || !e.itemId) continue;
      await db.insert(estoque).values(e)
        .onDuplicateKeyUpdate({ set: { quantidade: e.quantidade } });
    }

    // ── 10. BENS IMÓVEIS ─────────────────────────────────────────────────────
    const imoveisDados = [
      { ugId: ug1.id, rip: "MA-001-001", denominacao: "Sede da Secretaria de Administração", tipo: "edificacao" as const, endereco: "Rua do Sol, 141 — Centro", municipio: "São Luís", uf: "MA", areaTotal: "4500.00", areaConstruida: "3200.00", valorAvaliacao: "12500000.00", situacaoDominial: "regular" as const, situacaoOcupacao: "proprio_uso" as const },
      { ugId: ug2.id, rip: "MA-001-002", denominacao: "Depósito de Materiais — Cohama", tipo: "edificacao" as const, endereco: "Av. Jerônimo de Albuquerque, 500 — Cohama", municipio: "São Luís", uf: "MA", areaTotal: "800.00", areaConstruida: "750.00", valorAvaliacao: "850000.00", situacaoDominial: "regular" as const, situacaoOcupacao: "proprio_uso" as const },
      { ugId: ug3.id, rip: "MA-002-001", denominacao: "Escola Estadual Benedito Leite", tipo: "edificacao" as const, endereco: "Rua Osvaldo Cruz, 22 — João Paulo", municipio: "São Luís", uf: "MA", areaTotal: "2800.00", areaConstruida: "2200.00", valorAvaliacao: "6800000.00", situacaoDominial: "regular" as const, situacaoOcupacao: "proprio_uso" as const },
      { ugId: ug5.id, rip: "MA-003-001", denominacao: "Terreno para Expansão — Tirirical", tipo: "terreno" as const, endereco: "Av. dos Holandeses, s/n — Tirirical", municipio: "São Luís", uf: "MA", areaTotal: "12000.00", valorAvaliacao: "3200000.00", situacaoDominial: "irregular" as const, situacaoOcupacao: "desocupado" as const },
    ];
    for (const im of imoveisDados) {
      await db.insert(bensImoveis).values(im)
        .onDuplicateKeyUpdate({ set: { denominacao: im.denominacao } });
    }

    const imovelRows = await db.select().from(bensImoveis).limit(4);

    await db.insert(ocupacoesImoveis).values([
      { imovelId: imovelRows[0]?.id ?? 1, ocupante: "Secretaria de Estado da Administração — SEAD", tipoOcupacao: "uso_proprio" as const, dataInicio: new Date("2010-01-01") },
      { imovelId: imovelRows[2]?.id ?? 3, ocupante: "Escola Estadual Benedito Leite", tipoOcupacao: "uso_proprio" as const, dataInicio: new Date("1998-03-01") },
    ]);

    await db.insert(pendenciasImoveis).values([
      { imovelId: imovelRows[3]?.id ?? 4, tipo: "regularizacao_dominial" as const, descricao: "Terreno sem matrícula no Cartório de Registro de Imóveis. Necessário abertura de matrícula e averbação.", prazo: new Date("2026-12-31"), situacao: "em_andamento" as const },
    ]);

    // ── 11. EVENTOS PATRIMONIAIS ─────────────────────────────────────────────
    const periodo1 = getPeriodo(ug1.id, 1);
    const periodo2 = getPeriodo(ug1.id, 2);
    const periodo3 = getPeriodo(ug1.id, 3);

    if (periodo1 && ctAtivo1 && ctIncorp && ctAtivo2 && ctDepAcum && ctDepVPD && ctAtivo3) {
      await db.insert(eventosPatrimoniais).values([
        { ugId: ug1.id, periodoId: periodo1.id, tipo: "incorporacao" as const, bemMovelId: bemRows[0]?.id, contaDebitoId: ctAtivo1.id, contaCreditoId: ctIncorp.id, valor: "1850.00", historico: "Incorporação — Mesa de Escritório. NF 12345/2024.", documentoRef: "NF-12345", createdByUserId: userId },
        { ugId: ug1.id, periodoId: periodo1.id, tipo: "incorporacao" as const, bemMovelId: bemRows[2]?.id, contaDebitoId: ctAtivo2.id, contaCreditoId: ctIncorp.id, valor: "4200.00", historico: "Incorporação — Desktop Dell OptiPlex. NF 12346/2024.", documentoRef: "NF-12346", createdByUserId: userId },
        { ugId: ug1.id, periodoId: periodo1.id, tipo: "incorporacao" as const, bemMovelId: bemRows[7]?.id, contaDebitoId: ctAtivo3.id, contaCreditoId: ctIncorp.id, valor: "89000.00", historico: "Incorporação — Veículo VW Virtus. NF 12347/2024.", documentoRef: "NF-12347", createdByUserId: userId },
      ]);

      if (periodo2 && periodo3) {
        const depreciacoes = [
          { bemId: bemRows[0]?.id, ugId: ug1.id, periodoId: periodo2.id, valorDepreciado: "15.42", valorAcumulado: "15.42", valorResidual: "1834.58" },
          { bemId: bemRows[0]?.id, ugId: ug1.id, periodoId: periodo3.id, valorDepreciado: "15.42", valorAcumulado: "30.84", valorResidual: "1819.16" },
          { bemId: bemRows[2]?.id, ugId: ug1.id, periodoId: periodo2.id, valorDepreciado: "63.00", valorAcumulado: "63.00", valorResidual: "4137.00" },
          { bemId: bemRows[2]?.id, ugId: ug1.id, periodoId: periodo3.id, valorDepreciado: "63.00", valorAcumulado: "126.00", valorResidual: "4074.00" },
          { bemId: bemRows[7]?.id, ugId: ug1.id, periodoId: periodo2.id, valorDepreciado: "1335.00", valorAcumulado: "1335.00", valorResidual: "87665.00" },
          { bemId: bemRows[7]?.id, ugId: ug1.id, periodoId: periodo3.id, valorDepreciado: "1335.00", valorAcumulado: "2670.00", valorResidual: "86330.00" },
        ];
        for (const d of depreciacoes) {
          if (!d.bemId) continue;
          await db.insert(depreciacaoMensal).values(d)
            .onDuplicateKeyUpdate({ set: { valorAcumulado: d.valorAcumulado } });
          await db.insert(eventosPatrimoniais).values({
            ugId: ug1.id, periodoId: d.periodoId, tipo: "depreciacao" as const,
            bemMovelId: d.bemId, contaDebitoId: ctDepVPD.id, contaCreditoId: ctDepAcum.id,
            valor: d.valorDepreciado, historico: `Depreciação mensal automática — Período ${d.periodoId}`, createdByUserId: userId,
          });
        }
      }
    }

    // ── 12. WORKFLOW ─────────────────────────────────────────────────────────
    await db.insert(workflowModelos).values([
      { nome: "Aprovação de Incorporação", tipo: "incorporacao" as const, etapas: JSON.stringify([{ nome: "Análise Técnica", perfil: "gestor", ordem: 1 }, { nome: "Aprovação Final", perfil: "admin", ordem: 2 }]) },
      { nome: "Aprovação de Baixa", tipo: "baixa" as const, etapas: JSON.stringify([{ nome: "Laudo de Inservibilidade", perfil: "operador", ordem: 1 }, { nome: "Aprovação do Gestor", perfil: "gestor", ordem: 2 }, { nome: "Aprovação Final", perfil: "admin", ordem: 3 }]) },
      { nome: "Aprovação de Cessão", tipo: "cessao" as const, etapas: JSON.stringify([{ nome: "Solicitação", perfil: "operador", ordem: 1 }, { nome: "Análise Jurídica", perfil: "gestor", ordem: 2 }]) },
    ]);

    // ── 13. INVENTÁRIOS ──────────────────────────────────────────────────────
    await db.insert(inventarios).values([
      { ugId: ug1.id, nome: "Inventário Anual 2025 — SEAD Central", dataInicio: new Date("2025-11-01"), dataFim: new Date("2025-11-30"), situacao: "concluido" as const, responsavelId: userId, totalBens: 8, totalColetados: 8, totalDivergencias: 1 },
      { ugId: ug2.id, nome: "Inventário 1º Semestre 2026 — COPAT", dataInicio: new Date("2026-06-01"), situacao: "em_coleta" as const, responsavelId: userId, totalBens: 4, totalColetados: 2, totalDivergencias: 0 },
      { ugId: ug3.id, nome: "Inventário Anual 2026 — SEDUC", dataInicio: new Date("2026-07-01"), situacao: "aberto" as const, responsavelId: userId, totalBens: 4, totalColetados: 0, totalDivergencias: 0 },
    ]);

    // ── 14. TRILHA DE AUDITORIA ──────────────────────────────────────────────
    const auditEntries = [
      { acao: "CREATE_BEM", entidade: "bens_moveis", entidadeId: bemRows[0]?.id, dadosDepois: { tombamento: "MA-001-000001", valor: 1850 } },
      { acao: "CREATE_BEM", entidade: "bens_moveis", entidadeId: bemRows[2]?.id, dadosDepois: { tombamento: "MA-001-000003", valor: 4200 } },
      { acao: "MOVIMENTACAO", entidade: "bens_moveis", entidadeId: bemRows[2]?.id, dadosDepois: { tipo: "transferencia", destino: "COPAT" } },
      { acao: "CREATE_BEM", entidade: "bens_moveis", entidadeId: bemRows[7]?.id, dadosDepois: { tombamento: "MA-001-000008", valor: 89000 } },
      { acao: "EVENTO_CONTABIL", entidade: "eventos_patrimoniais", entidadeId: 1, dadosDepois: { tipo: "incorporacao", valor: 1850 } },
      { acao: "DEPRECIACAO_MENSAL", entidade: "depreciacao_mensal", entidadeId: 1, dadosDepois: { periodo: "2026-02", valor: 15.42 } },
      { acao: "CREATE_INVENTARIO", entidade: "inventarios", entidadeId: 1, dadosDepois: { nome: "Inventário Anual 2025" } },
      { acao: "BAIXA_BEM", entidade: "bens_moveis", entidadeId: bemRows[14]?.id, dadosDepois: { motivo: "inservibilidade", processo: "2026/0042" } },
    ];
    for (const entry of auditEntries) {
      const payload = { userId, ...entry, timestamp: new Date().toISOString() };
      await db.insert(auditLogs).values({
        userId,
        acao: entry.acao,
        entidade: entry.entidade,
        entidadeId: entry.entidadeId ?? null,
        dadosAntes: null,
        dadosDepois: entry.dadosDepois,
        hashSha256: sha256(payload),
        ipAddress: "127.0.0.1",
      });
    }

    return {
      ok: true,
      resumo: {
        orgaos: orgaoRows.length,
        ugs: ugRows.length,
        bensMoveis: bensDados.length,
        bensImoveis: 4,
        itensAlmox: 6,
        eventosContabeis: 9,
        inventarios: 3,
        auditLogs: auditEntries.length,
      },
    };
  }),
});
