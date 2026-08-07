CREATE TABLE `alertas_auditoria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ugId` int NOT NULL,
	`tipo` enum('termo_pendente','divergencia_recorrente','pendencia_dominial','cessao_vencida','reavaliacao_vencida','inconsistencia_contabil','estoque_minimo','validade_proxima','manutencao_vencida') NOT NULL,
	`entidade` varchar(100) NOT NULL,
	`entidadeId` int NOT NULL,
	`criticidade` enum('alta','media','baixa') NOT NULL,
	`status` enum('aberto','em_tratamento','resolvido') NOT NULL DEFAULT 'aberto',
	`descricao` text NOT NULL,
	`resolvidoPorNormalizacao` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertas_auditoria_id` PRIMARY KEY(`id`),
	CONSTRAINT `alertas_tipo_entidade_idx` UNIQUE(`tipo`,`entidade`,`entidadeId`,`ugId`)
);
--> statement-breakpoint
CREATE TABLE `configuracoes_sistema` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chave` varchar(100) NOT NULL,
	`valor` varchar(500) NOT NULL,
	`descricao` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `configuracoes_sistema_id` PRIMARY KEY(`id`),
	CONSTRAINT `config_chave_idx` UNIQUE(`chave`)
);
--> statement-breakpoint
CREATE TABLE `indice_saude_patrimonial` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ugId` int NOT NULL,
	`competencia` varchar(7) NOT NULL,
	`completudeCadastral` decimal(5,2),
	`aderenciaDocumental` decimal(5,2),
	`tempestividadeInventario` decimal(5,2),
	`tratamentoDivergencias` decimal(5,2),
	`regularidadeDominial` decimal(5,2),
	`regularidadeAvaliacoes` decimal(5,2),
	`indiceGeral` decimal(5,2) NOT NULL,
	`totalBensAtivos` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `indice_saude_patrimonial_id` PRIMARY KEY(`id`),
	CONSTRAINT `isp_ug_competencia_idx` UNIQUE(`ugId`,`competencia`)
);
