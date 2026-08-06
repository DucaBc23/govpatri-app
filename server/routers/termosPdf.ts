import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { bensMoveisTable, unidadesGestoras, orgaos, termosResponsabilidade, govpatriUsers, users } from "../../drizzle/schema";
import { eq } from "drizzle-orm";
import { gerarTermoResponsabilidadePdf } from "../pdfTermos";
import { registrarAuditoria } from "../audit";

export const termosPdfRouter = router({
  emitir: protectedProcedure
    .input(z.object({ bemId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB indisponível");

      // Buscar dados do bem
      const [bem] = await db.select({
        id: bensMoveisTable.id,
        tombamento: bensMoveisTable.numeroTombamento,
        descricao: bensMoveisTable.descricao,
        marca: bensMoveisTable.marca,
        modelo: bensMoveisTable.modelo,
        numeroSerie: bensMoveisTable.numeroSerie,
        valorAquisicao: bensMoveisTable.valorAquisicao,
        dataAquisicao: bensMoveisTable.dataAquisicao,
        localizacaoUaId: bensMoveisTable.localizacaoUaId,
        ugId: bensMoveisTable.ugId,
      }).from(bensMoveisTable).where(eq(bensMoveisTable.id, input.bemId)).limit(1);
      if (!bem) throw new Error("Bem não encontrado");

      // Buscar UG e Órgão
      const [ug] = await db.select().from(unidadesGestoras)
        .where(eq(unidadesGestoras.id, bem.ugId)).limit(1);
      const [orgao] = ug ? await db.select().from(orgaos)
        .where(eq(orgaos.id, ug.orgaoId)).limit(1) : [null];

      // Número do termo
      const numero = `TR-${String(bem.ugId).padStart(4, "0")}-${String(bem.id).padStart(6, "0")}-${new Date().getFullYear()}`;

      // Gerar PDF
      const pdfBuffer = await gerarTermoResponsabilidadePdf({
        bem: {
          numeroTombamento: bem.tombamento,
          descricao: bem.descricao,
          marca: bem.marca,
          modelo: bem.modelo,
          numeroSerie: bem.numeroSerie,
          valorAquisicao: String(bem.valorAquisicao),
          dataAquisicao: bem.dataAquisicao ? String(bem.dataAquisicao) : null,
          localizacao: bem.localizacaoUaId ? `UA #${bem.localizacaoUaId}` : null,
        },
        responsavel: {
          nome: ctx.user.name ?? "Responsável",
          cargo: null,
          matricula: null,
        },
        orgao: { nome: orgao?.nome ?? "Órgão", sigla: orgao?.sigla },
        ug: { nome: ug?.nome ?? "UG", codigo: ug?.codigo ?? "" },
        dataEmissao: new Date().toLocaleDateString("pt-BR"),
        numero,
      });

      await registrarAuditoria({
        userId: ctx.user.id,
        acao: "EMITIR_TERMO",
        entidade: "bens_moveis",
        entidadeId: input.bemId,
        dadosDepois: { numero },
      });

      // Retornar como base64 para o frontend fazer download
      return {
        numero,
        pdfBase64: pdfBuffer.toString("base64"),
        filename: `Termo_${bem.tombamento}_${new Date().getFullYear()}.pdf`,
      };
    }),
});
