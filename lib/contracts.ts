export type JobStatus = 'Scheduled' | 'En route' | 'In progress' | 'Completed' | 'Cancelled';
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

export type DashboardActivity = { id: string; message: string; createdAt: string };

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
};

