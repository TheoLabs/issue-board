-- CreateTable
CREATE TABLE `Project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `repoPath` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Project_repoPath_key`(`repoPath`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Application` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `key` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `issuePrefix` VARCHAR(191) NULL,
    `issueSeq` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Application_projectId_idx`(`projectId`),
    UNIQUE INDEX `Application_projectId_key_key`(`projectId`, `key`),
    UNIQUE INDEX `Application_projectId_issuePrefix_key`(`projectId`, `issuePrefix`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ActivityLog` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `entityType` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NOT NULL,
    `action` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `changes` TEXT NULL,
    `source` VARCHAR(191) NOT NULL DEFAULT 'agent',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ActivityLog_projectId_createdAt_idx`(`projectId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DailySummary` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `date` VARCHAR(191) NOT NULL,
    `timezone` VARCHAR(191) NOT NULL DEFAULT 'Asia/Seoul',
    `content` TEXT NOT NULL,
    `model` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'ready',
    `error` TEXT NULL,
    `activityCount` INTEGER NOT NULL DEFAULT 0,
    `createdBy` VARCHAR(191) NOT NULL DEFAULT 'manual',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `DailySummary_projectId_idx`(`projectId`),
    UNIQUE INDEX `DailySummary_projectId_date_key`(`projectId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Design` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `tokens` TEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Design_projectId_key`(`projectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Plan` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `version` INTEGER NOT NULL DEFAULT 1,
    `applicationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Plan_projectId_idx`(`projectId`),
    INDEX `Plan_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PlanVersion` (
    `id` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PlanVersion_planId_idx`(`planId`),
    UNIQUE INDEX `PlanVersion_planId_version_key`(`planId`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Issue` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'task',
    `status` VARCHAR(191) NOT NULL DEFAULT 'todo',
    `priority` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `value` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `effort` VARCHAR(191) NOT NULL DEFAULT 'medium',
    `labels` VARCHAR(1000) NOT NULL DEFAULT '[]',
    `parentId` VARCHAR(191) NULL,
    `planId` VARCHAR(191) NULL,
    `screenId` VARCHAR(191) NULL,
    `domainId` VARCHAR(191) NULL,
    `applicationId` VARCHAR(191) NULL,
    `number` INTEGER NULL,
    `key` VARCHAR(191) NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Issue_projectId_idx`(`projectId`),
    INDEX `Issue_parentId_idx`(`parentId`),
    INDEX `Issue_planId_idx`(`planId`),
    INDEX `Issue_domainId_idx`(`domainId`),
    INDEX `Issue_applicationId_idx`(`applicationId`),
    UNIQUE INDEX `Issue_applicationId_number_key`(`applicationId`, `number`),
    UNIQUE INDEX `Issue_projectId_key_key`(`projectId`, `key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Domain` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `columns` TEXT NOT NULL,
    `lifecycle` TEXT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'draft',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Domain_projectId_idx`(`projectId`),
    UNIQUE INDEX `Domain_projectId_name_key`(`projectId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Wireframe` (
    `id` VARCHAR(191) NOT NULL,
    `projectId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `format` VARCHAR(191) NOT NULL DEFAULT 'html',
    `content` LONGTEXT NOT NULL,
    `sequence` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `applicationId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Wireframe_projectId_idx`(`projectId`),
    INDEX `Wireframe_projectId_name_idx`(`projectId`, `name`),
    INDEX `Wireframe_applicationId_idx`(`applicationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Application` ADD CONSTRAINT `Application_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ActivityLog` ADD CONSTRAINT `ActivityLog_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DailySummary` ADD CONSTRAINT `DailySummary_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Design` ADD CONSTRAINT `Design_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Plan` ADD CONSTRAINT `Plan_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Plan` ADD CONSTRAINT `Plan_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `PlanVersion` ADD CONSTRAINT `PlanVersion_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `Issue`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `Plan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_domainId_fkey` FOREIGN KEY (`domainId`) REFERENCES `Domain`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Domain` ADD CONSTRAINT `Domain_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Wireframe` ADD CONSTRAINT `Wireframe_projectId_fkey` FOREIGN KEY (`projectId`) REFERENCES `Project`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Wireframe` ADD CONSTRAINT `Wireframe_applicationId_fkey` FOREIGN KEY (`applicationId`) REFERENCES `Application`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

