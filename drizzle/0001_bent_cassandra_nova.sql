CREATE TABLE `almox_itens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(30) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`descricao` text,
	`unidadeMedida` varchar(20) NOT NULL,
	`categoria` varchar(100),
	`estoqueMinimo` decimal(12,3) DEFAULT '0',
	`estoqueMaximo` decimal(12,3),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `almox_itens_id` PRIMARY KEY(`id`),
	CONSTRAINT `almox_itens_codigo_idx` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`acao` varchar(100) NOT NULL,
	`entidade` varchar(100) NOT NULL,
	`entidadeId` int,
	`dadosAntes` json,
	`dadosDepois` json,
	`hashSha256` varchar(64) NOT NULL,
	`ipAddress` varchar(45),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bens_imoveis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ugId` int NOT NULL,
	`rip` varchar(30),
	`denominacao` varchar(255) NOT NULL,
	`tipo` enum('terreno','edificacao','conjunto','outros') NOT NULL,
	`endereco` varchar(500),
	`municipio` varchar(100),
	`uf` char(2),
	`areaTotal` decimal(15,2),
	`areaConstruida` decimal(15,2),
	`valorAvaliacao` decimal(15,2),
	`dataAvaliacao` date,
	`situacaoDominial` enum('regular','irregular','em_regularizacao','litigioso') NOT NULL DEFAULT 'regular',
	`situacaoOcupacao` enum('proprio_uso','cedido','locado','desocupado') NOT NULL DEFAULT 'proprio_uso',
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bens_imoveis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bens_moveis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numeroTombamento` varchar(30) NOT NULL,
	`classeId` int NOT NULL,
	`ugId` int NOT NULL,
	`descricao` varchar(500) NOT NULL,
	`marca` varchar(100),
	`modelo` varchar(100),
	`numeroSerie` varchar(100),
	`anoFabricacao` int,
	`dataAquisicao` date,
	`valorAquisicao` decimal(15,2) NOT NULL,
	`valorAtual` decimal(15,2),
	`situacao` enum('ativo','em_manutencao','inservivel','baixado','cedido') NOT NULL DEFAULT 'ativo',
	`localizacaoUaId` int,
	`responsavelId` int,
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bens_moveis_id` PRIMARY KEY(`id`),
	CONSTRAINT `bens_tombamento_idx` UNIQUE(`numeroTombamento`)
);
--> statement-breakpoint
CREATE TABLE `cessoes_imoveis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imovelId` int NOT NULL,
	`cessionario` varchar(255) NOT NULL,
	`finalidade` text,
	`dataInicio` date NOT NULL,
	`dataFim` date,
	`situacao` enum('vigente','encerrada','vencida') NOT NULL DEFAULT 'vigente',
	`documentoRef` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cessoes_imoveis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `classes_bens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`contaPcasp` varchar(20),
	`vidaUtilAnos` int,
	`taxaDepreciacaoAnual` decimal(5,4),
	`valorResidualPerc` decimal(5,4),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `classes_bens_id` PRIMARY KEY(`id`),
	CONSTRAINT `classes_bens_codigo_idx` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `depositos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ugId` int NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`localizacao` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `depositos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `depreciacao_mensal` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bemId` int NOT NULL,
	`ugId` int NOT NULL,
	`periodoId` int NOT NULL,
	`valorDepreciado` decimal(15,2) NOT NULL,
	`valorAcumulado` decimal(15,2) NOT NULL,
	`valorResidual` decimal(15,2) NOT NULL,
	`eventoId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `depreciacao_mensal_id` PRIMARY KEY(`id`),
	CONSTRAINT `deprec_bem_periodo_idx` UNIQUE(`bemId`,`periodoId`)
);
--> statement-breakpoint
CREATE TABLE `estoque` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depositoId` int NOT NULL,
	`itemId` int NOT NULL,
	`quantidade` decimal(12,3) NOT NULL DEFAULT '0',
	`valorUnitarioMedio` decimal(15,4),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `estoque_id` PRIMARY KEY(`id`),
	CONSTRAINT `estoque_dep_item_idx` UNIQUE(`depositoId`,`itemId`)
);
--> statement-breakpoint
CREATE TABLE `eventos_patrimoniais` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ugId` int NOT NULL,
	`periodoId` int NOT NULL,
	`tipo` enum('incorporacao','baixa','reavaliacao','depreciacao','cessao','transferencia') NOT NULL,
	`bemMovelId` int,
	`bemImovelId` int,
	`contaDebitoId` int NOT NULL,
	`contaCreditoId` int NOT NULL,
	`valor` decimal(15,2) NOT NULL,
	`historico` text NOT NULL,
	`documentoRef` varchar(100),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventos_patrimoniais_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `govpatri_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`perfil` enum('admin','gestor','operador','auditor') NOT NULL DEFAULT 'operador',
	`ugId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `govpatri_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `govpatri_users_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `manutencoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bemId` int NOT NULL,
	`tipo` enum('preventiva','corretiva') NOT NULL,
	`descricao` text NOT NULL,
	`dataInicio` date NOT NULL,
	`dataConclusao` date,
	`custo` decimal(15,2),
	`fornecedor` varchar(255),
	`situacao` enum('aberta','em_andamento','concluida') NOT NULL DEFAULT 'aberta',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `manutencoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimentacoes_almox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depositoId` int NOT NULL,
	`itemId` int NOT NULL,
	`tipo` enum('entrada','saida','transferencia','ajuste') NOT NULL,
	`quantidade` decimal(12,3) NOT NULL,
	`valorUnitario` decimal(15,4),
	`documentoRef` varchar(100),
	`requisicaoId` int,
	`observacoes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentacoes_almox_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `movimentacoes_bens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bemId` int NOT NULL,
	`tipo` enum('incorporacao','transferencia','cessao','baixa','reavaliacao','manutencao') NOT NULL,
	`ugOrigemId` int,
	`ugDestinoId` int,
	`uaOrigemId` int,
	`uaDestinoId` int,
	`responsavelOrigemId` int,
	`responsavelDestinoId` int,
	`dataMovimentacao` date NOT NULL,
	`valorAnterior` decimal(15,2),
	`valorNovo` decimal(15,2),
	`justificativa` text,
	`documentoRef` varchar(100),
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `movimentacoes_bens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ocupacoes_imoveis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imovelId` int NOT NULL,
	`ocupante` varchar(255) NOT NULL,
	`tipoOcupacao` enum('uso_proprio','cessao','locacao','comodato') NOT NULL,
	`dataInicio` date NOT NULL,
	`dataFim` date,
	`areaOcupada` decimal(15,2),
	`valorMensal` decimal(15,2),
	`observacoes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ocupacoes_imoveis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orgaos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`sigla` varchar(20),
	`cnpj` varchar(18),
	`esfera` enum('federal','estadual','municipal','distrital') NOT NULL,
	`uf` char(2),
	`municipio` varchar(100),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orgaos_id` PRIMARY KEY(`id`),
	CONSTRAINT `orgaos_codigo_idx` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `pendencias_imoveis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`imovelId` int NOT NULL,
	`tipo` enum('regularizacao_dominial','averbacao','demarcacao','outros') NOT NULL,
	`descricao` text NOT NULL,
	`prazo` date,
	`situacao` enum('aberta','em_andamento','resolvida') NOT NULL DEFAULT 'aberta',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `pendencias_imoveis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `periodos_contabeis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ugId` int NOT NULL,
	`ano` int NOT NULL,
	`mes` int NOT NULL,
	`situacao` enum('aberto','fechado','reaberto') NOT NULL DEFAULT 'aberto',
	`dataAbertura` timestamp NOT NULL DEFAULT (now()),
	`dataFechamento` timestamp,
	`fechadoPorId` int,
	CONSTRAINT `periodos_contabeis_id` PRIMARY KEY(`id`),
	CONSTRAINT `periodos_ug_ano_mes_idx` UNIQUE(`ugId`,`ano`,`mes`)
);
--> statement-breakpoint
CREATE TABLE `plano_contas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`codigo` varchar(30) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`tipo` enum('ativo','passivo','patrimonio','receita','despesa','variacao') NOT NULL,
	`natureza` enum('devedora','credora') NOT NULL,
	`nivel` int NOT NULL,
	`contaPaiId` int,
	`aceitaLancamento` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `plano_contas_id` PRIMARY KEY(`id`),
	CONSTRAINT `plano_contas_codigo_idx` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `requisicoes_almox` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numero` varchar(30) NOT NULL,
	`ugId` int NOT NULL,
	`solicitanteId` int NOT NULL,
	`situacao` enum('rascunho','enviada','aprovada','atendida','cancelada') NOT NULL DEFAULT 'rascunho',
	`justificativa` text,
	`dataRequisicao` date NOT NULL,
	`dataAtendimento` date,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `requisicoes_almox_id` PRIMARY KEY(`id`),
	CONSTRAINT `req_almox_numero_idx` UNIQUE(`numero`)
);
--> statement-breakpoint
CREATE TABLE `requisicoes_itens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requisicaoId` int NOT NULL,
	`itemId` int NOT NULL,
	`quantidadeSolicitada` decimal(12,3) NOT NULL,
	`quantidadeAtendida` decimal(12,3),
	CONSTRAINT `requisicoes_itens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `termos_itens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`termoId` int NOT NULL,
	`bemId` int NOT NULL,
	CONSTRAINT `termos_itens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `termos_responsabilidade` (
	`id` int AUTO_INCREMENT NOT NULL,
	`numero` varchar(30) NOT NULL,
	`ugId` int NOT NULL,
	`responsavelId` int NOT NULL,
	`dataEmissao` date NOT NULL,
	`dataVencimento` date,
	`situacao` enum('ativo','encerrado','substituido') NOT NULL DEFAULT 'ativo',
	`observacoes` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `termos_responsabilidade_id` PRIMARY KEY(`id`),
	CONSTRAINT `termos_numero_idx` UNIQUE(`numero`)
);
--> statement-breakpoint
CREATE TABLE `unidades_administrativas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ugId` int NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`sigla` varchar(20),
	`uaPaiId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `unidades_administrativas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `unidades_gestoras` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgaoId` int NOT NULL,
	`codigo` varchar(20) NOT NULL,
	`nome` varchar(255) NOT NULL,
	`sigla` varchar(20),
	`cnpj` varchar(18),
	`tipo` enum('ug_executora','ug_gestora','ug_setorial') NOT NULL DEFAULT 'ug_executora',
	`ugPaiId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `unidades_gestoras_id` PRIMARY KEY(`id`),
	CONSTRAINT `ug_codigo_idx` UNIQUE(`codigo`)
);
--> statement-breakpoint
CREATE TABLE `user_ug_vinculos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`govpatriUserId` int NOT NULL,
	`ugId` int NOT NULL,
	`perfil` enum('admin','gestor','operador','auditor') NOT NULL DEFAULT 'operador',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_ug_vinculos_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_ug_idx` UNIQUE(`govpatriUserId`,`ugId`)
);
--> statement-breakpoint
CREATE TABLE `workflow_decisoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instanciaId` int NOT NULL,
	`etapa` int NOT NULL,
	`decisao` enum('aprovado','rejeitado') NOT NULL,
	`aprovadorId` int NOT NULL,
	`justificativa` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_decisoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_instancias` (
	`id` int AUTO_INCREMENT NOT NULL,
	`modeloId` int NOT NULL,
	`ugId` int NOT NULL,
	`entidade` varchar(100) NOT NULL,
	`entidadeId` int NOT NULL,
	`etapaAtual` int NOT NULL DEFAULT 0,
	`situacao` enum('em_andamento','aprovado','rejeitado','cancelado') NOT NULL DEFAULT 'em_andamento',
	`solicitanteId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workflow_instancias_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workflow_modelos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`nome` varchar(255) NOT NULL,
	`tipo` enum('incorporacao','baixa','cessao','desfazimento','transferencia') NOT NULL,
	`etapas` json NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workflow_modelos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `audit_logs_entidade_idx` ON `audit_logs` (`entidade`,`entidadeId`);