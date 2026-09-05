import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  displayName: text('display_name').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('idx_users_email').on(table.email)]);

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex('idx_workspaces_slug').on(table.slug)]);

export const memberships = sqliteTable('memberships', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['owner', 'dispatcher', 'technician'] }).notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex('idx_memberships_workspace_user').on(table.workspaceId, table.userId),
  index('idx_memberships_user').on(table.userId),
]);

export const customers = sqliteTable('customers', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  contactName: text('contact_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone').notNull(),
  city: text('city').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_customers_workspace_name').on(table.workspaceId, table.name),
  uniqueIndex('idx_customers_workspace_email').on(table.workspaceId, table.email),
]);

export const quotes = sqliteTable('quotes', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  title: text('title').notNull(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status', { enum: ['draft', 'sent', 'accepted', 'declined', 'expired'] }).notNull(),
  expiresAt: text('expires_at').notNull(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_quotes_workspace_status').on(table.workspaceId, table.status),
  index('idx_quotes_customer').on(table.customerId),
]);

export const jobs = sqliteTable('jobs', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  quoteId: text('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  service: text('service').notNull(),
  city: text('city').notNull(),
  technician: text('technician').notNull(),
  scheduledAt: text('scheduled_at').notNull(),
  priority: text('priority', { enum: ['Low', 'Medium', 'High'] }).notNull(),
  status: text('status', { enum: ['Scheduled', 'En route', 'In progress', 'Completed', 'Cancelled'] }).notNull(),
  createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_jobs_workspace_status').on(table.workspaceId, table.status),
  index('idx_jobs_workspace_scheduled').on(table.workspaceId, table.scheduledAt),
  index('idx_jobs_customer').on(table.customerId),
  uniqueIndex('idx_jobs_quote').on(table.quoteId),
]);

export const invoices = sqliteTable('invoices', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  customerId: text('customer_id').notNull().references(() => customers.id, { onDelete: 'restrict' }),
  jobId: text('job_id').references(() => jobs.id, { onDelete: 'set null' }),
  amountCents: integer('amount_cents').notNull(),
  status: text('status', { enum: ['draft', 'open', 'paid', 'overdue', 'void'] }).notNull(),
  issuedAt: text('issued_at').notNull(),
  dueAt: text('due_at').notNull(),
  paidAt: text('paid_at'),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text('updated_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  index('idx_invoices_workspace_status').on(table.workspaceId, table.status),
  index('idx_invoices_customer').on(table.customerId),
  uniqueIndex('idx_invoices_job').on(table.jobId),
]);

export const activities = sqliteTable('activities', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  actorId: text('actor_id').notNull().references(() => users.id, { onDelete: 'restrict' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  action: text('action').notNull(),
  message: text('message').notNull(),
  createdAt: text('created_at').notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [index('idx_activities_workspace_created').on(table.workspaceId, table.createdAt)]);
