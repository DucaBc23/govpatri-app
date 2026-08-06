# GOVPatri — Sistema de Gestão Patrimonial Pública

## Módulo 1 — Transversal
- [x] Schema: tabelas orgaos, unidades_gestoras, unidades_administrativas, setores
- [x] Router: CRUD de Órgãos (list, create, update, delete)
- [x] Router: CRUD de Unidades Gestoras (list, create, update, delete)
- [x] Router: CRUD de Unidades Administrativas (list, create, update, delete)
- [x] Página: Listagem e formulário de Órgãos
- [x] Página: Listagem e formulário de Unidades Gestoras
- [x] Página: Listagem e formulário de Unidades Administrativas

## Módulo 2 — Gestão de Usuários (RBAC)
- [x] Schema: tabela govpatri_users (perfis: admin, gestor, operador, auditor), user_ug_vinculos
- [x] Router: CRUD de usuários com perfis e vínculos a UG
- [x] Middleware: verificação de perfil por módulo
- [x] Página: Listagem e formulário de Usuários
- [x] Página: Gerenciamento de vínculos usuário-UG

## Módulo 3 — Bens Móveis
- [x] Schema: tabelas classes_bens, bens_moveis, movimentacoes_bens, termos_responsabilidade, manutencoes, desfazimentos
- [x] Router: CRUD de Bens Móveis com tombamento automático
- [x] Router: Movimentações e custódia
- [x] Router: Termos de responsabilidade
- [x] Router: Manutenções
- [x] Página: Listagem de bens com filtros avançados
- [x] Página: Formulário de cadastro/edição de bem
- [x] Página: Histórico de movimentações
- [x] Página: Termos de responsabilidade

## Módulo 4 — Almoxarifado
- [x] Schema: tabelas almox_itens, depositos, estoque, movimentacoes_almox, requisicoes_material, inventarios_almox
- [x] Router: CRUD de itens do catálogo
- [x] Router: Controle de estoque por depósito
- [x] Router: Fluxo de requisições de material
- [x] Página: Catálogo de itens
- [x] Página: Estoque por depósito
- [x] Página: Requisições de material

## Módulo 5 — Bens Imóveis
- [x] Schema: tabelas bens_imoveis, ocupacoes_imoveis, cessoes_imoveis, pendencias_imoveis
- [x] Router: CRUD de Bens Imóveis (cadastro dominial)
- [x] Router: Ocupações e cessões
- [x] Router: Pendências de regularização
- [x] Página: Listagem de imóveis
- [x] Página: Formulário dominial
- [x] Página: Ocupações e cessões
- [x] Página: Pendências

## Módulo 6 — Camada Contábil (PCASP)
- [x] Schema: tabelas plano_contas, eventos_patrimoniais, depreciacao_mensal, periodos_contabeis
- [x] Router: Plano de contas PCASP
- [x] Router: Eventos patrimoniais com lançamentos
- [x] Router: Depreciação mensal automática
- [x] Router: Períodos contábeis (abertura/fechamento)
- [x] Página: Plano de contas
- [x] Página: Eventos patrimoniais
- [x] Página: Depreciação mensal
- [x] Página: Períodos contábeis

## Módulo 7 — Dashboard e ISP
- [x] Router: KPIs patrimoniais por UG
- [x] Router: Cálculo do ISP (Índice de Saúde Patrimonial)
- [x] Router: Alertas de auditoria preventiva
- [x] Página: Dashboard principal com KPIs
- [x] Componente: Painel ISP por UG (gauge visual)
- [x] Componente: Painel de alertas

## Módulo 8 — Trilha de Auditoria
- [x] Schema: tabela audit_logs com hash SHA-256
- [x] Utilitário: função de hash SHA-256 para operações patrimoniais (server/audit.ts)
- [x] Router: Consulta à trilha de auditoria
- [x] Página: Visualização da trilha de auditoria

## Módulo 9 — Workflow
- [x] Schema: tabelas workflow_modelos, workflow_instancias, workflow_decisoes
- [x] Router: Criação e gestão de workflows
- [x] Router: Aprovação/rejeição de etapas
- [x] Página: Painel de workflow (pendências do usuário)
- [x] Página: Configuração de modelos de workflow

## Módulo 10 — Relatórios SEPAT
- [x] Router: Relatório de movimentação patrimonial
- [x] Router: Relatório de inventário físico-financeiro
- [x] Router: Relatório de depreciação
- [x] Router: Relatório de conciliação
- [x] Router: Relatório de cessões
- [x] Página: Central de relatórios SEPAT

## Infraestrutura
- [x] Tema e layout global (sidebar azul institucional GOVPatri)
- [x] Fontes Inter + JetBrains Mono configuradas
- [x] App.tsx com todas as rotas (13 rotas)
- [x] GovLayout com sidebar hierárquica por módulo
- [x] Testes vitest — auth.logout passando

## Próximos Passos
- [x] Seed de dados iniciais: Órgão padrão, UG padrão, classes de bens PCASP
- [x] Router: endpoint de seed via tRPC (admin only)
- [x] Página: botão "Inicializar dados" no Dashboard para admin
- [x] Instalar pdfkit ou similar no servidor para geração de PDF
- [x] Router: endpoint de geração de Termo de Responsabilidade em PDF
- [x] Página: botão "Emitir Termo" na listagem de Bens Móveis
- [x] Instalar qrcode no servidor para geração de QR Code
- [x] Schema: tabelas inventarios e inventario_coletas
- [x] Router: criar inventário, registrar coleta, gerar divergências
- [x] Página: módulo de Inventário com QR Code imprimível por bem
- [x] Página: tela de coleta de inventário (scan/manual)
