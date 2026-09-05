export type JobStatus = 'Scheduled' | 'En route' | 'In progress' | 'Completed';

export type Job = {
  id: string;
  time: string;
  title: string;
  customer: string;
  city: string;
  technician: string;
  priority: 'Low' | 'Medium' | 'High';
  status: JobStatus;
};

export const revenueData = [
  { day: 'Mon 12', revenue: 6400, target: 6800 },
  { day: 'Tue 13', revenue: 8200, target: 9000 },
  { day: 'Wed 14', revenue: 11100, target: 12600 },
  { day: 'Thu 15', revenue: 13900, target: 15800 },
  { day: 'Fri 16', revenue: 18400, target: 19100 },
  { day: 'Sat 17', revenue: 21700, target: 22100 },
  { day: 'Sun 18', revenue: 23800, target: 24100 },
];

export const initialJobs: Job[] = [
  {
    id: 'J-2048',
    time: '10:00 AM',
    title: 'Furnace tune-up',
    customer: 'Sarah Johnson',
    city: 'Oak Park',
    technician: 'James Diaz',
    priority: 'Medium',
    status: 'Scheduled',
  },
  {
    id: 'J-2050',
    time: '11:30 AM',
    title: 'AC repair',
    customer: 'Northline Dental',
    city: 'Evanston',
    technician: 'Amanda Lee',
    priority: 'High',
    status: 'Scheduled',
  },
  {
    id: 'J-2043',
    time: 'ETA 9:15',
    title: 'Leak inspection',
    customer: 'David Ruiz',
    city: 'Lincoln Park',
    technician: 'Mike Wallace',
    priority: 'Medium',
    status: 'En route',
  },
  {
    id: 'J-2045',
    time: 'ETA 9:47',
    title: 'Water heater install',
    customer: 'Priya Shah',
    city: 'Skokie',
    technician: 'Priya Rao',
    priority: 'High',
    status: 'En route',
  },
  {
    id: 'J-2041',
    time: '8:30 AM',
    title: 'Panel upgrade',
    customer: 'Ridgeway Offices',
    city: 'Chicago',
    technician: 'Amanda Lee',
    priority: 'High',
    status: 'In progress',
  },
  {
    id: 'J-2044',
    time: '9:40 AM',
    title: 'Drain cleaning',
    customer: 'James Wilson',
    city: 'Berwyn',
    technician: 'Sam Cooper',
    priority: 'Medium',
    status: 'In progress',
  },
  {
    id: 'J-2036',
    time: '7:45 AM',
    title: 'Outlet installation',
    customer: 'Mark Davis',
    city: 'Naperville',
    technician: 'James Diaz',
    priority: 'Low',
    status: 'Completed',
  },
  {
    id: 'J-2037',
    time: '8:10 AM',
    title: 'AC maintenance',
    customer: 'Lisa Gomez',
    city: 'Chicago',
    technician: 'Mike Wallace',
    priority: 'Low',
    status: 'Completed',
  },
];

export const technicians = [
  {
    initials: 'JD',
    name: 'James Diaz',
    role: 'HVAC technician',
    status: 'In the field',
    load: '2 / 4 jobs',
  },
  {
    initials: 'AL',
    name: 'Amanda Lee',
    role: 'Electrical technician',
    status: 'In the field',
    load: '2 / 4 jobs',
  },
  {
    initials: 'MW',
    name: 'Mike Wallace',
    role: 'HVAC technician',
    status: 'Available',
    load: '0 / 3 jobs',
  },
  {
    initials: 'PR',
    name: 'Priya Rao',
    role: 'Plumbing technician',
    status: 'On break',
    load: '0 / 2 jobs',
  },
  {
    initials: 'SC',
    name: 'Sam Cooper',
    role: 'Cleaning technician',
    status: 'Off today',
    load: '—',
  },
];

export const customers = [
  {
    name: 'Northline Dental',
    contact: 'Maya Brooks',
    city: 'Evanston',
    jobs: 14,
    value: '$28,460',
    lastService: 'May 14, 2025',
  },
  {
    name: 'Ridgeway Offices',
    contact: 'Owen Parker',
    city: 'Chicago',
    jobs: 9,
    value: '$21,180',
    lastService: 'May 12, 2025',
  },
  {
    name: 'Greenleaf Properties',
    contact: 'Ava Thompson',
    city: 'Oak Park',
    jobs: 18,
    value: '$35,920',
    lastService: 'May 10, 2025',
  },
  {
    name: 'David Ruiz',
    contact: 'David Ruiz',
    city: 'Lincoln Park',
    jobs: 4,
    value: '$4,850',
    lastService: 'May 8, 2025',
  },
  {
    name: 'Summit Homes',
    contact: 'Noah Mitchell',
    city: 'Skokie',
    jobs: 7,
    value: '$12,300',
    lastService: 'May 6, 2025',
  },
];

export const invoices = [
  {
    id: 'INV-10432',
    customer: 'Acme Properties',
    issued: 'May 12',
    due: 'May 26',
    amount: '$2,450',
    status: 'Paid',
  },
  {
    id: 'INV-10431',
    customer: 'Northline Dental',
    issued: 'May 11',
    due: 'May 25',
    amount: '$3,820',
    status: 'Open',
  },
  {
    id: 'INV-10427',
    customer: 'Greenleaf Properties',
    issued: 'Apr 24',
    due: 'May 8',
    amount: '$5,640',
    status: 'Overdue',
  },
  {
    id: 'INV-10424',
    customer: 'Ridgeway Offices',
    issued: 'Apr 20',
    due: 'May 4',
    amount: '$2,930',
    status: 'Overdue',
  },
];
