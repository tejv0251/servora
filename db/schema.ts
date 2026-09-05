import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex('idx_users_email').on(table.email)],
);

export const workspaces = sqliteTable(
  'workspaces',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex('idx_workspaces_slug').on(table.slug)],
);

export const memberships = sqliteTable(
  'memberships',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role', {
      enum: ['owner', 'dispatcher', 'technician'],
    }).notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex('idx_memberships_workspace_user').on(
      table.workspaceId,
      table.userId,
    ),
    index('idx_memberships_user').on(table.userId),
  ],
);

export const invitations = sqliteTable(
  'invitations',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    role: text('role', { enum: ['dispatcher', 'technician'] }).notNull(),
    status: text('status', {
      enum: ['pending', 'accepted', 'revoked', 'expired'],
    })
      .notNull()
      .default('pending'),
    invitedBy: text('invited_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    expiresAt: text('expires_at').notNull(),
    acceptedAt: text('accepted_at'),
    revokedAt: text('revoked_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_invitations_workspace_status').on(
      table.workspaceId,
      table.status,
    ),
    index('idx_invitations_email_status').on(table.email, table.status),
    uniqueIndex('idx_invitations_pending_email')
      .on(table.workspaceId, table.email)
      .where(sql`${table.status} = 'pending'`),
  ],
);

export const customers = sqliteTable(
  'customers',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    contactName: text('contact_name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    city: text('city').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_customers_workspace_name').on(table.workspaceId, table.name),
    uniqueIndex('idx_customers_workspace_email').on(
      table.workspaceId,
      table.email,
    ),
  ],
);

export const quotes = sqliteTable(
  'quotes',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    title: text('title').notNull(),
    amountCents: integer('amount_cents').notNull(),
    status: text('status', {
      enum: ['draft', 'sent', 'accepted', 'declined', 'expired'],
    }).notNull(),
    expiresAt: text('expires_at').notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_quotes_workspace_status').on(table.workspaceId, table.status),
    index('idx_quotes_customer').on(table.customerId),
  ],
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    quoteId: text('quote_id').references(() => quotes.id, {
      onDelete: 'set null',
    }),
    service: text('service').notNull(),
    city: text('city').notNull(),
    technician: text('technician').notNull(),
    scheduledAt: text('scheduled_at').notNull(),
    priority: text('priority', { enum: ['Low', 'Medium', 'High'] }).notNull(),
    status: text('status', {
      enum: ['Scheduled', 'En route', 'In progress', 'Completed', 'Cancelled'],
    }).notNull(),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_jobs_workspace_status').on(table.workspaceId, table.status),
    index('idx_jobs_workspace_scheduled').on(
      table.workspaceId,
      table.scheduledAt,
    ),
    index('idx_jobs_customer').on(table.customerId),
    uniqueIndex('idx_jobs_quote').on(table.quoteId),
  ],
);

export const invoices = sqliteTable(
  'invoices',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    customerId: text('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'restrict' }),
    jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
    amountCents: integer('amount_cents').notNull(),
    status: text('status', {
      enum: ['draft', 'open', 'paid', 'overdue', 'void'],
    }).notNull(),
    issuedAt: text('issued_at').notNull(),
    dueAt: text('due_at').notNull(),
    paidAt: text('paid_at'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_invoices_workspace_status').on(table.workspaceId, table.status),
    index('idx_invoices_customer').on(table.customerId),
    uniqueIndex('idx_invoices_job').on(table.jobId),
  ],
);

export const payments = sqliteTable(
  'payments',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    invoiceId: text('invoice_id')
      .notNull()
      .references(() => invoices.id, { onDelete: 'restrict' }),
    provider: text('provider', { enum: ['manual', 'stripe_test'] }).notNull(),
    providerPaymentId: text('provider_payment_id'),
    amountCents: integer('amount_cents').notNull(),
    status: text('status', {
      enum: ['succeeded', 'failed', 'refunded'],
    }).notNull(),
    method: text('method', {
      enum: ['cash', 'check', 'bank_transfer', 'card', 'other'],
    }).notNull(),
    reference: text('reference'),
    idempotencyKey: text('idempotency_key').notNull(),
    recordedBy: text('recorded_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    receivedAt: text('received_at').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_payments_workspace_received').on(
      table.workspaceId,
      table.receivedAt,
    ),
    index('idx_payments_invoice').on(table.invoiceId),
    uniqueIndex('idx_payments_workspace_idempotency').on(
      table.workspaceId,
      table.idempotencyKey,
    ),
    uniqueIndex('idx_payments_succeeded_invoice')
      .on(table.invoiceId)
      .where(sql`${table.status} = 'succeeded'`),
    uniqueIndex('idx_payments_provider_payment')
      .on(table.provider, table.providerPaymentId)
      .where(sql`${table.providerPaymentId} IS NOT NULL`),
  ],
);

export const paymentEvents = sqliteTable(
  'payment_events',
  {
    id: text('id').primaryKey(),
    provider: text('provider', { enum: ['stripe_test'] }).notNull(),
    eventType: text('event_type').notNull(),
    objectId: text('object_id').notNull(),
    processedAt: text('processed_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index('idx_payment_events_object').on(table.objectId)],
);

export const jobAttachments = sqliteTable(
  'job_attachments',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    jobId: text('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    fileName: text('file_name').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    uploadedBy: text('uploaded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_job_attachments_workspace_job').on(
      table.workspaceId,
      table.jobId,
    ),
    uniqueIndex('idx_job_attachments_object_key').on(table.objectKey),
  ],
);

export const activities = sqliteTable(
  'activities',
  {
    id: text('id').primaryKey(),
    workspaceId: text('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    actorId: text('actor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    action: text('action').notNull(),
    message: text('message').notNull(),
    createdAt: text('created_at')
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index('idx_activities_workspace_created').on(
      table.workspaceId,
      table.createdAt,
    ),
  ],
);
