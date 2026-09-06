export type JobStatus =
  | 'Scheduled'
  | 'En route'
  | 'In progress'
  | 'Completed'
  | 'Cancelled';
export type Priority = 'Low' | 'Medium' | 'High';

export type DashboardJob = {
  id: string;
  customerId: string;
  customer: string;
  service: string;
  city: string;
  technician: string;
  scheduledAt: string;
  priority: Priority;
  status: JobStatus;
  invoiceId: string | null;
  attachmentCount: number;
  assignedUserId: string | null;
  assignedTechnician: string | null;
};

export type TechnicianOption = {
  userId: string;
  displayName: string;
  email: string;
};

export type DashboardCustomer = {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  city: string;
  jobCount: number;
  lifetimeValueCents: number;
};

export type DashboardInvoice = {
  id: string;
  customer: string;
  jobId: string | null;
  amountCents: number;
  status: 'draft' | 'open' | 'paid' | 'overdue' | 'void';
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  paymentMethod: PaymentMethod | null;
  paymentReference: string | null;
};

export type PaymentMethod =
  | 'cash'
  | 'check'
  | 'bank_transfer'
  | 'card'
  | 'other';

export type PaymentRecord = {
  id: string;
  invoiceId: string;
  provider: 'manual' | 'stripe_test';
  amountCents: number;
  status: 'succeeded' | 'failed' | 'refunded';
  method: PaymentMethod;
  reference: string | null;
  receivedAt: string;
  createdAt: string;
};

export type JobAttachment = {
  id: string;
  jobId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
  downloadUrl: string;
};

export type DashboardQuote = {
  id: string;
  customerId: string;
  customer: string;
  title: string;
  amountCents: number;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
  expiresAt: string;
};

export type DashboardActivity = {
  id: string;
  message: string;
  createdAt: string;
};

export type DashboardData = {
  session: {
    user: { id: string; email: string; displayName: string };
    workspace: { id: string; name: string; slug: string };
    role: 'owner' | 'dispatcher' | 'technician';
  };
  metrics: {
    revenueCents: number;
    outstandingCents: number;
    overdueCount: number;
    jobsToday: number;
    jobsInProgress: number;
    quoteConversionPercent: number;
  };
  jobs: DashboardJob[];
  customers: DashboardCustomer[];
  invoices: DashboardInvoice[];
  quotes: DashboardQuote[];
  activities: DashboardActivity[];
  technicianOptions: TechnicianOption[];
  capabilities: {
    attachments: boolean;
    stripeTestMode: boolean;
  };
};

export type SessionData = DashboardData['session'];

export type TechnicianNote = {
  id: string;
  jobId: string;
  author: string;
  body: string;
  createdAt: string;
};

export type TechnicianJob = {
  id: string;
  customer: string;
  contactName: string;
  phone: string;
  service: string;
  city: string;
  scheduledAt: string;
  priority: Priority;
  status: JobStatus;
  attachmentCount: number;
  notes: TechnicianNote[];
};

export type TechnicianDashboardData = {
  session: SessionData;
  jobs: TechnicianJob[];
};

export type TeamRole = 'owner' | 'dispatcher' | 'technician';

export type TeamMember = {
  id: string;
  userId: string;
  displayName: string;
  email: string;
  role: TeamRole;
  joinedAt: string;
};

export type TeamInvitation = {
  id: string;
  email: string;
  role: Exclude<TeamRole, 'owner'>;
  status: 'pending';
  expiresAt: string;
  createdAt: string;
};

export type TeamData = {
  role: TeamRole;
  canManage: boolean;
  memberCount: number;
  members: TeamMember[];
  invitations: TeamInvitation[];
};
