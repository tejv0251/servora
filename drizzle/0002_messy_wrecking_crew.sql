CREATE TABLE `job_attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`job_id` text NOT NULL,
	`object_key` text NOT NULL,
	`file_name` text NOT NULL,
	`content_type` text NOT NULL,
	`size_bytes` integer NOT NULL,
	`uploaded_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`job_id`) REFERENCES `jobs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_job_attachments_workspace_job` ON `job_attachments` (`workspace_id`,`job_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_job_attachments_object_key` ON `job_attachments` (`object_key`);--> statement-breakpoint
CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`event_type` text NOT NULL,
	`object_id` text NOT NULL,
	`processed_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_payment_events_object` ON `payment_events` (`object_id`);--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`invoice_id` text NOT NULL,
	`provider` text NOT NULL,
	`provider_payment_id` text,
	`amount_cents` integer NOT NULL,
	`status` text NOT NULL,
	`method` text NOT NULL,
	`reference` text,
	`idempotency_key` text NOT NULL,
	`recorded_by` text,
	`received_at` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_payments_workspace_received` ON `payments` (`workspace_id`,`received_at`);--> statement-breakpoint
CREATE INDEX `idx_payments_invoice` ON `payments` (`invoice_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_workspace_idempotency` ON `payments` (`workspace_id`,`idempotency_key`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_succeeded_invoice` ON `payments` (`invoice_id`) WHERE "payments"."status" = 'succeeded';--> statement-breakpoint
CREATE UNIQUE INDEX `idx_payments_provider_payment` ON `payments` (`provider`,`provider_payment_id`) WHERE "payments"."provider_payment_id" IS NOT NULL;