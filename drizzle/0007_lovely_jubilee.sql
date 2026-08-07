CREATE TABLE `almox_alocacoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loteId` int NOT NULL,
	`enderecoId` int NOT NULL,
	`quantidade` decimal(12,3) NOT NULL,
	`motivo` varchar(255),
	`alocadoPorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `almox_alocacoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `almox_backorder` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requisicaoItemId` int NOT NULL,
	`quantidadePendente` decimal(12,3) NOT NULL,
	`situacao` enum('pendente','atendido','cancelado') NOT NULL DEFAULT 'pendente',
	`motivoCancelamento` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `almox_backorder_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `almox_baixas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loteId` int NOT NULL,
	`depositoId` int NOT NULL,
	`quantidade` decimal(12,3) NOT NULL,
	`motivo` enum('vencimento','avaria','obsolescencia','perda') NOT NULL,
	`evidenciaDocRef` varchar(255),
	`workflowInstanciaId` int,
	`eventoContabilId` int,
	`autorizadoPorId` int,
	`situacao` enum('pendente','autorizada','executada','rejeitada') NOT NULL DEFAULT 'pendente',
	`registradoPorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `almox_baixas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `almox_devolucoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requisicaoItemId` int NOT NULL,
	`loteOrigemId` int NOT NULL,
	`enderecoDestinoId` int,
	`quantidade` decimal(12,3) NOT NULL,
	`condicao` enum('integro','avariado','vencido') NOT NULL,
	`motivo` text NOT NULL,
	`registradoPorId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `almox_devolucoes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `almox_enderecos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depositoId` int NOT NULL,
	`rua` varchar(20) NOT NULL,
	`estante` varchar(20) NOT NULL,
	`prateleira` varchar(20) NOT NULL,
	`posicao` varchar(20) NOT NULL,
	`descricao` varchar(100),
	`capacidade` decimal(12,3),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `almox_enderecos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `almox_lotes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`depositoId` int NOT NULL,
	`itemId` int NOT NULL,
	`numeroLote` varchar(60) NOT NULL,
	`dataValidade` date,
	`dataEntrada` date NOT NULL,
	`quantidadeInicial` decimal(12,3) NOT NULL,
	`quantidadeDisponivel` decimal(12,3) NOT NULL,
	`quantidadeQuarentena` decimal(12,3) NOT NULL DEFAULT '0',
	`valorUnitario` decimal(15,4),
	`movimentacaoOrigemId` int,
	`situacao` enum('disponivel','quarentena','esgotado','vencido') NOT NULL DEFAULT 'disponivel',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `almox_lotes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `almox_substituicoes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requisicaoItemId` int NOT NULL,
	`itemOriginalId` int NOT NULL,
	`itemSubstitutoId` int NOT NULL,
	`autorizadorId` int NOT NULL,
	`justificativa` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `almox_substituicoes_id` PRIMARY KEY(`id`)
);
