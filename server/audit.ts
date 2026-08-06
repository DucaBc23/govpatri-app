import { createHash } from "crypto";
import { getDb } from "./db";
import { auditLogs } from "../drizzle/schema";

export interface AuditEntry {
  userId: number;
  acao: string;
  entidade: string;
  entidadeId?: number;
  dadosAntes?: unknown;
  dadosDepois?: unknown;
  ipAddress?: string;
}

export async function registrarAuditoria(entry: AuditEntry): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const payload = JSON.stringify({
    userId: entry.userId,
    acao: entry.acao,
    entidade: entry.entidade,
    entidadeId: entry.entidadeId,
    dadosAntes: entry.dadosAntes,
    dadosDepois: entry.dadosDepois,
    timestamp: new Date().toISOString(),
  });

  const hashSha256 = createHash("sha256").update(payload).digest("hex");

  await db.insert(auditLogs).values({
    userId: entry.userId,
    acao: entry.acao,
    entidade: entry.entidade,
    entidadeId: entry.entidadeId ?? null,
    dadosAntes: entry.dadosAntes ? entry.dadosAntes : null,
    dadosDepois: entry.dadosDepois ? entry.dadosDepois : null,
    hashSha256,
    ipAddress: entry.ipAddress ?? null,
  });
}
