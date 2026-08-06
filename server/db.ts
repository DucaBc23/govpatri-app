import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';
import { eq, desc, and, sql } from "drizzle-orm";
import {
  orgaos, unidadesGestoras, unidadesAdministrativas,
  govpatriUsers,
  bensMoveisTable,
  almoxItens, depositos, estoque,
  bensImoveis,
  planoContas, periodosContabeis,
  auditLogs,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// TODO: add feature queries here as your schema grows.

// ─── TRANSVERSAL ─────────────────────────────────────────────────────────────
export async function listOrgaos(onlyActive = true) {
  const db = await getDb();
  if (!db) return [];
  const q = db.select().from(orgaos);
  if (onlyActive) return q.where(eq(orgaos.isActive, true));
  return q;
}

export async function listUGs(orgaoId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (orgaoId) return db.select().from(unidadesGestoras).where(and(eq(unidadesGestoras.orgaoId, orgaoId), eq(unidadesGestoras.isActive, true)));
  return db.select().from(unidadesGestoras).where(eq(unidadesGestoras.isActive, true));
}

export async function listUAs(ugId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(unidadesAdministrativas).where(and(eq(unidadesAdministrativas.ugId, ugId), eq(unidadesAdministrativas.isActive, true)));
}

// ─── USUÁRIOS GOVPATRI ────────────────────────────────────────────────────────
export async function listGovpatriUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: govpatriUsers.id,
    userId: govpatriUsers.userId,
    perfil: govpatriUsers.perfil,
    ugId: govpatriUsers.ugId,
    isActive: govpatriUsers.isActive,
    userName: users.name,
    userEmail: users.email,
  }).from(govpatriUsers).leftJoin(users, eq(govpatriUsers.userId, users.id));
}

export async function getGovpatriUserByUserId(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(govpatriUsers).where(eq(govpatriUsers.userId, userId)).limit(1);
  return result[0] ?? null;
}

// ─── BENS MÓVEIS ─────────────────────────────────────────────────────────────
export async function listBensMoveis(ugId?: number, situacao?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (ugId) conditions.push(eq(bensMoveisTable.ugId, ugId));
  if (situacao) conditions.push(eq(bensMoveisTable.situacao, situacao as "ativo"));
  if (conditions.length > 0) return db.select().from(bensMoveisTable).where(and(...conditions)).orderBy(desc(bensMoveisTable.createdAt));
  return db.select().from(bensMoveisTable).orderBy(desc(bensMoveisTable.createdAt));
}

export async function getProximoTombamento(ugId: number): Promise<string> {
  const db = await getDb();
  if (!db) return `BM-${ugId}-0001`;
  const result = await db.select({ count: sql<number>`COUNT(*)` }).from(bensMoveisTable).where(eq(bensMoveisTable.ugId, ugId));
  const count = (result[0]?.count ?? 0) + 1;
  return `BM-${ugId}-${String(count).padStart(4, "0")}`;
}

// ─── ALMOXARIFADO ─────────────────────────────────────────────────────────────
export async function listAlmoxItens(onlyActive = true) {
  const db = await getDb();
  if (!db) return [];
  if (onlyActive) return db.select().from(almoxItens).where(eq(almoxItens.isActive, true));
  return db.select().from(almoxItens);
}

export async function listDepositos(ugId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (ugId) return db.select().from(depositos).where(and(eq(depositos.ugId, ugId), eq(depositos.isActive, true)));
  return db.select().from(depositos).where(eq(depositos.isActive, true));
}

export async function getEstoqueByDeposito(depositoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: estoque.id,
    itemId: estoque.itemId,
    quantidade: estoque.quantidade,
    valorUnitarioMedio: estoque.valorUnitarioMedio,
    itemNome: almoxItens.nome,
    itemCodigo: almoxItens.codigo,
    itemUnidade: almoxItens.unidadeMedida,
    estoqueMinimo: almoxItens.estoqueMinimo,
  }).from(estoque)
    .leftJoin(almoxItens, eq(estoque.itemId, almoxItens.id))
    .where(eq(estoque.depositoId, depositoId));
}

// ─── BENS IMÓVEIS ─────────────────────────────────────────────────────────────
export async function listBensImoveis(ugId?: number) {
  const db = await getDb();
  if (!db) return [];
  if (ugId) return db.select().from(bensImoveis).where(eq(bensImoveis.ugId, ugId)).orderBy(desc(bensImoveis.createdAt));
  return db.select().from(bensImoveis).orderBy(desc(bensImoveis.createdAt));
}

// ─── CONTÁBIL ─────────────────────────────────────────────────────────────────
export async function listPlanoContas() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(planoContas).where(eq(planoContas.isActive, true)).orderBy(planoContas.codigo);
}

export async function getPeriodoAtivo(ugId: number) {
  const db = await getDb();
  if (!db) return null;
  const now = new Date();
  const result = await db.select().from(periodosContabeis)
    .where(and(eq(periodosContabeis.ugId, ugId), eq(periodosContabeis.situacao, "aberto"), eq(periodosContabeis.ano, now.getFullYear()), eq(periodosContabeis.mes, now.getMonth() + 1)))
    .limit(1);
  return result[0] ?? null;
}

// ─── DASHBOARD / ISP ──────────────────────────────────────────────────────────
export async function getKpisPatrimoniais(ugId?: number) {
  const db = await getDb();
  if (!db) return { totalBensMoveis: 0, totalBensImoveis: 0, totalAlmoxarifado: 0, valorPatrimonial: "0" };

  const bmQuery = ugId
    ? db.select({ count: sql<number>`COUNT(*)`, valor: sql<string>`COALESCE(SUM(valorAtual), 0)` }).from(bensMoveisTable).where(and(eq(bensMoveisTable.ugId, ugId), eq(bensMoveisTable.situacao, "ativo")))
    : db.select({ count: sql<number>`COUNT(*)`, valor: sql<string>`COALESCE(SUM(valorAtual), 0)` }).from(bensMoveisTable).where(eq(bensMoveisTable.situacao, "ativo"));

  const biQuery = ugId
    ? db.select({ count: sql<number>`COUNT(*)` }).from(bensImoveis).where(eq(bensImoveis.ugId, ugId))
    : db.select({ count: sql<number>`COUNT(*)` }).from(bensImoveis);

  const [bm, bi] = await Promise.all([bmQuery, biQuery]);
  return {
    totalBensMoveis: bm[0]?.count ?? 0,
    totalBensImoveis: bi[0]?.count ?? 0,
    valorPatrimonial: bm[0]?.valor ?? "0",
  };
}

// ─── AUDITORIA ────────────────────────────────────────────────────────────────
export async function listAuditLogs(entidade?: string, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  if (entidade) return db.select().from(auditLogs).where(eq(auditLogs.entidade, entidade)).orderBy(desc(auditLogs.createdAt)).limit(limit);
  return db.select().from(auditLogs).orderBy(desc(auditLogs.createdAt)).limit(limit);
}
