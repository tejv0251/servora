export type WorkspaceCustomer = { id: string; name: string };

export async function findWorkspaceCustomer(
  db: D1Database,
  workspaceId: string,
  customerId: string,
) {
  return db
    .prepare(
      'SELECT id, name FROM customers WHERE id = ? AND workspace_id = ? LIMIT 1',
    )
    .bind(customerId, workspaceId)
    .first<WorkspaceCustomer>();
}

export async function listWorkspaceCustomerIds(
  db: D1Database,
  workspaceId: string,
) {
  const rows = await db
    .prepare('SELECT id FROM customers WHERE workspace_id = ? ORDER BY id')
    .bind(workspaceId)
    .all<{ id: string }>();
  return rows.results.map((row) => row.id);
}
