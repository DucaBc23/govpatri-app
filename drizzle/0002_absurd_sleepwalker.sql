CREATE TABLE `inventario_coletas` (
	`id` int AUTO_INCREMENT NOT NULL,
	`inventarioId` int NOT NULL,
	`bemId` int NOT NULL,
	`situacaoEncontrada` enum('encontrado','nao_encontrado','divergencia_localizacao','divergencia_estado') NOT NULL,
	`localizacaoEncontrada` varchar(255),
	`observacao` text,
	`coletadoPorId` int NOT NULL,
	`metodoColeta` enum('qrcode','manual') NOT NULL DEFAULT 'manual',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `inventario_coletas_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventario_coleta_bem_idx` UNIQUE(`inventarioId`,`bemId`)
);
--> statement-breakpoint
CREATE TABLE `inventarios` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ugId` int NOT NULL,
	`nome` varchar(255) NOT NULL,
	`dataInicio` date NOT NULL,
	`dataFim` date,
	`situacao` enum('aberto','em_coleta','concluido','cancelado') NOT NULL DEFAULT 'aberto',
	`responsavelId` int NOT NULL,
	`totalBens` int NOT NULL DEFAULT 0,
	`totalColetados` int NOT NULL DEFAULT 0,
	`totalDivergencias` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventarios_id` PRIMARY KEY(`id`)
);
