'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type SyntheticEvent } from 'react';
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
  Menu,
  Plus,
  Search,
  Settings,
  SlidersHorizontal,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { customers, initialJobs, invoices, revenueData, technicians, type Job } from '@/lib/demo-data';

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

const metrics = [
  { label: 'Revenue (MTD)', value: '$84,260', detail: '+18% vs last month', icon: CircleDollarSign, tone: 'positive' },
  { label: 'Outstanding invoices', value: '$23,415', detail: '7 invoices overdue', icon: FileText, tone: 'warning' },
  { label: 'Jobs today', value: '26', detail: '8 currently in progress', icon: BriefcaseBusiness, tone: 'info' },
  { label: 'Quote conversion', value: '34%', detail: '+4pp vs last month', icon: BarChart3, tone: 'positive' },
] as const;

function Brand() {
  return (
    <div className="brand" aria-label="Servora home">
      <span className="brand-mark" aria-hidden="true">S</span>
      <span>servora</span>
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const tone = status === 'Available' || status === 'Paid' ? 'positive' : status === 'Overdue' ? 'danger' : status === 'Off today' ? 'muted' : status === 'On break' ? 'warning' : 'info';
  return <span className={`status-dot status-dot--${tone}`} aria-hidden="true" />;
}

function Sidebar({ active, onChange, mobileOpen, onClose }: { active: ViewName; onChange: (view: ViewName) => void; mobileOpen: boolean; onClose: () => void }) {
  return (
    <aside className={`sidebar ${mobileOpen ? 'sidebar--open' : ''}`} aria-label="Primary navigation">
      <div className="sidebar-head">
        <Brand />
        <button className="icon-button sidebar-close" type="button" onClick={onClose} aria-label="Close navigation"><X /></button>
      </div>
      <nav className="nav-list">
        {navItems.map(({ label, icon: Icon }) => (
          <button
            type="button"
            key={label}
            className={`nav-item ${active === label ? 'nav-item--active' : ''}`}
            aria-current={active === label ? 'page' : undefined}
            onClick={() => { onChange(label); onClose(); }}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-spacer" />
      <section className="plan-card" aria-label="Plan usage">
        <div><strong>Pro Plan</strong><span>28 / 50 users</span></div>
        <div className="plan-track"><span /></div>
        <button type="button">View plan details <span aria-hidden="true">→</span></button>
      </section>
      <button type="button" className="support-button"><HelpCircle /> Help &amp; support <span aria-hidden="true">›</span></button>
    </aside>
  );
}

function NewJobDialog({ onCreate }: { onCreate: (job: Job) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  function submit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (name: string, fallback: string) => {
      const value = form.get(name);
      return typeof value === 'string' && value.trim() ? value.trim() : fallback;
    };
    setSaving(true);
    window.setTimeout(() => {
      onCreate({
        id: `J-${2051 + Math.floor(Math.random() * 40)}`,
        time: field('time', '1:00 PM'),
        title: field('service', 'New service visit'),
        customer: field('customer', 'New customer'),
        city: field('city', 'Chicago'),
        technician: field('technician', 'Unassigned'),
        priority: 'Medium',
        status: 'Scheduled',
      });
      setSaving(false);
      setOpen(false);
    }, 450);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="primary-button" size="lg" />}>
        <Plus /> New job
      </DialogTrigger>
      <DialogContent className="new-job-dialog sm:max-w-[520px]">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle className="text-lg">Create a scheduled job</DialogTitle>
            <DialogDescription>Add the essential dispatch details. The job can be completed in its workspace.</DialogDescription>
          </DialogHeader>
          <div className="form-grid">
            <label>Customer<input name="customer" required placeholder="Northline Dental" /></label>
            <label>Service<input name="service" required placeholder="Boiler inspection" /></label>
            <label>City<input name="city" required placeholder="Evanston" /></label>
            <label>Technician<select name="technician" defaultValue=""><option value="" disabled>Select technician</option>{technicians.map((person) => <option key={person.name}>{person.name}</option>)}</select></label>
            <label>Date<input name="date" type="date" required defaultValue="2025-05-19" /></label>
            <label>Time<input name="time" type="time" required defaultValue="13:00" /></label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" className="primary-button" disabled={saving}>{saving ? 'Creating…' : 'Create job'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Header({ onMenu, query, setQuery }: { onMenu: () => void; query: string; setQuery: (value: string) => void }) {
  return (
    <header className="topbar">
      <button className="icon-button menu-button" type="button" onClick={onMenu} aria-label="Open navigation"><Menu /></button>
      <button type="button" className="workspace-switcher"><BriefcaseBusiness /><span><strong>Summit Services</strong><small>Chicago, IL</small></span><ChevronDown /></button>
      <label className="global-search"><Search aria-hidden="true" /><span className="sr-only">Search workspace</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search jobs, customers, invoices…" /><kbd>⌘ K</kbd></label>
      <div className="topbar-actions">
        <button type="button" className="icon-button notification-button" aria-label="Notifications, 3 unread"><Bell /><span>3</span></button>
        <button type="button" className="account-button"><span className="avatar avatar--dark">AC</span><span><strong>Alex Carter</strong><small>Owner</small></span><ChevronDown /></button>
      </div>
    </header>
  );
}

function MetricCards() {
  return (
    <section className="metric-grid" aria-label="Key performance indicators">
      {metrics.map(({ label, value, detail, icon: Icon, tone }) => (
        <article className="metric-card" key={label}>
          <div className={`metric-icon metric-icon--${tone}`}><Icon /></div>
          <div className="metric-copy"><p>{label}</p><strong>{value}</strong><span className={`metric-detail metric-detail--${tone}`}>{detail}</span></div>
        </article>
      ))}
    </section>
  );
}

function RevenueChart() {
  return (
    <article className="panel revenue-panel">
      <div className="panel-heading"><div><h2>Revenue vs target</h2><p>This week</p></div><div className="chart-legend"><span><i className="line-key line-key--revenue" />Revenue</span><span><i className="line-key line-key--target" />Target</span></div></div>
      <div className="chart-wrap" aria-label="Weekly revenue versus target line chart">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={revenueData} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#ece9e3" />
            <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#727873', fontSize: 11 }} />
            <YAxis tickFormatter={(value) => `$${value / 1000}K`} tickLine={false} axisLine={false} tick={{ fill: '#727873', fontSize: 11 }} />
            <Tooltip formatter={(value) => [`$${Number(value).toLocaleString()}`, '']} contentStyle={{ border: '1px solid #e8e5df', borderRadius: 8, boxShadow: '0 10px 30px rgb(23 34 31 / 8%)' }} />
            <Legend content={() => null} />
            <Line type="monotone" dataKey="target" stroke="#9da39f" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
            <Line type="monotone" dataKey="revenue" stroke="#0b675f" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#0b675f' }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="chart-summary"><span><small>Week to date</small><strong>$81,430</strong></span><span><small>Target</small><strong>$102,000</strong></span><span><small>Remaining</small><strong>$20,570</strong></span><span><small>% of target</small><strong className="teal-text">79%</strong></span></div>
    </article>
  );
}

function OperationsBoard({ jobs }: { jobs: Job[] }) {
  const statuses: Job['status'][] = ['Scheduled', 'En route', 'In progress', 'Completed'];
  return (
    <article className="panel operations-panel">
      <div className="panel-heading"><div><h2>Live operations</h2><p>Updated just now</p></div><button type="button" className="text-action">View full board <span aria-hidden="true">→</span></button></div>
      <div className="operations-grid">
        {statuses.map((status) => {
          const items = jobs.filter((job) => job.status === status);
          return (
            <section className="operation-lane" key={status} aria-label={`${status} jobs`}>
              <header><strong>{status}</strong><span>{items.length}</span></header>
              {items.slice(0, 2).map((job) => (
                <button type="button" className="job-card" key={job.id}>
                  <span><small>{job.time}</small><b>{job.title}</b><small>{job.customer}</small><small>{job.city}</small></span>
                  <i className={`priority priority--${job.priority.toLowerCase()}`}>{status === 'Completed' ? <Check aria-label="Completed" /> : null}</i>
                </button>
              ))}
              <button type="button" className="lane-more">+ {Math.max(2, items.length + 4)} more jobs</button>
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
      <div className="panel-heading"><h2>Technician availability</h2><button type="button" className="text-action">View all <span aria-hidden="true">→</span></button></div>
      <div className="people-list">{technicians.map((person) => <button type="button" className="person-row" key={person.name}><span className="avatar">{person.initials}</span><span className="person-name"><strong>{person.name}</strong><small>{person.role}</small></span><span className="person-status"><StatusDot status={person.status} />{person.status}</span><span className="person-load">{person.load}</span></button>)}</div>
    </article>
  );
}

function AttentionPanel() {
  const alerts = [
    { label: '7 overdue invoices', amount: '$8,945.50', tone: 'danger', icon: FileText },
    { label: '5 quotes expiring soon', amount: '$12,340.00', tone: 'warning', icon: FileCheck2 },
    { label: '3 unassigned jobs', amount: '$1,280.00', tone: 'info', icon: BriefcaseBusiness },
  ];
  return (
    <article className="panel compact-panel">
      <div className="panel-heading"><h2>Attention queue</h2><button type="button" className="text-action">View all <span aria-hidden="true">→</span></button></div>
      <div className="attention-list">{alerts.map(({ label, amount, tone, icon: Icon }) => <button type="button" className="attention-row" key={label}><span className={`attention-icon attention-icon--${tone}`}><Icon /></span><strong>{label}</strong><span>{amount}</span><b>Review →</b></button>)}</div>
    </article>
  );
}

function ActivityPanel() {
  const events = [
    ['Invoice #10432 paid by Acme Properties', '2m ago'],
    ['Job #3021 completed by Amanda Lee', '15m ago'],
    ['New quote #Q1543 created for David Ruiz', '1h ago'],
    ['You rescheduled Job #3018', '3h ago'],
  ];
  return (
    <article className="panel compact-panel">
      <div className="panel-heading"><h2>Recent activity</h2><button type="button" className="text-action">View feed <span aria-hidden="true">→</span></button></div>
      <ol className="activity-list">{events.map(([event, time], index) => <li key={event}><span className={`activity-glyph activity-glyph--${index}`}><Clock3 /></span><span>{event}</span><time>{time}</time></li>)}</ol>
    </article>
  );
}

function Overview({ jobs }: { jobs: Job[] }) {
  return <><MetricCards /><section className="dashboard-main-grid"><RevenueChart /><OperationsBoard jobs={jobs} /></section><section className="dashboard-lower-grid"><TechnicianPanel /><AttentionPanel /><ActivityPanel /></section></>;
}

function DataView({ view, jobs }: { view: Exclude<ViewName, 'Overview'>; jobs: Job[] }) {
  const rows = view === 'Jobs' || view === 'Schedule' ? jobs : view === 'Customers' ? customers : view === 'Invoices' || view === 'Quotes' ? invoices : technicians;
  return (
    <section className="data-view panel">
      <div className="data-toolbar"><label><Search /><span className="sr-only">Search {view.toLowerCase()}</span><input placeholder={`Search ${view.toLowerCase()}…`} /></label><Button variant="outline"><SlidersHorizontal /> Filters</Button></div>
      {view === 'Jobs' || view === 'Schedule' ? (
        <div className="responsive-table"><table><thead><tr><th>Job</th><th>Customer</th><th>Technician</th><th>Time</th><th>Priority</th><th>Status</th></tr></thead><tbody>{(rows as Job[]).map((job) => <tr key={job.id}><td><strong>{job.id}</strong><small>{job.title}</small></td><td>{job.customer}<small>{job.city}</small></td><td>{job.technician}</td><td>{job.time}</td><td>{job.priority}</td><td><span className="status-label"><StatusDot status={job.status} />{job.status}</span></td></tr>)}</tbody></table></div>
      ) : view === 'Customers' ? (
        <div className="responsive-table"><table><thead><tr><th>Customer</th><th>Primary contact</th><th>Location</th><th>Jobs</th><th>Lifetime value</th><th>Last service</th></tr></thead><tbody>{customers.map((customer) => <tr key={customer.name}><td><strong>{customer.name}</strong></td><td>{customer.contact}</td><td>{customer.city}</td><td>{customer.jobs}</td><td>{customer.value}</td><td>{customer.lastService}</td></tr>)}</tbody></table></div>
      ) : view === 'Invoices' || view === 'Quotes' ? (
        <div className="responsive-table"><table><thead><tr><th>{view === 'Invoices' ? 'Invoice' : 'Quote'}</th><th>Customer</th><th>Issued</th><th>Due</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoices.map((invoice) => <tr key={invoice.id}><td><strong>{view === 'Invoices' ? invoice.id : invoice.id.replace('INV', 'Q')}</strong></td><td>{invoice.customer}</td><td>{invoice.issued}</td><td>{invoice.due}</td><td>{invoice.amount}</td><td><span className="status-label"><StatusDot status={invoice.status} />{invoice.status}</span></td></tr>)}</tbody></table></div>
      ) : view === 'Technicians' ? (
        <div className="technician-cards">{technicians.map((person) => <article key={person.name}><span className="avatar">{person.initials}</span><div><strong>{person.name}</strong><small>{person.role}</small></div><span className="status-label"><StatusDot status={person.status} />{person.status}</span><b>{person.load}</b></article>)}</div>
      ) : (
        <div className="feature-state"><BarChart3 /><h2>{view} workspace</h2><p>The production specification for this area is ready in the project backlog. This milestone focuses on the revenue-to-dispatch vertical slice.</p><Button className="primary-button">Review milestone</Button></div>
      )}
    </section>
  );
}

export function ServoraDashboard() {
  const [activeView, setActiveView] = useState<ViewName>('Overview');
  const [mobileNav, setMobileNav] = useState(false);
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState(initialJobs);
  const [notice, setNotice] = useState('');
  const [dateRange, setDateRange] = useState('May 12 – May 18, 2025');
  const jobsRef = useRef(jobs);
  const resultCount = useMemo(() => query.trim() ? [...jobs.map((job) => `${job.id} ${job.title} ${job.customer}`), ...customers.map((customer) => customer.name), ...invoices.map((invoice) => `${invoice.id} ${invoice.customer}`)].filter((entry) => entry.toLowerCase().includes(query.toLowerCase())).length : 0, [jobs, query]);

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  const createJob = useCallback((job: Job) => {
    setJobs((current) => [job, ...current]);
    setNotice(`${job.id} was created and added to Scheduled.`);
    window.setTimeout(() => setNotice(''), 4500);
  }, []);

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;

    const lifecycle = new AbortController();
    const register = async () => {
      await context.registerTool({
        name: 'read_operations_summary',
        title: 'Read operations summary',
        description: 'Read the current Servora dashboard totals and visible job counts without changing the workspace.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute() {
          const currentJobs = jobsRef.current;
          return {
            revenueMonthToDate: 84260,
            outstandingInvoices: 23415,
            quoteConversionPercent: 34,
            jobsByStatus: {
              scheduled: currentJobs.filter((job) => job.status === 'Scheduled').length,
              enRoute: currentJobs.filter((job) => job.status === 'En route').length,
              inProgress: currentJobs.filter((job) => job.status === 'In progress').length,
              completed: currentJobs.filter((job) => job.status === 'Completed').length,
            },
          };
        },
      }, { signal: lifecycle.signal });

      await context.registerTool({
        name: 'create_scheduled_job',
        title: 'Create scheduled job',
        description: 'Create a job in the visible Servora operations board with Scheduled status.',
        inputSchema: {
          type: 'object',
          properties: {
            customer: { type: 'string', minLength: 1 },
            service: { type: 'string', minLength: 1 },
            city: { type: 'string', minLength: 1 },
            technician: { type: 'string', minLength: 1 },
            time: { type: 'string', minLength: 1 },
          },
          required: ['customer', 'service', 'city', 'technician', 'time'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute(input) {
          if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Job details must be an object.');
          const record = input as Record<string, unknown>;
          const required = ['customer', 'service', 'city', 'technician', 'time'] as const;
          for (const key of required) {
            if (typeof record[key] !== 'string' || !record[key].trim()) throw new Error(`${key} is required.`);
          }
          const job: Job = {
            id: `J-${2051 + Math.floor(Math.random() * 40)}`,
            customer: (record.customer as string).trim(),
            title: (record.service as string).trim(),
            city: (record.city as string).trim(),
            technician: (record.technician as string).trim(),
            time: (record.time as string).trim(),
            priority: 'Medium',
            status: 'Scheduled',
          };
          createJob(job);
          return { id: job.id, status: job.status, customer: job.customer, service: job.title };
        },
      }, { signal: lifecycle.signal });
    };

    void register().catch((error: unknown) => {
      console.warn('WebMCP registration was unavailable.', error);
    });

    return () => lifecycle.abort();
  }, [createJob]);

  const title = activeView === 'Overview' ? 'Good morning, Alex' : activeView;
  const subtitle = activeView === 'Overview' ? "Here’s what’s happening with Summit Services." : `${activeView} for the Summit Services workspace.`;

  return (
    <div className="app-shell">
      <Sidebar active={activeView} onChange={setActiveView} mobileOpen={mobileNav} onClose={() => setMobileNav(false)} />
      {mobileNav ? <button type="button" className="sidebar-backdrop" onClick={() => setMobileNav(false)} aria-label="Close navigation" /> : null}
      <div className="app-column">
        <Header onMenu={() => setMobileNav(true)} query={query} setQuery={setQuery} />
        <main className="app-content" id="overview">
          <div className="page-heading">
            <div><h1>{title}</h1><p>{subtitle}</p>{query ? <output className="search-feedback">{resultCount} workspace result{resultCount === 1 ? '' : 's'} for “{query}”</output> : null}</div>
            <div className="heading-actions"><button type="button" className="date-button" onClick={() => setDateRange((current) => current.startsWith('May') ? 'Last 30 days' : 'May 12 – May 18, 2025')}><CalendarDays />{dateRange}<ChevronDown /></button><NewJobDialog onCreate={createJob} /></div>
          </div>
          {activeView === 'Overview' ? <Overview jobs={jobs} /> : <DataView view={activeView} jobs={jobs} />}
        </main>
      </div>
      <output className={`toast-message ${notice ? 'toast-message--visible' : ''}`} aria-live="polite"><Check />{notice}</output>
    </div>
  );
}
