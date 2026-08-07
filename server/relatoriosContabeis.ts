/**
 * Relatórios Contábeis Obrigatórios SEPAT — COGES-REL-001
 *
 * Exportação em PDF, CSV e XLSX para:
 * - Balancete por UG e competência
 * - Subsídios às DCASP
 * - Reavaliação e redução ao valor recuperável
 * - Inventário físico-financeiro
 */
import PDFDocument from "pdfkit";
import * as XLSX from "xlsx";

const BLUE = "#1e3a5f";
const GRAY = "#555555";
const ORGAO = "Governo do Estado — SEPAT";

// ─── Utilitários de layout PDF ────────────────────────────────────────────────

function header(
  doc: InstanceType<typeof PDFDocument>,
  titulo: string,
  subtitulo: string,
) {
  doc.rect(50, 50, 495, 65).fill(BLUE);
  doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("GOVPatri", 60, 62);
  doc.fontSize(9).font("Helvetica").text("Plataforma Inteligente de Gestão Patrimonial Pública", 60, 82);
  doc.fontSize(8).text(ORGAO, 60, 96);
  doc.fillColor(BLUE).fontSize(13).font("Helvetica-Bold").text(titulo, 50, 130, { align: "center", width: 495 });
  doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(subtitulo, 50, 148, { align: "center", width: 495 });
  doc.moveTo(50, 165).lineTo(545, 165).strokeColor(BLUE).lineWidth(1.5).stroke();
}

function footer(doc: InstanceType<typeof PDFDocument>) {
  doc.rect(50, 760, 495, 22).fill(BLUE);
  doc.fillColor("white").fontSize(7).font("Helvetica")
    .text(
      `GOVPatri — Relatório gerado em ${new Date().toLocaleString("pt-BR")}  |  Documento de uso interno`,
      55, 767, { width: 485, align: "center" },
    );
}

function thRow(doc: InstanceType<typeof PDFDocument>, y: number, cols: { label: string; width: number }[]) {
  doc.rect(50, y, 495, 18).fill(BLUE);
  let x = 55;
  doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
  for (const col of cols) {
    doc.text(col.label, x, y + 5, { width: col.width - 4, ellipsis: true });
    x += col.width;
  }
}

function tdRow(
  doc: InstanceType<typeof PDFDocument>,
  y: number,
  cols: { label: string; width: number }[],
  values: string[],
  isAlt: boolean,
) {
  if (isAlt) doc.rect(50, y, 495, 16).fill("#f0f4f8");
  let x = 55;
  doc.fillColor(GRAY).fontSize(7.5).font("Helvetica");
  for (let i = 0; i < cols.length; i++) {
    doc.text(values[i] ?? "", x, y + 4, { width: cols[i].width - 4, ellipsis: true });
    x += cols[i].width;
  }
}

function moeda(v: number | string): string {
  return `R$ ${parseFloat(String(v)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface LinhaBalancete {
  codigoConta: string;
  nomeConta: string;
  natureza: string;
  saldoAnterior: number;
  movimentoDebito: number;
  movimentoCredito: number;
  saldoAtual: number;
}

export interface LinhaDcasp {
  grupoDcasp: string;
  descricao: string;
  valorPeriodo: number;
  variacaoPerc: number | null;
}

export interface LinhaReavaliacao {
  numeroTombamento: string;
  descricao: string;
  classeNome: string;
  valorAnterior: number;
  valorNovo: number;
  variacao: number;
  dataEvento: string;
  historico: string;
}

export interface LinhaInventarioFisicoFinanceiro {
  numeroTombamento: string;
  descricao: string;
  classeNome: string;
  localizacao: string;
  situacao: string;
  valorAquisicao: number;
  valorAtual: number;
  totalDepreciado: number;
}

// ─── 1. BALANCETE ─────────────────────────────────────────────────────────────

export async function gerarBalancetePdf(
  linhas: LinhaBalancete[],
  ugNome: string,
  competencia: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    header(doc, "Balancete de Verificação", `UG: ${ugNome} | Competência: ${competencia}`);

    const cols = [
      { label: "Conta", width: 80 },
      { label: "Nome da Conta", width: 155 },
      { label: "Natureza", width: 65 },
      { label: "Saldo Anterior", width: 75 },
      { label: "Débito", width: 65 },
      { label: "Crédito", width: 55 },
    ];

    let y = 180;
    thRow(doc, y, cols);
    y += 22;

    let totalDebito = 0;
    let totalCredito = 0;

    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (y > 720) { doc.addPage(); y = 60; thRow(doc, y, cols); y += 22; }
      tdRow(doc, y, cols, [
        l.codigoConta,
        l.nomeConta,
        l.natureza,
        moeda(l.saldoAnterior),
        moeda(l.movimentoDebito),
        moeda(l.movimentoCredito),
      ], i % 2 === 1);
      totalDebito += l.movimentoDebito;
      totalCredito += l.movimentoCredito;
      y += 18;
    }

    // Linha de totais
    y += 4;
    doc.rect(50, y, 495, 18).fill(BLUE);
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
      .text("TOTAIS", 55, y + 5, { width: 295 })
      .text(moeda(totalDebito), 355, y + 5, { width: 65 })
      .text(moeda(totalCredito), 420, y + 5, { width: 55 });

    footer(doc);
    doc.end();
  });
}

export function gerarBalanceteCsv(linhas: LinhaBalancete[], ugNome: string, competencia: string): string {
  const cab = "ugNome,competencia,codigoConta,nomeConta,natureza,saldoAnterior,movimentoDebito,movimentoCredito,saldoAtual";
  const rows = linhas.map((l) =>
    [ugNome, competencia, l.codigoConta, `"${l.nomeConta}"`, l.natureza,
      l.saldoAnterior.toFixed(2), l.movimentoDebito.toFixed(2), l.movimentoCredito.toFixed(2), l.saldoAtual.toFixed(2)].join(","),
  );
  return [cab, ...rows].join("\n");
}

export function gerarBalanceteXlsx(linhas: LinhaBalancete[], ugNome: string, competencia: string): Buffer {
  const dados = linhas.map((l) => ({
    "UG": ugNome,
    "Competência": competencia,
    "Código Conta": l.codigoConta,
    "Nome Conta": l.nomeConta,
    "Natureza": l.natureza,
    "Saldo Anterior (R$)": l.saldoAnterior,
    "Débito (R$)": l.movimentoDebito,
    "Crédito (R$)": l.movimentoCredito,
    "Saldo Atual (R$)": l.saldoAtual,
  }));
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Balancete");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── 2. SUBSÍDIOS DCASP ───────────────────────────────────────────────────────

export async function gerarDcaspPdf(
  linhas: LinhaDcasp[],
  ugNome: string,
  competencia: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    header(doc, "Subsídios às DCASP", `UG: ${ugNome} | Competência: ${competencia}`);

    const cols = [
      { label: "Grupo DCASP", width: 120 },
      { label: "Descrição", width: 215 },
      { label: "Valor do Período (R$)", width: 100 },
      { label: "Variação (%)", width: 60 },
    ];

    let y = 180;
    thRow(doc, y, cols);
    y += 22;

    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (y > 720) { doc.addPage(); y = 60; thRow(doc, y, cols); y += 22; }
      tdRow(doc, y, cols, [
        l.grupoDcasp,
        l.descricao,
        moeda(l.valorPeriodo),
        l.variacaoPerc !== null ? `${l.variacaoPerc.toFixed(1)}%` : "N/A",
      ], i % 2 === 1);
      y += 18;
    }

    footer(doc);
    doc.end();
  });
}

export function gerarDcaspCsv(linhas: LinhaDcasp[], ugNome: string, competencia: string): string {
  const cab = "ugNome,competencia,grupoDcasp,descricao,valorPeriodo,variacaoPerc";
  const rows = linhas.map((l) =>
    [ugNome, competencia, l.grupoDcasp, `"${l.descricao}"`,
      l.valorPeriodo.toFixed(2), l.variacaoPerc !== null ? l.variacaoPerc.toFixed(1) : ""].join(","),
  );
  return [cab, ...rows].join("\n");
}

export function gerarDcaspXlsx(linhas: LinhaDcasp[], ugNome: string, competencia: string): Buffer {
  const dados = linhas.map((l) => ({
    "UG": ugNome,
    "Competência": competencia,
    "Grupo DCASP": l.grupoDcasp,
    "Descrição": l.descricao,
    "Valor do Período (R$)": l.valorPeriodo,
    "Variação (%)": l.variacaoPerc,
  }));
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "DCASP");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── 3. REAVALIAÇÃO E REDUÇÃO AO VALOR RECUPERÁVEL ───────────────────────────

export async function gerarReavaliacaoPdf(
  linhas: LinhaReavaliacao[],
  ugNome: string,
  competencia: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    header(doc, "Reavaliação e Redução ao Valor Recuperável", `UG: ${ugNome} | Competência: ${competencia}`);

    const cols = [
      { label: "Tombamento", width: 80 },
      { label: "Descrição", width: 130 },
      { label: "Classe", width: 80 },
      { label: "Valor Anterior", width: 75 },
      { label: "Valor Novo", width: 75 },
      { label: "Variação", width: 55 },
    ];

    let y = 180;
    thRow(doc, y, cols);
    y += 22;

    let totalVariacao = 0;
    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (y > 720) { doc.addPage(); y = 60; thRow(doc, y, cols); y += 22; }
      tdRow(doc, y, cols, [
        l.numeroTombamento,
        l.descricao,
        l.classeNome,
        moeda(l.valorAnterior),
        moeda(l.valorNovo),
        moeda(l.variacao),
      ], i % 2 === 1);
      totalVariacao += l.variacao;
      y += 18;
    }

    y += 6;
    doc.rect(50, y, 495, 18).fill(BLUE);
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
      .text("VARIAÇÃO TOTAL", 55, y + 5, { width: 360 })
      .text(moeda(totalVariacao), 415, y + 5, { width: 75 });

    footer(doc);
    doc.end();
  });
}

export function gerarReavaliacaoCsv(linhas: LinhaReavaliacao[], ugNome: string, competencia: string): string {
  const cab = "ugNome,competencia,numeroTombamento,descricao,classeNome,valorAnterior,valorNovo,variacao,dataEvento,historico";
  const rows = linhas.map((l) =>
    [ugNome, competencia, l.numeroTombamento, `"${l.descricao}"`, `"${l.classeNome}"`,
      l.valorAnterior.toFixed(2), l.valorNovo.toFixed(2), l.variacao.toFixed(2), l.dataEvento, `"${l.historico}"`].join(","),
  );
  return [cab, ...rows].join("\n");
}

export function gerarReavaliacaoXlsx(linhas: LinhaReavaliacao[], ugNome: string, competencia: string): Buffer {
  const dados = linhas.map((l) => ({
    "UG": ugNome,
    "Competência": competencia,
    "Tombamento": l.numeroTombamento,
    "Descrição": l.descricao,
    "Classe": l.classeNome,
    "Valor Anterior (R$)": l.valorAnterior,
    "Valor Novo (R$)": l.valorNovo,
    "Variação (R$)": l.variacao,
    "Data do Evento": l.dataEvento,
    "Histórico": l.historico,
  }));
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Reavaliacao");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

// ─── 4. INVENTÁRIO FÍSICO-FINANCEIRO ─────────────────────────────────────────

export async function gerarInventarioFisicoFinanceiroPdf(
  linhas: LinhaInventarioFisicoFinanceiro[],
  ugNome: string,
  dataReferencia: string,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    header(doc, "Inventário Físico-Financeiro", `UG: ${ugNome} | Data de Referência: ${dataReferencia}`);

    const cols = [
      { label: "Tombamento", width: 75 },
      { label: "Descrição", width: 120 },
      { label: "Classe", width: 80 },
      { label: "Localização", width: 80 },
      { label: "Situação", width: 60 },
      { label: "Vl. Atual", width: 80 },
    ];

    let y = 180;
    thRow(doc, y, cols);
    y += 22;

    let totalAquisicao = 0;
    let totalAtual = 0;
    let totalDepreciado = 0;

    for (let i = 0; i < linhas.length; i++) {
      const l = linhas[i];
      if (y > 720) { doc.addPage(); y = 60; thRow(doc, y, cols); y += 22; }
      tdRow(doc, y, cols, [
        l.numeroTombamento,
        l.descricao,
        l.classeNome,
        l.localizacao,
        l.situacao,
        moeda(l.valorAtual),
      ], i % 2 === 1);
      totalAquisicao += l.valorAquisicao;
      totalAtual += l.valorAtual;
      totalDepreciado += l.totalDepreciado;
      y += 18;
    }

    y += 6;
    doc.rect(50, y, 495, 36).fill(BLUE);
    doc.fillColor("white").fontSize(8).font("Helvetica-Bold")
      .text(`Total de bens: ${linhas.length}`, 55, y + 5)
      .text(`Valor de aquisição: ${moeda(totalAquisicao)}`, 55, y + 18)
      .text(`Valor atual: ${moeda(totalAtual)}`, 250, y + 18)
      .text(`Depreciação acumulada: ${moeda(totalDepreciado)}`, 380, y + 18);

    footer(doc);
    doc.end();
  });
}

export function gerarInventarioFisicoFinanceiroCsv(
  linhas: LinhaInventarioFisicoFinanceiro[],
  ugNome: string,
  dataReferencia: string,
): string {
  const cab = "ugNome,dataReferencia,numeroTombamento,descricao,classeNome,localizacao,situacao,valorAquisicao,valorAtual,totalDepreciado";
  const rows = linhas.map((l) =>
    [ugNome, dataReferencia, l.numeroTombamento, `"${l.descricao}"`, `"${l.classeNome}"`,
      `"${l.localizacao}"`, l.situacao, l.valorAquisicao.toFixed(2), l.valorAtual.toFixed(2), l.totalDepreciado.toFixed(2)].join(","),
  );
  return [cab, ...rows].join("\n");
}

export function gerarInventarioFisicoFinanceiroXlsx(
  linhas: LinhaInventarioFisicoFinanceiro[],
  ugNome: string,
  dataReferencia: string,
): Buffer {
  const dados = linhas.map((l) => ({
    "UG": ugNome,
    "Data de Referência": dataReferencia,
    "Tombamento": l.numeroTombamento,
    "Descrição": l.descricao,
    "Classe": l.classeNome,
    "Localização": l.localizacao,
    "Situação": l.situacao,
    "Valor de Aquisição (R$)": l.valorAquisicao,
    "Valor Atual (R$)": l.valorAtual,
    "Depreciação Acumulada (R$)": l.totalDepreciado,
  }));
  const ws = XLSX.utils.json_to_sheet(dados);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Inventario");
  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}
