const DAY = 86_400_000;

function isoDay(offset: number) {
  return new Date(Date.now() + offset * DAY).toISOString();
}

export async function ensureDemoData(
  db: D1Database,
  workspaceId: string,
  userId: string,
) {
  const existing = await db
    .prepare('SELECT COUNT(*) AS count FROM customers WHERE workspace_id = ?')
    .bind(workspaceId)
    .first<{ count: number }>();
  if ((existing?.count ?? 0) > 0) return;

  const customerRows = [
    [
      'northline',
      'Northline Dental',
      'Maya Brooks',
      'maya@northlinedental.example',
      '+1 312 555 0142',
      'Evanston',
    ],
    [
      'ridgeway',
      'Ridgeway Offices',
      'Owen Parker',
      'owen@ridgeway.example',
      '+1 312 555 0191',
      'Chicago',
    ],
    [
      'greenleaf',
      'Greenleaf Properties',
      'Ava Thompson',
      'ava@greenleaf.example',
      '+1 708 555 0127',
      'Oak Park',
    ],
    [
      'david',
      'David Ruiz',
      'David Ruiz',
      'david.ruiz@example.com',
      '+1 773 555 0175',
      'Lincoln Park',
    ],
    [
      'summit',
      'Summit Homes',
      'Noah Mitchell',
      'noah@summithomes.example',
      '+1 847 555 0130',
      'Skokie',
    ],
  ];
  const customerIds: Record<string, string> = Object.fromEntries(
    customerRows.map(([key]) => [key, `${workspaceId}_cus_${key}`]),
  );

  const statements: D1PreparedStatement[] = customerRows.map(
    ([key, name, contact, email, phone, city]) =>
      db
        .prepare(
          'INSERT OR IGNORE INTO customers (id, workspace_id, name, contact_name, email, phone, city) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(customerIds[key], workspaceId, name, contact, email, phone, city),
  );

  const jobRows = [
    [
      '2048',
      'northline',
      'Furnace tune-up',
      'Evanston',
      'James Diaz',
      -1,
      'Medium',
      'Scheduled',
    ],
    [
      '2050',
      'northline',
      'AC repair',
      'Evanston',
      'Amanda Lee',
      0,
      'High',
      'Scheduled',
    ],
    [
      '2043',
      'david',
      'Leak inspection',
      'Lincoln Park',
      'Mike Wallace',
      0,
      'Medium',
      'En route',
    ],
    [
      '2045',
      'summit',
      'Water heater install',
      'Skokie',
      'Priya Rao',
      0,
      'High',
      'En route',
    ],
    [
      '2041',
      'ridgeway',
      'Panel upgrade',
      'Chicago',
      'Amanda Lee',
      0,
      'High',
      'In progress',
    ],
    [
      '2044',
      'greenleaf',
      'Drain cleaning',
      'Oak Park',
      'Sam Cooper',
      0,
      'Medium',
      'In progress',
    ],
    [
      '2036',
      'greenleaf',
      'Outlet installation',
      'Oak Park',
      'James Diaz',
      -2,
      'Low',
      'Completed',
    ],
    [
      '2037',
      'ridgeway',
      'AC maintenance',
      'Chicago',
      'Mike Wallace',
      -1,
      'Low',
      'Completed',
    ],
  ];

  for (const [
    number,
    customerKey,
    service,
    city,
    technician,
    dayOffset,
    priority,
    status,
  ] of jobRows) {
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO jobs (id, workspace_id, customer_id, service, city, technician, scheduled_at, priority, status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          `${workspaceId}_job_${number}`,
          workspaceId,
          customerIds[customerKey as string],
          service,
          city,
          technician,
          isoDay(Number(dayOffset)),
          priority,
          status,
          userId,
        ),
    );
  }

  const quoteRows = [
    ['1543', 'david', 'Boiler replacement', 185000, 'sent', 5],
    ['1541', 'northline', 'Annual HVAC service', 382000, 'accepted', 12],
    ['1538', 'greenleaf', 'Drain maintenance plan', 564000, 'accepted', 18],
    ['1534', 'ridgeway', 'Electrical panel upgrade', 293000, 'declined', -2],
  ];
  for (const [
    number,
    customerKey,
    title,
    amount,
    status,
    expires,
  ] of quoteRows) {
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO quotes (id, workspace_id, customer_id, title, amount_cents, status, expires_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          `${workspaceId}_quo_${number}`,
          workspaceId,
          customerIds[customerKey as string],
          title,
          amount,
          status,
          isoDay(Number(expires)),
          userId,
        ),
    );
  }

  const invoiceRows = [
    ['10432', 'greenleaf', '2036', 245000, 'paid', -2, 12, -1],
    ['10431', 'ridgeway', '2037', 382000, 'open', -1, 13, null],
    ['10427', 'greenleaf', null, 564000, 'overdue', -24, -10, null],
    ['10424', 'ridgeway', null, 293000, 'overdue', -28, -14, null],
  ];
  for (const [
    number,
    customerKey,
    jobNumber,
    amount,
    status,
    issuedOffset,
    dueOffset,
    paidOffset,
  ] of invoiceRows) {
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO invoices (id, workspace_id, customer_id, job_id, amount_cents, status, issued_at, due_at, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          `${workspaceId}_inv_${number}`,
          workspaceId,
          customerIds[customerKey as string],
          jobNumber ? `${workspaceId}_job_${jobNumber}` : null,
          amount,
          status,
          isoDay(Number(issuedOffset)),
          isoDay(Number(dueOffset)),
          paidOffset === null ? null : isoDay(Number(paidOffset)),
        ),
    );
  }

  const activityRows = [
    [
      'invoice',
      '10432',
      'invoice.paid',
      'Invoice #10432 paid by Greenleaf Properties',
    ],
    ['job', '2036', 'job.completed', 'Job #2036 completed by James Diaz'],
    ['quote', '1543', 'quote.created', 'Quote #Q1543 created for David Ruiz'],
  ];
  for (const [entityType, entityId, action, message] of activityRows) {
    statements.push(
      db
        .prepare(
          'INSERT OR IGNORE INTO activities (id, workspace_id, actor_id, entity_type, entity_id, action, message) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .bind(
          `${workspaceId}_act_${entityType}_${entityId}`,
          workspaceId,
          userId,
          entityType,
          entityId,
          action,
          message,
        ),
    );
  }

  await db.batch(statements);
}
