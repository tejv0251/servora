'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type SyntheticEvent,
} from 'react';
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  FileText,
  HelpCircle,
  Home,
  Mail,
  Menu,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  UserRoundCog,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import {
  InvoicePaymentDialog,
  type PaymentDraft,
} from '@/components/invoice-payment-dialog';
import { JobAttachmentsDialog } from '@/components/job-attachments-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type {
  DashboardCustomer,
  DashboardData,
  DashboardInvoice,
  DashboardJob,
  DashboardQuote,
  JobStatus,
  Priority,
  TeamData,
  TeamInvitation,
  TeamMember,
  TeamRole,
} from '@/lib/contracts';
import { getNextJobStatus } from '@/lib/job-state';
import { revenueData, technicians } from '@/lib/demo-data';

const navItems = [
  { label: 'Overview', icon: Home },
  { label: 'Jobs', icon: BriefcaseBusiness },
  { label: 'Schedule', icon: CalendarDays },
  { label: 'Customers', icon: Users },
  { label: 'Quotes', icon: FileCheck2 },
  { label: 'Invoices', icon: FileText },
  { label: 'Technicians', icon: Wrench },
  { label: 'Reports', icon: BarChart3 },
  { label: 'Settings', icon: Settings },
] as const;
type ViewName = (typeof navItems)[number]['label'];

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
const shortDate = (value: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(
    new Date(value),
  );
const shortTime = (value: string) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
const compactId = (prefix: string, id: string) =>
  `${prefix}-${id.split('_').at(-1)?.slice(0, 8).toUpperCase() ?? id.slice(0, 8).toUpperCase()}`;
const renderEpoch = Date.now();
const defaultTomorrow = new Date(renderEpoch + 86_400_000)
  .toISOString()
  .slice(0, 10);
const defaultQuoteExpiry = new Date(renderEpoch + 14 * 86_400_000)
  .toISOString()
  .slice(0, 10);
const formString = (form: FormData, name: string) => {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
};

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  headers.set('content-type', 'application/json');
  const response = await fetch(path, { ...options, headers });
  const data = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!response.ok)
    throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

function Brand() {
  return (
    <div className="brand" aria-label="Servora home">
      <span className="brand-mark" aria-hidden="true">
        S
      </span>
      <span>servora</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone = ['available', 'paid', 'completed', 'accepted'].includes(
    normalized,
  )
    ? 'positive'
    : ['overdue', 'declined'].includes(normalized)
      ? 'danger'
      : ['off today', 'cancelled'].includes(normalized)
        ? 'muted'
        : ['on break', 'open', 'sent'].includes(normalized)
          ? 'warning'
          : 'info';
  return (
    <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />
  );
}

function Sidebar({
  active,
  onChange,
  mobileOpen,
  onClose,
}: {
  active: ViewName;
  onChange: (view: ViewName) => void;
  mobileOpen: boolean;
  onClose: () => void;
}) {
  return (
    <aside
      className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`}
      aria-label="Primary navigation"
    >
      <div className="sidebar-head">
        <Brand />
        <button
          className="icon-button sidebar-close"
          type="button"
          onClick={onClose}
          aria-label="Close navigation"
        >
          <X />
        </button>
      </div>
      <nav className="nav-list">
        {navItems.map(({ label, icon: Icon }) => (
          <button
            type="button"
            key={label}
            className={`nav-item ${active === label ? 'nav-item--active' : ''}`}
            aria-current={active === label ? 'page' : undefined}
            onClick={() => {
              onChange(label);
              onClose();
            }}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <section className="plan-card" aria-label="Plan usage">
        <div>
          <strong>Pro Plan</strong>
          <span>28 / 50 users</span>
        </div>
        <div className="plan-track">
          <span />
        </div>
        <span className="plan-note">Portfolio workspace</span>
      </section>
      <div className="support-button">
        <HelpCircle /> Guided demo workspace
      </div>
    </aside>
  );
}

type JobDraft = {
  customerId: string;
  service: string;
  city: string;
  technician: string;
  scheduledAt: string;
  priority: Priority;
};

function NewJobDialog({
  customers,
  onCreate,
}: {
  customers: DashboardCustomer[];
  onCreate: (draft: JobDraft) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => {
      const entry = form.get(name);
      return typeof entry === 'string' ? entry.trim() : '';
    };
    setSaving(true);
    try {
      await onCreate({
        customerId: value('customerId'),
        service: value('service'),
        city: value('city'),
        technician: value('technician'),
        scheduledAt: new Date(
          `${value('date')}T${value('time')}`,
        ).toISOString(),
        priority: value('priority') as Priority,
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="primary-button" size="lg" />}>
        <Plus /> New job
      </DialogTrigger>
      <DialogContent className="new-job-dialog sm:max-w-[520px]">
        <form noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-lg">
              Create a scheduled job
            </DialogTitle>
            <DialogDescription>
              This record is saved to the workspace and will remain after
              reload.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              Customer
              <select name="customerId" required defaultValue="">
                <option value="" disabled>
                  Select customer
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service
              <input name="service" required placeholder="Boiler inspection" />
            </label>
            <label>
              City
              <input name="city" required placeholder="Evanston" />
            </label>
            <label>
              Technician
              <select name="technician" required defaultValue="">
                <option value="" disabled>
                  Select technician
                </option>
                {technicians.map((person) => (
                  <option key={person.name}>{person.name}</option>
                ))}
              </select>
            </label>
            <label>
              Date
              <input
                name="date"
                type="date"
                required
                defaultValue={defaultTomorrow}
              />
            </label>
            <label>
              Time
              <input name="time" type="time" required defaultValue="13:00" />
            </label>
            <label>
              Priority
              <select name="priority" defaultValue="Medium">
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
              </select>
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="primary-button"
              disabled={saving || !customers.length}
              aria-busy={saving}
            >
              {saving ? 'Saving…' : 'Create job'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewCustomerDialog({
  onCreate,
}: {
  onCreate: (draft: Record<string, string>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const value = (name: string) => {
      const entry = form.get(name);
      return typeof entry === 'string' ? entry.trim() : '';
    };
    setSaving(true);
    try {
      await onCreate({
        name: value('name'),
        contactName: value('contactName'),
        email: value('email'),
        phone: value('phone'),
        city: value('city'),
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <Plus /> New customer
      </DialogTrigger>
      <DialogContent className="new-job-dialog sm:max-w-[520px]">
        <form noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-lg">Add a customer</DialogTitle>
            <DialogDescription>
              Create the account that jobs, quotes, and invoices belong to.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              Business or customer
              <input name="name" required placeholder="Lakeshore Dental" />
            </label>
            <label>
              Primary contact
              <input name="contactName" required placeholder="Jordan Kim" />
            </label>
            <label>
              Email
              <input
                name="email"
                type="email"
                required
                placeholder="jordan@example.com"
              />
            </label>
            <label>
              Phone
              <input name="phone" required placeholder="+1 312 555 0188" />
            </label>
            <label>
              City
              <input name="city" required placeholder="Chicago" />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="primary-button"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Saving…' : 'Add customer'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewQuoteDialog({
  customers,
  onCreate,
}: {
  customers: DashboardCustomer[];
  onCreate: (draft: Record<string, unknown>) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await onCreate({
        customerId: formString(form, 'customerId'),
        title: formString(form, 'title'),
        amountCents: Math.round(Number(formString(form, 'amount')) * 100),
        expiresAt: new Date(formString(form, 'expiresAt')).toISOString(),
      });
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" size="lg" />}>
        <Plus /> New quote
      </DialogTrigger>
      <DialogContent className="new-job-dialog sm:max-w-[520px]">
        <form noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-lg">Send a quote</DialogTitle>
            <DialogDescription>
              A sent quote can be accepted and converted into a scheduled job.
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              Customer
              <select name="customerId" required defaultValue="">
                <option value="" disabled>
                  Select customer
                </option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Service
              <input name="title" required placeholder="Annual HVAC service" />
            </label>
            <label>
              Amount (USD)
              <input
                name="amount"
                type="number"
                min="1"
                step="0.01"
                required
                placeholder="1250"
              />
            </label>
            <label>
              Expires
              <input
                name="expiresAt"
                type="date"
                required
                defaultValue={defaultQuoteExpiry}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="primary-button"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Sending…' : 'Send quote'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceDialog({
  job,
  onCreate,
}: {
  job: DashboardJob;
  onCreate: (
    jobId: string,
    amountCents: number,
    dueAt: string,
  ) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    try {
      await onCreate(
        job.id,
        Math.round(Number(formString(form, 'amount')) * 100),
        new Date(formString(form, 'dueAt')).toISOString(),
      );
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        Invoice
      </DialogTrigger>
      <DialogContent className="new-job-dialog sm:max-w-[460px]">
        <form noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-lg">Invoice completed job</DialogTitle>
            <DialogDescription>
              {job.service} for {job.customer}
            </DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>
              Amount (USD)
              <input name="amount" type="number" min="1" step="0.01" required />
            </label>
            <label>
              Due date
              <input
                name="dueAt"
                type="date"
                required
                defaultValue={defaultQuoteExpiry}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="primary-button"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Issuing…' : 'Issue invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Header({
  onMenu,
  query,
  setQuery,
  workspace,
  user,
  role,
}: {
  onMenu: () => void;
  query: string;
  setQuery: (value: string) => void;
  workspace: string;
  user: string;
  role: string;
}) {
  const initials = user
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <header className="topbar">
      <button
        className="icon-button menu-button"
        type="button"
        onClick={onMenu}
        aria-label="Open navigation"
      >
        <Menu />
      </button>
      <div className="workspace-switcher">
        <BriefcaseBusiness />
        <span>
          <strong>{workspace}</strong>
          <small>Operations workspace</small>
        </span>
        <ChevronDown />
      </div>
      <search className="global-search">
        <Search aria-hidden="true" />
        <label className="sr-only" htmlFor="workspace-search">
          Search workspace
        </label>
        <input
          id="workspace-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search jobs, customers, invoices…"
        />
        {query ? (
          <button
            type="button"
            className="search-clear"
            onClick={() => setQuery('')}
            aria-label="Clear workspace search"
          >
            <X />
          </button>
        ) : (
          <kbd>⌘ K</kbd>
        )}
      </search>
      <div className="topbar-actions">
        <span
          className="icon-button notification-button"
          aria-label="No new notifications"
        >
          <Bell />
        </span>
        <div className="account-button">
          <span className="avatar avatar--dark">{initials}</span>
          <span>
            <strong>{user}</strong>
            <small>{role}</small>
          </span>
          <ChevronDown />
        </div>
      </div>
    </header>
  );
}

function MetricCards({ data }: { data: DashboardData['metrics'] }) {
  const metrics = [
    {
      label: 'Revenue (MTD)',
      value: money(data.revenueCents),
      detail: 'Collected this month',
      icon: CircleDollarSign,
      tone: 'positive',
    },
    {
      label: 'Outstanding invoices',
      value: money(data.outstandingCents),
      detail: `${data.overdueCount} overdue`,
      icon: FileText,
      tone: 'warning',
    },
    {
      label: 'Jobs today',
      value: String(data.jobsToday),
      detail: `${data.jobsInProgress} currently in progress`,
      icon: BriefcaseBusiness,
      tone: 'info',
    },
    {
      label: 'Quote conversion',
      value: `${data.quoteConversionPercent}%`,
      detail: 'Accepted / total quotes',
      icon: BarChart3,
      tone: 'positive',
    },
  ];
  return (
    <section className="metric-grid" aria-label="Key performance indicators">
      {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
        <article className="metric-card" key={label}>
          <div className={`metric-icon metric-icon--${tone}`}>
            <Icon />
          </div>
          <div className="metric-copy">
            <p>{label}</p>
            <strong>{value}</strong>
            <span className={`metric-detail metric-detail--${tone}`}>
              {detail}
            </span>
          </div>
        </article>
      ))}
    </section>
  );
}

function RevenueChart() {
  return (
    <article className="panel revenue-panel">
      <div className="panel-heading">
        <div>
          <h2>Revenue trend</h2>
          <p>Illustrative weekly forecast</p>
        </div>
        <div className="chart-legend">
          <span>
            <i className="line-key line-key--revenue" />
            Revenue
          </span>
          <span>
            <i className="line-key line-key--target" />
            Target
          </span>
        </div>
      </div>
      <div
        className="chart-wrap"
        aria-label="Weekly revenue versus target line chart"
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <LineChart
            data={revenueData}
            margin={{ top: 12, right: 8, left: -20, bottom: 0 }}
          >
            <CartesianGrid vertical={false} stroke="#ece9e3" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#727873', fontSize: 11 }}
            />
            <YAxis
              tickFormatter={(value) => `$${value / 1000}K`}
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#727873', fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => [`$${Number(value).toLocaleString()}`, '']}
              contentStyle={{ border: '1px solid #e8e5df', borderRadius: 8 }}
            />
            <Legend content={() => null} />
            <Line
              type="monotone"
              dataKey="target"
              stroke="#9da39f"
              strokeDasharray="5 5"
              strokeWidth={1.5}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="revenue"
              stroke="#0b675f"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-summary">
        <span>
          <small>Purpose</small>
          <strong>Capacity planning</strong>
        </span>
        <span>
          <small>Source</small>
          <strong>Forecast model</strong>
        </span>
      </div>
    </article>
  );
}

function OperationsBoard({
  jobs,
  onAdvance,
}: {
  jobs: DashboardJob[];
  onAdvance: (job: DashboardJob) => Promise<unknown>;
}) {
  const statuses: JobStatus[] = [
    'Scheduled',
    'En route',
    'In progress',
    'Completed',
  ];
  return (
    <article className="panel operations-panel">
      <div className="panel-heading">
        <div>
          <h2>Live operations</h2>
          <p>Synced with workspace records</p>
        </div>
      </div>
      <div className="operations-grid">
        {statuses.map((status) => {
          const items = jobs.filter((job) => job.status === status);
          return (
            <section
              className="operation-lane"
              key={status}
              aria-label={`${status} jobs`}
            >
              <header>
                <strong>{status}</strong>
                <span>{items.length}</span>
              </header>
              {items.slice(0, 2).map((job) => (
                <button
                  type="button"
                  className="job-card"
                  key={job.id}
                  onClick={() => {
                    if (getNextJobStatus(job.status)) void onAdvance(job);
                  }}
                >
                  <span>
                    <small>{shortTime(job.scheduledAt)}</small>
                    <b>{job.service}</b>
                    <small>{job.customer}</small>
                    <small>{job.city}</small>
                  </span>
                  <i
                    className={`priority priority--${job.priority.toLowerCase()}`}
                  >
                    {status === 'Completed' ? (
                      <Check aria-label="Completed" />
                    ) : null}
                  </i>
                </button>
              ))}
              <span className="lane-more">
                {items.length > 2
                  ? `+ ${items.length - 2} more jobs`
                  : `${items.length} total`}
              </span>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function TechnicianPanel() {
  return (
    <article className="panel compact-panel">
      <div className="panel-heading">
        <h2>Technician availability</h2>
      </div>
      <div className="people-list">
        {technicians.map((person) => (
          <div className="person-row" key={person.name}>
            <span className="avatar">{person.initials}</span>
            <span className="person-name">
              <strong>{person.name}</strong>
              <small>{person.role}</small>
            </span>
            <span className="person-status">
              <StatusDot status={person.status} />
              {person.status}
            </span>
            <span className="person-load">{person.load}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function AttentionPanel({ data }: { data: DashboardData }) {
  const expiring = data.quotes.filter((quote) => quote.status === 'sent');
  const unassigned = data.jobs.filter(
    (job) => job.technician.toLowerCase() === 'unassigned',
  );
  const alerts = [
    {
      label: `${data.metrics.overdueCount} overdue invoices`,
      amount: money(
        data.invoices
          .filter((item) => item.status === 'overdue')
          .reduce((sum, item) => sum + item.amountCents, 0),
      ),
      tone: 'danger',
      icon: FileText,
    },
    {
      label: `${expiring.length} quotes expiring soon`,
      amount: money(expiring.reduce((sum, item) => sum + item.amountCents, 0)),
      tone: 'warning',
      icon: FileCheck2,
    },
    {
      label: `${unassigned.length} unassigned jobs`,
      amount: 'Dispatch needed',
      tone: 'info',
      icon: BriefcaseBusiness,
    },
  ];
  return (
    <article className="panel compact-panel">
      <div className="panel-heading">
        <h2>Attention queue</h2>
      </div>
      <div className="attention-list">
        {alerts.map(({ label, amount, tone, icon: Icon }) => (
          <div className="attention-row" key={label}>
            <span className={`attention-icon attention-icon--${tone}`}>
              <Icon />
            </span>
            <strong>{label}</strong>
            <span>{amount}</span>
            <b>Review →</b>
          </div>
        ))}
      </div>
    </article>
  );
}

function ActivityPanel({
  activities,
}: {
  activities: DashboardData['activities'];
}) {
  return (
    <article className="panel compact-panel">
      <div className="panel-heading">
        <h2>Recent activity</h2>
      </div>
      <ol className="activity-list">
        {activities.map((event, index) => (
          <li key={event.id}>
            <span className={`activity-glyph activity-glyph--${index % 4}`}>
              <Clock3 />
            </span>
            <span>{event.message}</span>
            <time>{shortDate(event.createdAt)}</time>
          </li>
        ))}
      </ol>
    </article>
  );
}
function Overview({
  data,
  onAdvance,
}: {
  data: DashboardData;
  onAdvance: (job: DashboardJob) => Promise<unknown>;
}) {
  return (
    <>
      <MetricCards data={data.metrics} />
      <section className="dashboard-main-grid">
        <RevenueChart />
        <OperationsBoard jobs={data.jobs} onAdvance={onAdvance} />
      </section>
      <section className="dashboard-lower-grid">
        <TechnicianPanel />
        <AttentionPanel data={data} />
        <ActivityPanel activities={data.activities} />
      </section>
    </>
  );
}

function InviteTeammateDialog({
  onInvite,
}: {
  onInvite: (email: string, role: TeamInvitation['role']) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [commonError, setCommonError] = useState('');
  async function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = formString(form, 'email').trim().toLowerCase();
    const role = formString(form, 'role') as TeamInvitation['role'];
    setEmailError('');
    setCommonError('');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError(
        'Enter a complete email address, such as name@company.com.',
      );
      return;
    }
    setSaving(true);
    try {
      await onInvite(email, role);
      setOpen(false);
    } catch (error) {
      setCommonError(
        error instanceof Error
          ? error.message
          : 'The invitation could not be created.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setEmailError('');
          setCommonError('');
        }
      }}
    >
      <DialogTrigger render={<Button className="primary-button" size="lg" />}>
        <Mail /> Invite teammate
      </DialogTrigger>
      <DialogContent className="new-job-dialog sm:max-w-[480px]">
        <form noValidate onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Invite a teammate</DialogTitle>
            <DialogDescription>
              The invitation is bound to this workspace and expires after seven
              days.
            </DialogDescription>
          </DialogHeader>
          {commonError ? (
            <p className="form-alert" role="alert">
              {commonError}
            </p>
          ) : null}
          <div className="form-grid form-grid--single">
            <label htmlFor="invite-email">
              Work email
              <input
                id="invite-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                aria-invalid={emailError ? 'true' : undefined}
                aria-describedby={emailError ? 'invite-email-error' : undefined}
                onChange={() => setEmailError('')}
                placeholder="teammate@company.com"
              />
            </label>
            {emailError ? (
              <small id="invite-email-error" className="field-error">
                {emailError}
              </small>
            ) : null}
            <label htmlFor="invite-role">
              Workspace role
              <select id="invite-role" name="role" defaultValue="dispatcher">
                <option value="dispatcher">
                  Dispatcher — manage operations
                </option>
                <option value="technician">
                  Technician — field-work access
                </option>
              </select>
            </label>
            <p className="form-help">
              The operating system owns this simple role menu; Servora owns
              validation and permission enforcement.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="primary-button"
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? 'Creating invitation…' : 'Create invitation'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function MemberRoleDialog({
  member,
  onChange,
}: {
  member: TeamMember;
  onChange: (
    member: TeamMember,
    role: Exclude<TeamRole, 'owner'>,
  ) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  const otherRole = member.role === 'dispatcher' ? 'technician' : 'dispatcher';
  async function applyRoleChange() {
    setSaving(true);
    setFailure('');
    try {
      await onChange(member, otherRole);
      setOpen(false);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : 'The role could not be changed.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <UserRoundCog /> Change role
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Change {member.displayName} to {otherRole}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This changes what {member.displayName} can view and update in this
            workspace. The new permission takes effect after the server confirms
            it.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failure ? (
          <p className="form-alert" role="alert">
            {failure}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>
            Keep current role
          </AlertDialogCancel>
          <AlertDialogAction
            className="primary-button"
            disabled={saving}
            aria-busy={saving}
            onClick={() => void applyRoleChange()}
          >
            {saving ? 'Changing role…' : `Change to ${otherRole}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function RevokeInvitationDialog({
  invitation,
  onRevoke,
}: {
  invitation: TeamInvitation;
  onRevoke: (invitation: TeamInvitation) => Promise<unknown>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState('');
  async function applyRevocation() {
    setSaving(true);
    setFailure('');
    try {
      await onRevoke(invitation);
      setOpen(false);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : 'The invitation could not be revoked.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="destructive" onClick={() => setOpen(true)}>
        Revoke
      </Button>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
          <AlertDialogDescription>
            {invitation.email} will no longer be able to join this workspace
            from this invitation. You can create a new invitation later.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {failure ? (
          <p className="form-alert" role="alert">
            {failure}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={saving}>
            Keep invitation
          </AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={saving}
            aria-busy={saving}
            onClick={() => void applyRevocation()}
          >
            {saving ? 'Revoking…' : 'Revoke invitation'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

type TeamViewProps = {
  team: TeamData | null;
  loading: boolean;
  failure: string;
  onRetry: () => void;
  onInvite: (email: string, role: TeamInvitation['role']) => Promise<unknown>;
  onRevoke: (invitation: TeamInvitation) => Promise<unknown>;
  onRoleChange: (
    member: TeamMember,
    role: Exclude<TeamRole, 'owner'>,
  ) => Promise<unknown>;
};

function TeamView({
  team,
  loading,
  failure,
  onRetry,
  onInvite,
  onRevoke,
  onRoleChange,
}: TeamViewProps) {
  if (loading)
    return (
      <section className="data-view panel team-state" aria-busy="true">
        <Clock3 />
        <h2>Loading team access…</h2>
      </section>
    );
  if (!team)
    return (
      <section className="data-view panel team-state">
        <ShieldCheck />
        <h2>
          {failure.includes('role')
            ? 'Access denied'
            : 'Team access unavailable'}
        </h2>
        <p>{failure || 'Servora could not load this workspace’s members.'}</p>
        {failure.includes('role') ? null : (
          <Button variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
      </section>
    );
  return (
    <section className="data-view panel team-view">
      <div className="team-heading">
        <div>
          <span className="eyebrow">
            <ShieldCheck /> Workspace security
          </span>
          <h2>Team &amp; access</h2>
          <p>
            {team.memberCount} active member{team.memberCount === 1 ? '' : 's'}{' '}
            · {team.invitations.length} pending invitation
            {team.invitations.length === 1 ? '' : 's'}
          </p>
        </div>
        {team.canManage ? (
          <InviteTeammateDialog onInvite={onInvite} />
        ) : (
          <div className="read-only-note">
            <ShieldCheck /> Read-only team access
          </div>
        )}
      </div>
      <div className="responsive-table">
        <table aria-label="Workspace members">
          <thead>
            <tr>
              <th scope="col">Member</th>
              <th scope="col">Email</th>
              <th scope="col">Role</th>
              <th scope="col">Joined</th>
              <th scope="col">Access</th>
            </tr>
          </thead>
          <tbody>
            {team.members.map((member) => (
              <tr key={member.id}>
                <td>
                  <strong>{member.displayName}</strong>
                  {member.role === 'owner' ? (
                    <small>Workspace owner</small>
                  ) : null}
                </td>
                <td>{member.email}</td>
                <td>
                  <span className={`role-badge role-badge--${member.role}`}>
                    {member.role}
                  </span>
                </td>
                <td>{shortDate(member.joinedAt)}</td>
                <td>
                  {team.canManage && member.role !== 'owner' ? (
                    <MemberRoleDialog member={member} onChange={onRoleChange} />
                  ) : (
                    <small>
                      {member.role === 'owner' ? 'Protected role' : 'View only'}
                    </small>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="pending-section">
        <div className="panel-heading">
          <div>
            <h3>Pending invitations</h3>
            <p>Invitations expire automatically after seven days.</p>
          </div>
        </div>
        {team.invitations.length ? (
          <div className="responsive-table">
            <table aria-label="Pending workspace invitations">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Role</th>
                  <th scope="col">Expires</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {team.invitations.map((invitation) => (
                  <tr key={invitation.id}>
                    <td>
                      <strong>{invitation.email}</strong>
                    </td>
                    <td>
                      <span
                        className={`role-badge role-badge--${invitation.role}`}
                      >
                        {invitation.role}
                      </span>
                    </td>
                    <td>{shortDate(invitation.expiresAt)}</td>
                    <td>
                      {team.canManage ? (
                        <RevokeInvitationDialog
                          invitation={invitation}
                          onRevoke={onRevoke}
                        />
                      ) : (
                        <small>View only</small>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-inline">
            <Mail />
            <div>
              <strong>No pending invitations</strong>
              <p>
                New invitations will appear here until they are accepted,
                revoked, or expire.
              </p>
            </div>
          </div>
        )}
      </section>
    </section>
  );
}

type DataViewProps = {
  view: Exclude<ViewName, 'Overview'>;
  data: DashboardData;
  query: string;
  teamProps: TeamViewProps;
  onAdvance: (job: DashboardJob) => Promise<unknown>;
  onAcceptQuote: (quote: DashboardQuote) => Promise<unknown>;
  onCreateInvoice: (
    jobId: string,
    amountCents: number,
    dueAt: string,
  ) => Promise<unknown>;
  onRecordPayment: (
    invoice: DashboardInvoice,
    draft: PaymentDraft,
  ) => Promise<unknown>;
  onStartStripeCheckout: (
    invoice: DashboardInvoice,
    idempotencyKey: string,
  ) => Promise<unknown>;
  onAttachmentsChanged: () => Promise<void>;
};
function DataView({
  view,
  data,
  query,
  teamProps,
  onAdvance,
  onAcceptQuote,
  onCreateInvoice,
  onRecordPayment,
  onStartStripeCheckout,
  onAttachmentsChanged,
}: DataViewProps) {
  const normalizedQuery = query.trim().toLowerCase();
  const match = (...values: string[]) =>
    !normalizedQuery ||
    values.join(' ').toLowerCase().includes(normalizedQuery);
  const filteredJobs = data.jobs.filter((job) =>
    match(job.service, job.customer, job.city, job.technician, job.status),
  );
  const filteredCustomers = data.customers.filter((customer) =>
    match(customer.name, customer.contactName, customer.email, customer.city),
  );
  const filteredInvoices = data.invoices.filter((invoice) =>
    match(invoice.id, invoice.customer, invoice.status),
  );
  const filteredQuotes = data.quotes.filter((quote) =>
    match(quote.title, quote.customer, quote.status),
  );
  if (view === 'Settings') return <TeamView {...teamProps} />;
  return (
    <section className="data-view panel">
      {view === 'Jobs' || view === 'Schedule' ? (
        filteredJobs.length ? (
          <div className="responsive-table">
            <table className="mobile-card-table">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Customer</th>
                  <th>Technician</th>
                  <th>Time</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredJobs.map((job) => {
                  const next = getNextJobStatus(job.status);
                  return (
                    <tr key={job.id}>
                      <td data-label="Job">
                        <strong>{compactId('J', job.id)}</strong>
                        <small>{job.service}</small>
                      </td>
                      <td data-label="Customer">
                        {job.customer}
                        <small>{job.city}</small>
                      </td>
                      <td data-label="Technician">{job.technician}</td>
                      <td data-label="Time">
                        {shortDate(job.scheduledAt)} ·{' '}
                        {shortTime(job.scheduledAt)}
                      </td>
                      <td data-label="Priority">{job.priority}</td>
                      <td data-label="Status">
                        <span className="status-label">
                          <StatusDot status={job.status} />
                          {job.status}
                        </span>
                      </td>
                      <td data-label="Action">
                        <div className="row-actions">
                          <JobAttachmentsDialog
                            job={job}
                            onChanged={onAttachmentsChanged}
                          />
                          {next ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void onAdvance(job)}
                            >
                              Move to {next}
                            </Button>
                          ) : job.status === 'Completed' && !job.invoiceId ? (
                            <InvoiceDialog
                              job={job}
                              onCreate={onCreateInvoice}
                            />
                          ) : job.invoiceId ? (
                            <small>Invoiced</small>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <NoResults query={query} />
        )
      ) : view === 'Customers' ? (
        filteredCustomers.length ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Primary contact</th>
                  <th>Email</th>
                  <th>Location</th>
                  <th>Jobs</th>
                  <th>Lifetime value</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <strong>{customer.name}</strong>
                    </td>
                    <td>{customer.contactName}</td>
                    <td>
                      {customer.email}
                      <small>{customer.phone}</small>
                    </td>
                    <td>{customer.city}</td>
                    <td>{customer.jobCount}</td>
                    <td>{money(customer.lifetimeValueCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NoResults query={query} />
        )
      ) : view === 'Invoices' ? (
        filteredInvoices.length ? (
          <div className="responsive-table">
            <table className="mobile-card-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Issued</th>
                  <th>Due</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredInvoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td data-label="Invoice">
                      <strong>{compactId('INV', invoice.id)}</strong>
                    </td>
                    <td data-label="Customer">{invoice.customer}</td>
                    <td data-label="Issued">{shortDate(invoice.issuedAt)}</td>
                    <td data-label="Due">{shortDate(invoice.dueAt)}</td>
                    <td data-label="Amount">{money(invoice.amountCents)}</td>
                    <td data-label="Status">
                      <span className="status-label">
                        <StatusDot status={invoice.status} />
                        {invoice.status}
                      </span>
                      {invoice.status === 'paid' && invoice.paidAt ? (
                        <small className="payment-detail">
                          {shortDate(invoice.paidAt)}
                          {invoice.paymentMethod
                            ? ` · ${invoice.paymentMethod.replace('_', ' ')}`
                            : ''}
                          {invoice.paymentReference
                            ? ` · ${invoice.paymentReference}`
                            : ''}
                        </small>
                      ) : null}
                    </td>
                    <td data-label="Action">
                      {['open', 'overdue'].includes(invoice.status) ? (
                        <InvoicePaymentDialog
                          invoice={invoice}
                          stripeTestMode={data.capabilities.stripeTestMode}
                          onRecord={onRecordPayment}
                          onStartStripeCheckout={onStartStripeCheckout}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NoResults query={query} />
        )
      ) : view === 'Quotes' ? (
        filteredQuotes.length ? (
          <div className="responsive-table">
            <table>
              <thead>
                <tr>
                  <th>Quote</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Expires</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredQuotes.map((quote) => (
                  <tr key={quote.id}>
                    <td>
                      <strong>{compactId('Q', quote.id)}</strong>
                    </td>
                    <td>{quote.customer}</td>
                    <td>{quote.title}</td>
                    <td>{shortDate(quote.expiresAt)}</td>
                    <td>{money(quote.amountCents)}</td>
                    <td>
                      <span className="status-label">
                        <StatusDot status={quote.status} />
                        {quote.status}
                      </span>
                    </td>
                    <td>
                      {['draft', 'sent'].includes(quote.status) ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => void onAcceptQuote(quote)}
                        >
                          Accept &amp; schedule
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <NoResults query={query} />
        )
      ) : view === 'Technicians' ? (
        <div className="technician-cards">
          {technicians
            .filter((person) => match(person.name, person.role, person.status))
            .map((person) => (
              <article key={person.name}>
                <span className="avatar">{person.initials}</span>
                <div>
                  <strong>{person.name}</strong>
                  <small>{person.role}</small>
                </div>
                <span className="status-label">
                  <StatusDot status={person.status} />
                  {person.status}
                </span>
                <b>{person.load}</b>
              </article>
            ))}
        </div>
      ) : (
        <div className="feature-state">
          <BarChart3 />
          <h2>{view} workspace</h2>
          <p>
            This area is intentionally marked as a later module. The working
            portfolio slice is Customer → Quote/Job → Invoice → Payment.
          </p>
        </div>
      )}
    </section>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="empty-inline no-results">
      <Search />
      <div>
        <strong>No matching records</strong>
        <p>
          No records match “{query}”. Clear the workspace search to restore the
          full list.
        </p>
      </div>
    </div>
  );
}

export function ServoraDashboard() {
  const [activeView, setActiveView] = useState<ViewName>('Overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState('');
  const [notice, setNotice] = useState('');
  const [team, setTeam] = useState<TeamData | null>(null);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamFailure, setTeamFailure] = useState('');
  const announce = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(''), 4500);
  }, []);
  const load = useCallback(async () => {
    setFailure('');
    try {
      const next = await api<DashboardData>('/api/dashboard');
      setData(next);
    } catch (error) {
      setFailure(
        error instanceof Error ? error.message : 'Could not load workspace.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);
  const mutate = useCallback(
    async <T,>(
      path: string,
      body: Record<string, unknown>,
      message: string,
    ) => {
      try {
        const result = await api<T>(path, {
          method: 'POST',
          body: JSON.stringify(body),
        });
        await load();
        announce(message);
        return result;
      } catch (error) {
        const messageText =
          error instanceof Error ? error.message : 'The request failed.';
        setFailure(messageText);
        throw error;
      }
    },
    [announce, load],
  );
  const createCustomer = useCallback(
    (draft: Record<string, string>) =>
      mutate('/api/customers', draft, `${draft.name} was added.`),
    [mutate],
  );
  const createJob = useCallback(
    (draft: JobDraft) => mutate('/api/jobs', draft, 'Job scheduled and saved.'),
    [mutate],
  );
  const createQuote = useCallback(
    (draft: Record<string, unknown>) =>
      mutate('/api/quotes', draft, 'Quote sent and saved.'),
    [mutate],
  );
  const advanceJob = useCallback(
    async (job: DashboardJob) => {
      const status = getNextJobStatus(job.status);
      if (status)
        await mutate(
          '/api/jobs/status',
          { jobId: job.id, status },
          `${compactId('J', job.id)} moved to ${status}.`,
        );
    },
    [mutate],
  );
  const acceptQuote = useCallback(
    (quote: DashboardQuote) =>
      mutate(
        '/api/quotes/accept',
        {
          quoteId: quote.id,
          technician: technicians[0].name,
          scheduledAt: new Date(`${defaultTomorrow}T09:00`).toISOString(),
        },
        'Quote accepted and converted to a scheduled job.',
      ),
    [mutate],
  );
  const createInvoice = useCallback(
    (jobId: string, amountCents: number, dueAt: string) =>
      mutate(
        '/api/invoices',
        { jobId, amountCents, dueAt },
        'Invoice issued and saved.',
      ),
    [mutate],
  );
  const recordPayment = useCallback(
    async (invoice: DashboardInvoice, draft: PaymentDraft) => {
      const result = await api('/api/payments/manual', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: invoice.id, ...draft }),
      });
      await load();
      announce(`${compactId('INV', invoice.id)} payment recorded.`);
      return result;
    },
    [announce, load],
  );
  const startStripeCheckout = useCallback(
    async (invoice: DashboardInvoice, idempotencyKey: string) => {
      const result = await api<{ url: string }>('/api/payments/checkout', {
        method: 'POST',
        body: JSON.stringify({ invoiceId: invoice.id, idempotencyKey }),
      });
      window.location.assign(result.url);
      return result;
    },
    [],
  );
  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    setTeamFailure('');
    try {
      setTeam(await api<TeamData>('/api/team'));
    } catch (error) {
      setTeam(null);
      setTeamFailure(
        error instanceof Error ? error.message : 'Could not load team access.',
      );
    } finally {
      setTeamLoading(false);
    }
  }, []);
  useEffect(() => {
    if (activeView === 'Settings') queueMicrotask(() => void loadTeam());
  }, [activeView, loadTeam]);
  useEffect(() => {
    document.title = `${activeView === 'Settings' ? 'Team & access' : activeView} — Servora`;
  }, [activeView]);
  const mutateTeam = useCallback(
    async <T,>(
      path: string,
      body: Record<string, unknown>,
      message: string,
    ) => {
      const result = await api<T>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      await loadTeam();
      announce(message);
      return result;
    },
    [announce, loadTeam],
  );
  const inviteTeammate = useCallback(
    (email: string, role: TeamInvitation['role']) =>
      mutateTeam(
        '/api/team/invitations',
        { email, role },
        `Invitation created for ${email}.`,
      ),
    [mutateTeam],
  );
  const revokeInvitation = useCallback(
    (invitation: TeamInvitation) =>
      mutateTeam(
        '/api/team/invitations/revoke',
        { invitationId: invitation.id },
        `Invitation for ${invitation.email} revoked.`,
      ),
    [mutateTeam],
  );
  const changeMemberRole = useCallback(
    (member: TeamMember, role: Exclude<TeamRole, 'owner'>) =>
      mutateTeam(
        '/api/team/members/role',
        { membershipId: member.id, role },
        `${member.displayName} is now a ${role}.`,
      ),
    [mutateTeam],
  );

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool(
        {
          name: 'read_operations_summary',
          title: 'Read operations summary',
          description:
            'Read persisted Servora workspace metrics and job counts.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          async execute() {
            const current = await api<DashboardData>('/api/dashboard');
            return {
              metrics: current.metrics,
              jobsByStatus: Object.fromEntries(
                ['Scheduled', 'En route', 'In progress', 'Completed'].map(
                  (status) => [
                    status,
                    current.jobs.filter((job) => job.status === status).length,
                  ],
                ),
              ),
            };
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'create_customer',
          title: 'Create customer',
          description:
            'Create and persist a customer in the authenticated Servora workspace.',
          inputSchema: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              contactName: { type: 'string' },
              email: { type: 'string' },
              phone: { type: 'string' },
              city: { type: 'string' },
            },
            required: ['name', 'contactName', 'email', 'phone', 'city'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const result = await api<{ id: string }>('/api/customers', {
              method: 'POST',
              body: JSON.stringify(input),
            });
            await load();
            return result;
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'create_scheduled_job',
          title: 'Create scheduled job',
          description:
            'Create and persist a scheduled job for an existing customer ID.',
          inputSchema: {
            type: 'object',
            properties: {
              customerId: { type: 'string' },
              service: { type: 'string' },
              city: { type: 'string' },
              technician: { type: 'string' },
              scheduledAt: { type: 'string' },
              priority: { type: 'string', enum: ['Low', 'Medium', 'High'] },
            },
            required: [
              'customerId',
              'service',
              'city',
              'technician',
              'scheduledAt',
              'priority',
            ],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const result = await api<{ id: string; status: string }>(
              '/api/jobs',
              { method: 'POST', body: JSON.stringify(input) },
            );
            await load();
            return result;
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'advance_job_status',
          title: 'Advance job status',
          description:
            'Advance a persisted job through Scheduled, En route, In progress, and Completed.',
          inputSchema: {
            type: 'object',
            properties: {
              jobId: { type: 'string' },
              status: {
                type: 'string',
                enum: ['En route', 'In progress', 'Completed'],
              },
            },
            required: ['jobId', 'status'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const result = await api<{ id: string; status: string }>(
              '/api/jobs/status',
              { method: 'POST', body: JSON.stringify(input) },
            );
            await load();
            return result;
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'read_team_access',
          title: 'Read team access',
          description:
            'Read members and pending invitations for the authenticated Servora workspace.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          async execute() {
            return api<TeamData>('/api/team');
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'read_invoice_payments',
          title: 'Read invoice payments',
          description:
            'Read the payment ledger for an invoice in the authenticated Servora workspace.',
          inputSchema: {
            type: 'object',
            properties: { invoiceId: { type: 'string' } },
            required: ['invoiceId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          async execute(input) {
            const invoiceId = String(
              (input as { invoiceId: string }).invoiceId,
            );
            return api(
              `/api/payments?invoiceId=${encodeURIComponent(invoiceId)}`,
            );
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'read_job_attachments',
          title: 'Read job attachments',
          description:
            'Read private file metadata for a job in the authenticated Servora workspace.',
          inputSchema: {
            type: 'object',
            properties: { jobId: { type: 'string' } },
            required: ['jobId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          async execute(input) {
            const jobId = String((input as { jobId: string }).jobId);
            return api(
              `/api/jobs/attachments?jobId=${encodeURIComponent(jobId)}`,
            );
          },
        },
        { signal: lifecycle.signal },
      );
      await context.registerTool(
        {
          name: 'create_team_invitation',
          title: 'Create team invitation',
          description:
            'Create a seven-day dispatcher or technician invitation. Owner access is required.',
          inputSchema: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              role: { type: 'string', enum: ['dispatcher', 'technician'] },
            },
            required: ['email', 'role'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          async execute(input) {
            const result = await api<TeamInvitation>('/api/team/invitations', {
              method: 'POST',
              body: JSON.stringify(input),
            });
            await loadTeam();
            return result;
          },
        },
        { signal: lifecycle.signal },
      );
    };
    void register().catch((error: unknown) =>
      console.warn('WebMCP registration was unavailable.', error),
    );
    return () => lifecycle.abort();
  }, [load, loadTeam]);

  const resultCount = useMemo(() => {
    if (!data || !query.trim()) return 0;
    const entries = [
      ...data.jobs.map((job) => `${job.service} ${job.customer} ${job.city}`),
      ...data.customers.map((customer) => `${customer.name} ${customer.email}`),
      ...data.invoices.map((invoice) => `${invoice.id} ${invoice.customer}`),
      ...data.quotes.map((quote) => `${quote.title} ${quote.customer}`),
    ];
    return entries.filter((entry) =>
      entry.toLowerCase().includes(query.toLowerCase()),
    ).length;
  }, [data, query]);
  if (loading)
    return (
      <div className="feature-state app-loading">
        <Clock3 />
        <h1>Opening the operations workspace…</h1>
      </div>
    );
  if (!data)
    return (
      <div className="feature-state app-loading">
        <FileText />
        <h1>Workspace unavailable</h1>
        <p>{failure}</p>
        <Button
          className="primary-button"
          onClick={() => {
            setLoading(true);
            void load();
          }}
        >
          Retry
        </Button>
      </div>
    );
  const firstName = data.session.user.displayName.split(' ')[0];
  const title =
    activeView === 'Overview' ? `Good morning, ${firstName}` : activeView;
  const subtitle =
    activeView === 'Overview'
      ? `Here’s what’s happening with ${data.session.workspace.name}.`
      : `${activeView} for the ${data.session.workspace.name} workspace.`;
  const teamProps: TeamViewProps = {
    team,
    loading: teamLoading,
    failure: teamFailure,
    onRetry: () => void loadTeam(),
    onInvite: inviteTeammate,
    onRevoke: revokeInvitation,
    onRoleChange: changeMemberRole,
  };
  const showsNewJob = ['Overview', 'Jobs', 'Schedule'].includes(activeView);
  return (
    <div className="app-shell">
      <Sidebar
        active={activeView}
        onChange={setActiveView}
        mobileOpen={mobileNav}
        onClose={() => setMobileNav(false)}
      />
      {mobileNav ? (
        <button
          type="button"
          className="sidebar-backdrop"
          onClick={() => setMobileNav(false)}
          aria-label="Close navigation"
        />
      ) : null}
      <div className="app-column">
        <Header
          onMenu={() => setMobileNav(true)}
          query={query}
          setQuery={setQuery}
          workspace={data.session.workspace.name}
          user={data.session.user.displayName}
          role={data.session.role}
        />
        <main className="app-content" id="overview">
          <div className="page-heading">
            <div>
              <h1>{title}</h1>
              <p>{subtitle}</p>
              {query ? (
                <output className="search-feedback">
                  {resultCount} workspace result{resultCount === 1 ? '' : 's'}{' '}
                  for “{query}”
                </output>
              ) : null}
            </div>
            <div className="heading-actions">
              {activeView === 'Customers' ? (
                <NewCustomerDialog onCreate={createCustomer} />
              ) : null}
              {activeView === 'Quotes' ? (
                <NewQuoteDialog
                  customers={data.customers}
                  onCreate={createQuote}
                />
              ) : null}
              {showsNewJob ? (
                <NewJobDialog customers={data.customers} onCreate={createJob} />
              ) : null}
            </div>
          </div>
          {failure ? (
            <p className="search-feedback" role="alert">
              {failure}
            </p>
          ) : null}
          {activeView === 'Overview' ? (
            <Overview data={data} onAdvance={advanceJob} />
          ) : (
            <DataView
              view={activeView}
              data={data}
              query={query}
              teamProps={teamProps}
              onAdvance={advanceJob}
              onAcceptQuote={acceptQuote}
              onCreateInvoice={createInvoice}
              onRecordPayment={recordPayment}
              onStartStripeCheckout={startStripeCheckout}
              onAttachmentsChanged={load}
            />
          )}
        </main>
      </div>
      <output
        className={`toast-message ${notice ? 'toast-message--visible' : ''}`}
        aria-live="polite"
      >
        <Check />
        {notice}
      </output>
    </div>
  );
}
