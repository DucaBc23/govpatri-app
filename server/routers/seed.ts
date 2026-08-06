import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { getDb } from "../db";
import {
  orgaos, unidadesGestoras, classesBens, planoContas
} from "../../drizzle/schema";

export const seedRouter = router({
  inicializar: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new Error("Banco de dados indisponível");

    // 1. Órgão padrão
    const [orgao] = await db.insert(orgaos).values({
      codigo: "001",
      nome: "Secretaria de Estado da Administração",
      sigla: "SEAD",
      esfera: "estadual",
      uf: "MA",
      municipio: "São Luís",
    }).onDuplicateKeyUpdate({ set: { nome: "Secretaria de Estado da Administração" } });

    // Buscar o órgão criado
    const { eq } = await import("drizzle-orm");
    const orgaoRows = await db.select().from(orgaos).where(eq(orgaos.codigo, "001")).limit(1);
    const orgaoId = orgaoRows[0]?.id;
    if (!orgaoId) throw new Error("Falha ao criar órgão");

    // 2. Unidade Gestora padrão
    await db.insert(unidadesGestoras).values({
      orgaoId,
      codigo: "001001",
      nome: "Unidade Gestora Central — SEAD",
      sigla: "UGC-SEAD",
      tipo: "ug_gestora",
    }).onDuplicateKeyUpdate({ set: { nome: "Unidade Gestora Central — SEAD" } });

    // 3. Classes de Bens PCASP (principais)
    const classesSeed = [
      { codigo: "1.2.3.1.1", nome: "Móveis e Utensílios", vidaUtilAnos: 10, taxaDepreciacao: "0.10", valorResidualPerc: "0.10", contaPatrimonialPcasp: "1.2.3.1.1.00.00" },
      { codigo: "1.2.3.1.2", nome: "Equipamentos de Processamento de Dados", vidaUtilAnos: 5, taxaDepreciacao: "0.20", valorResidualPerc: "0.10", contaPatrimonialPcasp: "1.2.3.1.2.00.00" },
      { codigo: "1.2.3.1.3", nome: "Aparelhos e Equipamentos de Comunicação", vidaUtilAnos: 10, taxaDepreciacao: "0.10", valorResidualPerc: "0.10", contaPatrimonialPcasp: "1.2.3.1.3.00.00" },
      { codigo: "1.2.3.1.4", nome: "Máquinas, Utensílios e Equipamentos Diversos", vidaUtilAnos: 10, taxaDepreciacao: "0.10", valorResidualPerc: "0.10", contaPatrimonialPcasp: "1.2.3.1.4.00.00" },
      { codigo: "1.2.3.1.5", nome: "Equipamentos e Utensílios Hidráulicos e Elétricos", vidaUtilAnos: 10, taxaDepreciacao: "0.10", valorResidualPerc: "0.10", contaPatrimonialPcasp: "1.2.3.1.5.00.00" },
      { codigo: "1.2.3.1.6", nome: "Veículos em Geral", vidaUtilAnos: 5, taxaDepreciacao: "0.20", valorResidualPerc: "0.20", contaPatrimonialPcasp: "1.2.3.1.6.00.00" },
      { codigo: "1.2.3.1.7", nome: "Obras de Arte e Peças para Museu", vidaUtilAnos: 0, taxaDepreciacao: "0.00", valorResidualPerc: "1.00", contaPatrimonialPcasp: "1.2.3.1.7.00.00" },
      { codigo: "1.2.3.1.8", nome: "Equipamentos de Proteção, Segurança e Socorro", vidaUtilAnos: 10, taxaDepreciacao: "0.10", valorResidualPerc: "0.10", contaPatrimonialPcasp: "1.2.3.1.8.00.00" },
    ];
    for (const c of classesSeed) {
      await db.insert(classesBens).values(c).onDuplicateKeyUpdate({ set: { nome: c.nome } });
    }

    // 4. Plano de Contas PCASP básico
    const contasSeed = [
      { codigo: "1.2.3.1.1.00.00", nome: "Móveis e Utensílios", tipo: "ativo" as const, natureza: "devedora" as const, nivel: 7, aceitaLancamento: true },
      { codigo: "1.2.3.1.2.00.00", nome: "Equipamentos de Processamento de Dados", tipo: "ativo" as const, natureza: "devedora" as const, nivel: 7, aceitaLancamento: true },
      { codigo: "1.2.3.1.6.00.00", nome: "Veículos em Geral", tipo: "ativo" as const, natureza: "devedora" as const, nivel: 7, aceitaLancamento: true },
      { codigo: "3.3.1.1.1.00.00", nome: "Depreciação — Bens Móveis", tipo: "variacao" as const, natureza: "credora" as const, nivel: 7, aceitaLancamento: true },
      { codigo: "1.2.9.1.1.00.00", nome: "Depreciação Acumulada — Bens Móveis", tipo: "ativo" as const, natureza: "credora" as const, nivel: 7, aceitaLancamento: true },
    ];
    for (const c of contasSeed) {
      await db.insert(planoContas).values(c).onDuplicateKeyUpdate({ set: { nome: c.nome } });
    }

    return { ok: true, mensagem: "Dados iniciais criados com sucesso!" };
  }),
});
