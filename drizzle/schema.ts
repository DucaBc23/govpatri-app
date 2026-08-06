import {
  int, varchar, text, boolean, timestamp, date, decimal,
  json, mysqlEnum, mysqlTable, uniqueIndex, index, char
} from "drizzle-orm/mysql-core";

// ─── USERS (Manus Auth base) ──────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — TRANSVERSAL
// ═══════════════════════════════════════════════════════════════════════════════
export const orgaos = mysqlTable("orgaos", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  sigla: varchar("sigla", { length: 20 }),
  cnpj: varchar("cnpj", { length: 18 }),
  esfera: mysqlEnum("esfera", ["federal", "estadual", "municipal", "distrital"]).notNull(),
  uf: char("uf", { length: 2 }),
  municipio: varchar("municipio", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [uniqueIndex("orgaos_codigo_idx").on(t.codigo)]);

export const unidadesGestoras = mysqlTable("unidades_gestoras", {
  id: int("id").autoincrement().primaryKey(),
  orgaoId: int("orgaoId").notNull(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  sigla: varchar("sigla", { length: 20 }),
  cnpj: varchar("cnpj", { length: 18 }),
  tipo: mysqlEnum("tipo", ["ug_executora", "ug_gestora", "ug_setorial"]).default("ug_executora").notNull(),
  ugPaiId: int("ugPaiId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [uniqueIndex("ug_codigo_idx").on(t.codigo)]);

export const unidadesAdministrativas = mysqlTable("unidades_administrativas", {
  id: int("id").autoincrement().primaryKey(),
  ugId: int("ugId").notNull(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  sigla: varchar("sigla", { length: 20 }),
  uaPaiId: int("uaPaiId"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 2 — USUÁRIOS RBAC
// ═══════════════════════════════════════════════════════════════════════════════
export const govpatriUsers = mysqlTable("govpatri_users", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(), // FK → users.id
  perfil: mysqlEnum("perfil", ["admin", "gestor", "operador", "auditor"]).default("operador").notNull(),
  ugId: int("ugId"), // UG principal do usuário
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const userUgVinculos = mysqlTable("user_ug_vinculos", {
  id: int("id").autoincrement().primaryKey(),
  govpatriUserId: int("govpatriUserId").notNull(),
  ugId: int("ugId").notNull(),
  perfil: mysqlEnum("perfil", ["admin", "gestor", "operador", "auditor"]).default("operador").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [uniqueIndex("user_ug_idx").on(t.govpatriUserId, t.ugId)]);

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 3 — BENS MÓVEIS
// ═══════════════════════════════════════════════════════════════════════════════
export const classesBens = mysqlTable("classes_bens", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  contaPcasp: varchar("contaPcasp", { length: 20 }),
  vidaUtilAnos: int("vidaUtilAnos"),
  taxaDepreciacaoAnual: decimal("taxaDepreciacaoAnual", { precision: 5, scale: 4 }),
  valorResidualPerc: decimal("valorResidualPerc", { precision: 5, scale: 4 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [uniqueIndex("classes_bens_codigo_idx").on(t.codigo)]);

export const bensMoveisTable = mysqlTable("bens_moveis", {
  id: int("id").autoincrement().primaryKey(),
  numeroTombamento: varchar("numeroTombamento", { length: 30 }).notNull(),
  classeId: int("classeId").notNull(),
  ugId: int("ugId").notNull(),
  descricao: varchar("descricao", { length: 500 }).notNull(),
  marca: varchar("marca", { length: 100 }),
  modelo: varchar("modelo", { length: 100 }),
  numeroSerie: varchar("numeroSerie", { length: 100 }),
  anoFabricacao: int("anoFabricacao"),
  dataAquisicao: date("dataAquisicao"),
  valorAquisicao: decimal("valorAquisicao", { precision: 15, scale: 2 }).notNull(),
  valorAtual: decimal("valorAtual", { precision: 15, scale: 2 }),
  situacao: mysqlEnum("situacao", ["ativo", "em_manutencao", "inservivel", "baixado", "cedido"]).default("ativo").notNull(),
  localizacaoUaId: int("localizacaoUaId"),
  responsavelId: int("responsavelId"), // FK → govpatri_users.id
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [uniqueIndex("bens_tombamento_idx").on(t.numeroTombamento)]);

export const movimentacoesBens = mysqlTable("movimentacoes_bens", {
  id: int("id").autoincrement().primaryKey(),
  bemId: int("bemId").notNull(),
  tipo: mysqlEnum("tipo", ["incorporacao", "transferencia", "cessao", "baixa", "reavaliacao", "manutencao"]).notNull(),
  ugOrigemId: int("ugOrigemId"),
  ugDestinoId: int("ugDestinoId"),
  uaOrigemId: int("uaOrigemId"),
  uaDestinoId: int("uaDestinoId"),
  responsavelOrigemId: int("responsavelOrigemId"),
  responsavelDestinoId: int("responsavelDestinoId"),
  dataMovimentacao: date("dataMovimentacao").notNull(),
  valorAnterior: decimal("valorAnterior", { precision: 15, scale: 2 }),
  valorNovo: decimal("valorNovo", { precision: 15, scale: 2 }),
  justificativa: text("justificativa"),
  documentoRef: varchar("documentoRef", { length: 100 }),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const termosResponsabilidade = mysqlTable("termos_responsabilidade", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 30 }).notNull(),
  ugId: int("ugId").notNull(),
  responsavelId: int("responsavelId").notNull(),
  dataEmissao: date("dataEmissao").notNull(),
  dataVencimento: date("dataVencimento"),
  situacao: mysqlEnum("situacao", ["ativo", "encerrado", "substituido"]).default("ativo").notNull(),
  observacoes: text("observacoes"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [uniqueIndex("termos_numero_idx").on(t.numero)]);

export const termosItens = mysqlTable("termos_itens", {
  id: int("id").autoincrement().primaryKey(),
  termoId: int("termoId").notNull(),
  bemId: int("bemId").notNull(),
});

export const manutencoes = mysqlTable("manutencoes", {
  id: int("id").autoincrement().primaryKey(),
  bemId: int("bemId").notNull(),
  tipo: mysqlEnum("tipo", ["preventiva", "corretiva"]).notNull(),
  descricao: text("descricao").notNull(),
  dataInicio: date("dataInicio").notNull(),
  dataConclusao: date("dataConclusao"),
  custo: decimal("custo", { precision: 15, scale: 2 }),
  fornecedor: varchar("fornecedor", { length: 255 }),
  situacao: mysqlEnum("situacao", ["aberta", "em_andamento", "concluida"]).default("aberta").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 4 — ALMOXARIFADO
// ═══════════════════════════════════════════════════════════════════════════════
export const almoxItens = mysqlTable("almox_itens", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 30 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  descricao: text("descricao"),
  unidadeMedida: varchar("unidadeMedida", { length: 20 }).notNull(),
  categoria: varchar("categoria", { length: 100 }),
  estoqueMinimo: decimal("estoqueMinimo", { precision: 12, scale: 3 }).default("0"),
  estoqueMaximo: decimal("estoqueMaximo", { precision: 12, scale: 3 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [uniqueIndex("almox_itens_codigo_idx").on(t.codigo)]);

export const depositos = mysqlTable("depositos", {
  id: int("id").autoincrement().primaryKey(),
  ugId: int("ugId").notNull(),
  codigo: varchar("codigo", { length: 20 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  localizacao: varchar("localizacao", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const estoque = mysqlTable("estoque", {
  id: int("id").autoincrement().primaryKey(),
  depositoId: int("depositoId").notNull(),
  itemId: int("itemId").notNull(),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).default("0").notNull(),
  valorUnitarioMedio: decimal("valorUnitarioMedio", { precision: 15, scale: 4 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [uniqueIndex("estoque_dep_item_idx").on(t.depositoId, t.itemId)]);

export const movimentacoesAlmox = mysqlTable("movimentacoes_almox", {
  id: int("id").autoincrement().primaryKey(),
  depositoId: int("depositoId").notNull(),
  itemId: int("itemId").notNull(),
  tipo: mysqlEnum("tipo", ["entrada", "saida", "transferencia", "ajuste"]).notNull(),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).notNull(),
  valorUnitario: decimal("valorUnitario", { precision: 15, scale: 4 }),
  documentoRef: varchar("documentoRef", { length: 100 }),
  requisicaoId: int("requisicaoId"),
  observacoes: text("observacoes"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const requisicoesAlmox = mysqlTable("requisicoes_almox", {
  id: int("id").autoincrement().primaryKey(),
  numero: varchar("numero", { length: 30 }).notNull(),
  ugId: int("ugId").notNull(),
  solicitanteId: int("solicitanteId").notNull(),
  situacao: mysqlEnum("situacao", ["rascunho", "enviada", "aprovada", "atendida", "cancelada"]).default("rascunho").notNull(),
  justificativa: text("justificativa"),
  dataRequisicao: date("dataRequisicao").notNull(),
  dataAtendimento: date("dataAtendimento"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (t) => [uniqueIndex("req_almox_numero_idx").on(t.numero)]);

export const requisicoesItens = mysqlTable("requisicoes_itens", {
  id: int("id").autoincrement().primaryKey(),
  requisicaoId: int("requisicaoId").notNull(),
  itemId: int("itemId").notNull(),
  quantidadeSolicitada: decimal("quantidadeSolicitada", { precision: 12, scale: 3 }).notNull(),
  quantidadeAtendida: decimal("quantidadeAtendida", { precision: 12, scale: 3 }),
});

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 5 — BENS IMÓVEIS
// ═══════════════════════════════════════════════════════════════════════════════
export const bensImoveis = mysqlTable("bens_imoveis", {
  id: int("id").autoincrement().primaryKey(),
  ugId: int("ugId").notNull(),
  rip: varchar("rip", { length: 30 }),
  denominacao: varchar("denominacao", { length: 255 }).notNull(),
  tipo: mysqlEnum("tipo", ["terreno", "edificacao", "conjunto", "outros"]).notNull(),
  endereco: varchar("endereco", { length: 500 }),
  municipio: varchar("municipio", { length: 100 }),
  uf: char("uf", { length: 2 }),
  areaTotal: decimal("areaTotal", { precision: 15, scale: 2 }),
  areaConstruida: decimal("areaConstruida", { precision: 15, scale: 2 }),
  valorAvaliacao: decimal("valorAvaliacao", { precision: 15, scale: 2 }),
  dataAvaliacao: date("dataAvaliacao"),
  situacaoDominial: mysqlEnum("situacaoDominial", ["regular", "irregular", "em_regularizacao", "litigioso"]).default("regular").notNull(),
  situacaoOcupacao: mysqlEnum("situacaoOcupacao", ["proprio_uso", "cedido", "locado", "desocupado"]).default("proprio_uso").notNull(),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const ocupacoesImoveis = mysqlTable("ocupacoes_imoveis", {
  id: int("id").autoincrement().primaryKey(),
  imovelId: int("imovelId").notNull(),
  ocupante: varchar("ocupante", { length: 255 }).notNull(),
  tipoOcupacao: mysqlEnum("tipoOcupacao", ["uso_proprio", "cessao", "locacao", "comodato"]).notNull(),
  dataInicio: date("dataInicio").notNull(),
  dataFim: date("dataFim"),
  areaOcupada: decimal("areaOcupada", { precision: 15, scale: 2 }),
  valorMensal: decimal("valorMensal", { precision: 15, scale: 2 }),
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const cessoesImoveis = mysqlTable("cessoes_imoveis", {
  id: int("id").autoincrement().primaryKey(),
  imovelId: int("imovelId").notNull(),
  cessionario: varchar("cessionario", { length: 255 }).notNull(),
  finalidade: text("finalidade"),
  dataInicio: date("dataInicio").notNull(),
  dataFim: date("dataFim"),
  situacao: mysqlEnum("situacao", ["vigente", "encerrada", "vencida"]).default("vigente").notNull(),
  documentoRef: varchar("documentoRef", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const pendenciasImoveis = mysqlTable("pendencias_imoveis", {
  id: int("id").autoincrement().primaryKey(),
  imovelId: int("imovelId").notNull(),
  tipo: mysqlEnum("tipo", ["regularizacao_dominial", "averbacao", "demarcacao", "outros"]).notNull(),
  descricao: text("descricao").notNull(),
  prazo: date("prazo"),
  situacao: mysqlEnum("situacao", ["aberta", "em_andamento", "resolvida"]).default("aberta").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 6 — CAMADA CONTÁBIL (PCASP)
// ═══════════════════════════════════════════════════════════════════════════════
export const planoContas = mysqlTable("plano_contas", {
  id: int("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 30 }).notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  tipo: mysqlEnum("tipo", ["ativo", "passivo", "patrimonio", "receita", "despesa", "variacao"]).notNull(),
  natureza: mysqlEnum("natureza", ["devedora", "credora"]).notNull(),
  nivel: int("nivel").notNull(),
  contaPaiId: int("contaPaiId"),
  aceitaLancamento: boolean("aceitaLancamento").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [uniqueIndex("plano_contas_codigo_idx").on(t.codigo)]);

export const periodosContabeis = mysqlTable("periodos_contabeis", {
  id: int("id").autoincrement().primaryKey(),
  ugId: int("ugId").notNull(),
  ano: int("ano").notNull(),
  mes: int("mes").notNull(),
  situacao: mysqlEnum("situacao", ["aberto", "fechado", "reaberto"]).default("aberto").notNull(),
  dataAbertura: timestamp("dataAbertura").defaultNow().notNull(),
  dataFechamento: timestamp("dataFechamento"),
  fechadoPorId: int("fechadoPorId"),
}, (t) => [uniqueIndex("periodos_ug_ano_mes_idx").on(t.ugId, t.ano, t.mes)]);

export const eventosPatrimoniais = mysqlTable("eventos_patrimoniais", {
  id: int("id").autoincrement().primaryKey(),
  ugId: int("ugId").notNull(),
  periodoId: int("periodoId").notNull(),
  tipo: mysqlEnum("tipo", ["incorporacao", "baixa", "reavaliacao", "depreciacao", "cessao", "transferencia"]).notNull(),
  bemMovelId: int("bemMovelId"),
  bemImovelId: int("bemImovelId"),
  contaDebitoId: int("contaDebitoId").notNull(),
  contaCreditoId: int("contaCreditoId").notNull(),
  valor: decimal("valor", { precision: 15, scale: 2 }).notNull(),
  historico: text("historico").notNull(),
  documentoRef: varchar("documentoRef", { length: 100 }),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const depreciacaoMensal = mysqlTable("depreciacao_mensal", {
  id: int("id").autoincrement().primaryKey(),
  bemId: int("bemId").notNull(),
  ugId: int("ugId").notNull(),
  periodoId: int("periodoId").notNull(),
  valorDepreciado: decimal("valorDepreciado", { precision: 15, scale: 2 }).notNull(),
  valorAcumulado: decimal("valorAcumulado", { precision: 15, scale: 2 }).notNull(),
  valorResidual: decimal("valorResidual", { precision: 15, scale: 2 }).notNull(),
  eventoId: int("eventoId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [uniqueIndex("deprec_bem_periodo_idx").on(t.bemId, t.periodoId)]);

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 8 — TRILHA DE AUDITORIA
// ═══════════════════════════════════════════════════════════════════════════════
export const auditLogs = mysqlTable("audit_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  acao: varchar("acao", { length: 100 }).notNull(),
  entidade: varchar("entidade", { length: 100 }).notNull(),
  entidadeId: int("entidadeId"),
  dadosAntes: json("dadosAntes"),
  dadosDepois: json("dadosDepois"),
  hashSha256: varchar("hashSha256", { length: 64 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [index("audit_logs_entidade_idx").on(t.entidade, t.entidadeId)]);

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 9 — WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════════
export const workflowModelos = mysqlTable("workflow_modelos", {
  id: int("id").autoincrement().primaryKey(),
  nome: varchar("nome", { length: 255 }).notNull(),
  tipo: mysqlEnum("tipo", ["incorporacao", "baixa", "cessao", "desfazimento", "transferencia"]).notNull(),
  etapas: json("etapas").notNull(), // [{nome, perfil, ordem}]
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const workflowInstancias = mysqlTable("workflow_instancias", {
  id: int("id").autoincrement().primaryKey(),
  modeloId: int("modeloId").notNull(),
  ugId: int("ugId").notNull(),
  entidade: varchar("entidade", { length: 100 }).notNull(),
  entidadeId: int("entidadeId").notNull(),
  etapaAtual: int("etapaAtual").default(0).notNull(),
  situacao: mysqlEnum("situacao", ["em_andamento", "aprovado", "rejeitado", "cancelado"]).default("em_andamento").notNull(),
  solicitanteId: int("solicitanteId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const workflowDecisoes = mysqlTable("workflow_decisoes", {
  id: int("id").autoincrement().primaryKey(),
  instanciaId: int("instanciaId").notNull(),
  etapa: int("etapa").notNull(),
  decisao: mysqlEnum("decisao", ["aprovado", "rejeitado"]).notNull(),
  aprovadorId: int("aprovadorId").notNull(),
  justificativa: text("justificativa"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

// ═══════════════════════════════════════════════════════════════════════════════
// MÓDULO 10 — INVENTÁRIO CÍCLICO
// ═══════════════════════════════════════════════════════════════════════════════
export const inventarios = mysqlTable("inventarios", {
  id: int("id").autoincrement().primaryKey(),
  ugId: int("ugId").notNull(),
  nome: varchar("nome", { length: 255 }).notNull(),
  dataInicio: date("dataInicio").notNull(),
  dataFim: date("dataFim"),
  situacao: mysqlEnum("situacao", ["aberto", "em_coleta", "concluido", "cancelado"]).default("aberto").notNull(),
  responsavelId: int("responsavelId").notNull(),
  totalBens: int("totalBens").default(0).notNull(),
  totalColetados: int("totalColetados").default(0).notNull(),
  totalDivergencias: int("totalDivergencias").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const inventarioColetas = mysqlTable("inventario_coletas", {
  id: int("id").autoincrement().primaryKey(),
  inventarioId: int("inventarioId").notNull(),
  bemId: int("bemId").notNull(),
  situacaoEncontrada: mysqlEnum("situacaoEncontrada", ["encontrado", "nao_encontrado", "divergencia_localizacao", "divergencia_estado"]).notNull(),
  localizacaoEncontrada: varchar("localizacaoEncontrada", { length: 255 }),
  observacao: text("observacao"),
  coletadoPorId: int("coletadoPorId").notNull(),
  metodoColeta: mysqlEnum("metodoColeta", ["qrcode", "manual"]).default("manual").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => [uniqueIndex("inventario_coleta_bem_idx").on(t.inventarioId, t.bemId)]);

export type Inventario = typeof inventarios.$inferSelect;
export type InventarioColeta = typeof inventarioColetas.$inferSelect;
