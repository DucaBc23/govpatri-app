import PDFDocument from "pdfkit";

const BLUE = "#1e3a5f";
const GRAY = "#555555";
const LIGHT = "#f5f5f5";

function header(doc: InstanceType<typeof PDFDocument>, titulo: string, subtitulo: string, orgao: string) {
  doc.rect(50, 50, 495, 65).fill(BLUE);
  doc.fillColor("white").fontSize(16).font("Helvetica-Bold").text("GOVPatri", 60, 62);
  doc.fontSize(9).font("Helvetica").text("Plataforma Inteligente de Gestão Patrimonial Pública", 60, 82);
  doc.fontSize(8).text(orgao, 60, 96);
  doc.fillColor(BLUE).fontSize(13).font("Helvetica-Bold").text(titulo, 50, 130, { align: "center", width: 495 });
  doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(subtitulo, 50, 148, { align: "center", width: 495 });
  doc.moveTo(50, 165).lineTo(545, 165).strokeColor(BLUE).lineWidth(1.5).stroke();
}

function footer(doc: InstanceType<typeof PDFDocument>) {
  doc.rect(50, 760, 495, 22).fill(BLUE);
  doc.fillColor("white").fontSize(7).font("Helvetica")
    .text(`GOVPatri — Relatório gerado em ${new Date().toLocaleString("pt-BR")}  |  Documento de uso interno`, 55, 767, { width: 485, align: "center" });
}

function tableHeader(doc: InstanceType<typeof PDFDocument>, y: number, cols: { label: string; width: number }[]) {
  doc.rect(50, y, 495, 18).fill(BLUE);
  let x = 55;
  doc.fillColor("white").fontSize(8).font("Helvetica-Bold");
  for (const col of cols) {
    doc.text(col.label, x, y + 5, { width: col.width - 4, ellipsis: true });
    x += col.width;
  }
  return y + 18;
}

function tableRow(doc: InstanceType<typeof PDFDocument>, y: number, cols: { value: string; width: number }[], even: boolean) {
  if (even) doc.rect(50, y, 495, 18).fill(LIGHT);
  let x = 55;
  doc.fillColor("#222").fontSize(8).font("Helvetica");
  for (const col of cols) {
    doc.text(col.value, x, y + 5, { width: col.width - 4, ellipsis: true });
    x += col.width;
  }
  return y + 18;
}

// ── 1. Movimentação Patrimonial ───────────────────────────────────────────────
export async function gerarRelMovimentacaoPatrimonial(
  movs: { tipo: string; dataMovimentacao: Date | null; justificativa: string | null; documentoRef: string | null }[],
  orgao: string, ug: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    header(doc, "RELATÓRIO DE MOVIMENTAÇÃO PATRIMONIAL", `UG: ${ug}  |  Total: ${movs.length} movimentações`, orgao);
    let y = 175;
    const cols = [{ label: "Data", width: 80 }, { label: "Tipo", width: 100 }, { label: "Justificativa", width: 215 }, { label: "Doc. Ref.", width: 100 }];
    y = tableHeader(doc, y, cols);
    movs.forEach((m, i) => {
      if (y > 720) { doc.addPage(); y = 50; y = tableHeader(doc, y, cols); }
      y = tableRow(doc, y, [
        { value: m.dataMovimentacao ? new Date(m.dataMovimentacao).toLocaleDateString("pt-BR") : "—", width: 80 },
        { value: m.tipo, width: 100 },
        { value: m.justificativa ?? "—", width: 215 },
        { value: m.documentoRef ?? "—", width: 100 },
      ], i % 2 === 0);
    });
    footer(doc);
    doc.end();
  });
}

// ── 2. Inventário Físico-Financeiro ──────────────────────────────────────────
export async function gerarRelInventarioFisicoFinanceiro(
  bens: { numeroTombamento: string; descricao: string; classeNome: string | null; valorAquisicao: string | null; valorAtual: string | null; situacao: string }[],
  orgao: string, ug: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const totalValor = bens.reduce((acc, b) => acc + parseFloat(String(b.valorAtual ?? b.valorAquisicao ?? 0)), 0);
    header(doc, "INVENTÁRIO FÍSICO-FINANCEIRO", `UG: ${ug}  |  ${bens.length} bens  |  Total: R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, orgao);
    let y = 175;
    const cols = [{ label: "Tombamento", width: 100 }, { label: "Descrição", width: 195 }, { label: "Classe", width: 100 }, { label: "Vl. Aquisição", width: 100 }];
    y = tableHeader(doc, y, cols);
    bens.forEach((b, i) => {
      if (y > 720) { doc.addPage(); y = 50; y = tableHeader(doc, y, cols); }
      y = tableRow(doc, y, [
        { value: b.numeroTombamento, width: 100 },
        { value: b.descricao, width: 195 },
        { value: b.classeNome ?? "—", width: 100 },
        { value: `R$ ${parseFloat(String(b.valorAquisicao ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, width: 100 },
      ], i % 2 === 0);
    });
    // Totalizador
    doc.rect(50, y, 495, 20).fill(BLUE);
    doc.fillColor("white").fontSize(9).font("Helvetica-Bold")
      .text(`Total Geral: R$ ${totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, 55, y + 6, { align: "right", width: 485 });
    footer(doc);
    doc.end();
  });
}

// ── 3. Depreciação ────────────────────────────────────────────────────────────
export async function gerarRelDepreciacao(
  depreciacoes: { bemId: number; periodoId: number; valorDepreciado: string | null; valorAcumulado: string | null; valorResidual: string | null }[],
  orgao: string, ug: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const totalDep = depreciacoes.reduce((acc, d) => acc + parseFloat(String(d.valorDepreciado ?? 0)), 0);
    header(doc, "RELATÓRIO DE DEPRECIAÇÃO MENSAL", `UG: ${ug}  |  ${depreciacoes.length} lançamentos  |  Total depreciado: R$ ${totalDep.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, orgao);
    let y = 175;
    const cols = [{ label: "Bem ID", width: 70 }, { label: "Período", width: 80 }, { label: "Vl. Depreciado", width: 115 }, { label: "Acumulado", width: 115 }, { label: "Residual", width: 115 }];
    y = tableHeader(doc, y, cols);
    depreciacoes.forEach((d, i) => {
      if (y > 720) { doc.addPage(); y = 50; y = tableHeader(doc, y, cols); }
      y = tableRow(doc, y, [
        { value: String(d.bemId), width: 70 },
        { value: `#${d.periodoId}`, width: 80 },
        { value: `R$ ${parseFloat(String(d.valorDepreciado ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, width: 115 },
        { value: `R$ ${parseFloat(String(d.valorAcumulado ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, width: 115 },
        { value: `R$ ${parseFloat(String(d.valorResidual ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, width: 115 },
      ], i % 2 === 0);
    });
    footer(doc);
    doc.end();
  });
}

// ── 4. Conciliação ────────────────────────────────────────────────────────────
export async function gerarRelConciliacao(
  eventos: { tipo: string; valor: string | null; historico: string; documentoRef: string | null; createdAt: Date }[],
  totalDebito: string, orgao: string, ug: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    header(doc, "RELATÓRIO DE CONCILIAÇÃO PATRIMONIAL", `UG: ${ug}  |  ${eventos.length} eventos  |  Total: R$ ${parseFloat(totalDebito).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, orgao);
    let y = 175;
    const cols = [{ label: "Data", width: 80 }, { label: "Tipo", width: 100 }, { label: "Histórico", width: 215 }, { label: "Valor", width: 100 }];
    y = tableHeader(doc, y, cols);
    eventos.forEach((e, i) => {
      if (y > 720) { doc.addPage(); y = 50; y = tableHeader(doc, y, cols); }
      y = tableRow(doc, y, [
        { value: new Date(e.createdAt).toLocaleDateString("pt-BR"), width: 80 },
        { value: e.tipo, width: 100 },
        { value: e.historico, width: 215 },
        { value: `R$ ${parseFloat(String(e.valor ?? 0)).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, width: 100 },
      ], i % 2 === 0);
    });
    footer(doc);
    doc.end();
  });
}

// ── 5. Cessões ────────────────────────────────────────────────────────────────
export async function gerarRelCessoes(
  cessoes: { cessionario: string; finalidade: string | null; dataInicio: Date | null; dataFim: Date | null; situacao: string; documentoRef: string | null }[],
  orgao: string, ug: string
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    header(doc, "RELATÓRIO DE CESSÕES DE IMÓVEIS", `UG: ${ug}  |  ${cessoes.length} cessões`, orgao);
    let y = 175;
    const cols = [{ label: "Cessionário", width: 155 }, { label: "Finalidade", width: 140 }, { label: "Início", width: 70 }, { label: "Fim", width: 70 }, { label: "Situação", width: 60 }];
    y = tableHeader(doc, y, cols);
    cessoes.forEach((c, i) => {
      if (y > 720) { doc.addPage(); y = 50; y = tableHeader(doc, y, cols); }
      y = tableRow(doc, y, [
        { value: c.cessionario, width: 155 },
        { value: c.finalidade ?? "—", width: 140 },
        { value: c.dataInicio ? new Date(c.dataInicio).toLocaleDateString("pt-BR") : "—", width: 70 },
        { value: c.dataFim ? new Date(c.dataFim).toLocaleDateString("pt-BR") : "Indeterminado", width: 70 },
        { value: c.situacao, width: 60 },
      ], i % 2 === 0);
    });
    footer(doc);
    doc.end();
  });
}

