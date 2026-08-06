import PDFDocument from "pdfkit";
import { Readable } from "stream";

interface BemData {
  numeroTombamento: string;
  descricao: string;
  marca?: string | null;
  modelo?: string | null;
  numeroSerie?: string | null;
  valorAquisicao: string;
  dataAquisicao?: string | null;
  localizacao?: string | null;
}

interface TermoData {
  bem: BemData;
  responsavel: { nome: string; cargo?: string | null; matricula?: string | null };
  orgao: { nome: string; sigla?: string | null };
  ug: { nome: string; codigo: string };
  dataEmissao: string;
  numero: string;
}

export async function gerarTermoResponsabilidadePdf(data: TermoData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const blue = "#1e3a5f";
    const gray = "#555555";
    const lightGray = "#f5f5f5";

    // ── Cabeçalho ──────────────────────────────────────────────────────────────
    doc.rect(50, 50, 495, 70).fill(blue);
    doc.fillColor("white").fontSize(18).font("Helvetica-Bold")
      .text("GOVPatri", 60, 65);
    doc.fontSize(10).font("Helvetica")
      .text("Plataforma Inteligente de Gestão Patrimonial Pública", 60, 88);
    doc.fontSize(9).text(`${data.orgao.nome}${data.orgao.sigla ? ` — ${data.orgao.sigla}` : ""}`, 60, 103);

    // ── Título do documento ────────────────────────────────────────────────────
    doc.fillColor(blue).fontSize(14).font("Helvetica-Bold")
      .text("TERMO DE RESPONSABILIDADE", 50, 140, { align: "center", width: 495 });
    doc.fillColor(gray).fontSize(9).font("Helvetica")
      .text(`Nº ${data.numero}  |  Emitido em: ${data.dataEmissao}`, 50, 160, { align: "center", width: 495 });

    // ── Linha separadora ───────────────────────────────────────────────────────
    doc.moveTo(50, 178).lineTo(545, 178).strokeColor(blue).lineWidth(1.5).stroke();

    // ── Dados do Bem ───────────────────────────────────────────────────────────
    doc.rect(50, 190, 495, 20).fill(blue);
    doc.fillColor("white").fontSize(10).font("Helvetica-Bold")
      .text("DADOS DO BEM PATRIMONIAL", 60, 195);

    const campos = [
      ["Número de Tombamento", data.bem.numeroTombamento],
      ["Descrição", data.bem.descricao],
      ["Marca / Modelo", [data.bem.marca, data.bem.modelo].filter(Boolean).join(" / ") || "—"],
      ["Número de Série", data.bem.numeroSerie || "—"],
      ["Valor de Aquisição", `R$ ${parseFloat(data.bem.valorAquisicao).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
      ["Data de Aquisição", data.bem.dataAquisicao ? new Date(data.bem.dataAquisicao).toLocaleDateString("pt-BR") : "—"],
      ["Localização", data.bem.localizacao || "—"],
      ["Unidade Gestora", `${data.ug.nome} (${data.ug.codigo})`],
    ];

    let y = 220;
    campos.forEach(([label, value], i) => {
      if (i % 2 === 0) doc.rect(50, y, 495, 22).fill(lightGray);
      doc.fillColor(gray).fontSize(8).font("Helvetica-Bold").text(label + ":", 60, y + 5);
      doc.fillColor("#222").fontSize(9).font("Helvetica").text(String(value), 200, y + 5, { width: 330 });
      y += 22;
    });

    // ── Dados do Responsável ───────────────────────────────────────────────────
    y += 10;
    doc.rect(50, y, 495, 20).fill(blue);
    doc.fillColor("white").fontSize(10).font("Helvetica-Bold")
      .text("RESPONSÁVEL PELA GUARDA E CONSERVAÇÃO", 60, y + 5);
    y += 30;

    const respCampos = [
      ["Nome", data.responsavel.nome],
      ["Cargo / Função", data.responsavel.cargo || "—"],
      ["Matrícula", data.responsavel.matricula || "—"],
    ];
    respCampos.forEach(([label, value], i) => {
      if (i % 2 === 0) doc.rect(50, y, 495, 22).fill(lightGray);
      doc.fillColor(gray).fontSize(8).font("Helvetica-Bold").text(label + ":", 60, y + 5);
      doc.fillColor("#222").fontSize(9).font("Helvetica").text(String(value), 200, y + 5);
      y += 22;
    });

    // ── Declaração ────────────────────────────────────────────────────────────
    y += 20;
    doc.fillColor("#222").fontSize(9).font("Helvetica")
      .text(
        "Declaro que recebi o bem patrimonial descrito acima em perfeitas condições de uso e que me responsabilizo pela sua guarda, conservação e utilização exclusiva nas atividades do serviço público, comprometendo-me a comunicar imediatamente qualquer ocorrência que possa afetar sua integridade ou localização.",
        50, y, { width: 495, align: "justify" }
      );

    // ── Assinaturas ───────────────────────────────────────────────────────────
    y += 70;
    doc.moveTo(50, y).lineTo(240, y).strokeColor("#999").lineWidth(0.5).stroke();
    doc.moveTo(305, y).lineTo(545, y).strokeColor("#999").lineWidth(0.5).stroke();
    doc.fillColor(gray).fontSize(8).font("Helvetica")
      .text("Responsável pelo Bem", 50, y + 5, { width: 190, align: "center" })
      .text("Gestor Patrimonial / Autoridade Competente", 305, y + 5, { width: 240, align: "center" });

    // ── Rodapé ────────────────────────────────────────────────────────────────
    doc.rect(50, 760, 495, 25).fill(blue);
    doc.fillColor("white").fontSize(7).font("Helvetica")
      .text(`GOVPatri — Documento gerado em ${data.dataEmissao}  |  Este documento tem validade jurídica conforme a Lei nº 8.159/1991`, 55, 768, { width: 485, align: "center" });

    doc.end();
  });
}

