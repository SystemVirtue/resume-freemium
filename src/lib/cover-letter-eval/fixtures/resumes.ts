import { ResumeData } from '@/types/resume';

export interface EvalResume {
  id: string;
  label: string;
  resume: ResumeData;
}

const baseBasics = (over: Partial<ResumeData['basics']> = {}): ResumeData['basics'] => ({
  name: '', email: '', phone: '', website: '', linkedin: '', summary: '',
  location: { address: '', city: '', state: '', country: '', postalCode: '' },
  ...over,
});

const work = (
  id: string, company: string, position: string, startDate: string, endDate: string,
  summary: string, highlights: string[], isCurrentRole = false,
): ResumeData['work'][number] => ({ id, company, position, website: '', startDate, endDate, isCurrentRole, summary, highlights });

export const EVAL_RESUMES: EvalResume[] = [
  {
    id: 'res-graduate',
    label: 'Graduate admin assistant',
    resume: {
      basics: baseBasics({
        name: 'Priya Nair', email: 'priya.nair@example.com', phone: '+44 7700 900123',
        location: { address: '', city: 'Manchester', state: '', country: 'UK', postalCode: '' },
        summary: 'Recent psychology graduate seeking a first role in people operations.',
      }),
      work: [
        work('w1', 'Bright Minds Tutoring', ' Tutor', '2023-06-01', '2024-08-31',
          'Tutored GCSE students in maths and English.',
          ['Planned sessions for 12 students a week', 'Raised two students from grade 4 to grade 7']),
        work('w2', 'Fern & Co Cafe', 'Barista', '2022-01-01', '2023-05-31',
          'Weekend barista in a busy cafe.',
          ['Trained 4 new staff on the till and coffee machine', 'Handled cash reconciliation for 30 shifts']),
      ],
      education: [
        { id: 'e1', institution: 'University of Manchester', url: '', area: 'Psychology', studyType: 'BSc', startDate: '2020-09-01', endDate: '2023-07-01', score: '2:1', courses: ['Research methods', 'Organisational psychology'] },
      ],
      skills: [
        { id: 's1', name: 'Microsoft Excel', level: '', keywords: [] },
        { id: 's2', name: 'Customer service', level: '', keywords: [] },
        { id: 's3', name: 'Safeguarding training', level: '', keywords: [] },
      ],
      projects: [], volunteer: [], awards: [], certifications: [
        { id: 'c1', name: 'Safeguarding Level 2', issuer: 'NSPCC', date: '2023-03-01', url: '' },
      ],
      interests: [], languages: [{ id: 'l1', language: 'English', fluency: 'Native' }, { id: 'l2', language: 'Malayalam', fluency: 'Conversational' }],
    },
  },
  {
    id: 'res-mid-tech',
    label: 'Mid-level backend engineer',
    resume: {
      basics: baseBasics({
        name: 'Daniel Okafor', email: 'd.okafor@example.com', phone: '+61 400 111 222',
        location: { address: '', city: 'Melbourne', state: 'VIC', country: 'Australia', postalCode: '' },
        summary: 'Backend engineer, six years, mostly Python and event-driven systems.',
      }),
      work: [
        work('w1', 'Kestrel Freight', 'Senior Backend Engineer', '2022-03-01', '',
          'Owned the dispatch and tracking services at a national freight company.',
          ['Cut p99 dispatch API latency from 900ms to 240ms by moving hot paths off the ORM',
           'Designed the event schema handling 2.1M shipment events a day',
           'Mentored two graduates; both confirmed mid-level within a year'], true),
        work('w2', 'Cobalt Health', 'Backend Engineer', '2019-02-01', '2022-02-28',
          'Built patient-record integrations for 14 clinics.',
          ['Wrote the HL7 ingestion pipeline used by every clinic', 'Introduced contract tests that cut integration incidents by 40%']),
        work('w3', 'Jotter', 'Graduate Developer', '2017-12-01', '2019-01-31',
          'Full-stack work on a note-taking app with 200k users.',
          ['Shipped the offline sync feature used by 30k users']),
      ],
      education: [
        { id: 'e1', institution: 'RMIT', url: '', area: 'Computer Science', studyType: 'BSc', startDate: '2014-02-01', endDate: '2017-11-30', score: '', courses: [] },
      ],
      skills: [
        { id: 's1', name: 'Python', level: 'Expert', keywords: ['FastAPI', 'asyncio'] },
        { id: 's2', name: 'PostgreSQL', level: 'Advanced', keywords: [] },
        { id: 's3', name: 'Kafka', level: 'Advanced', keywords: [] },
        { id: 's4', name: 'Kubernetes', level: 'Intermediate', keywords: [] },
      ],
      projects: [], volunteer: [], awards: [], certifications: [], interests: [], languages: [],
    },
  },
  {
    id: 'res-senior-marketing',
    label: 'Senior content marketing manager',
    resume: {
      basics: baseBasics({
        name: 'Helen Marsh', email: 'helen.marsh@example.com', phone: '+44 7700 900456',
        location: { address: '', city: 'Bristol', state: '', country: 'UK', postalCode: '' },
        summary: 'Content marketing lead for B2B software, twelve years, team of five.',
      }),
      work: [
        work('w1', 'Ledgerly', 'Head of Content', '2021-01-01', '',
          'Led content for an accounting software scale-up, team of five.',
          ['Grew organic signups from 800 to 3,100 a month in two years',
           'Launched the annual benchmark report, covered by the FT and three trade press outlets',
           'Built the editorial calendar shared by product marketing and comms'], true),
        work('w2', 'Northbeam Media', 'Senior Content Manager', '2016-05-01', '2020-12-31',
          'Ran content for two client accounts in fintech and logistics.',
          ['Produced 40+ whitepapers', 'Won the 2019 B2B Marketing Award for best content series']),
        work('w3', 'Cadence Publishing', 'Staff Writer', '2012-07-01', '2016-04-30',
          'Trade journalism for logistics titles.',
          ['Broke the port-automation story syndicated to four outlets']),
      ],
      education: [
        { id: 'e1', institution: 'Cardiff University', url: '', area: 'Journalism', studyType: 'BA', startDate: '2008-09-01', endDate: '2011-06-30', score: '', courses: [] },
      ],
      skills: [
        { id: 's1', name: 'Editorial strategy', level: '', keywords: [] },
        { id: 's2', name: 'SEO', level: 'Advanced', keywords: [] },
        { id: 's3', name: 'Team leadership', level: '', keywords: [] },
      ],
      projects: [], volunteer: [], awards: [
        { id: 'a1', title: 'B2B Marketing Award, best content series', date: '2019-06-01', awarder: 'B2B Marketing', summary: '' },
      ], certifications: [], interests: [], languages: [],
    },
  },
  {
    id: 'res-career-changer',
    label: 'Career changer: retail to UX',
    resume: {
      basics: baseBasics({
        name: 'Tom Aldridge', email: 'tom.aldridge@example.com', phone: '+1 415 555 0134',
        location: { address: '', city: 'Oakland', state: 'CA', country: 'USA', postalCode: '' },
        summary: 'Retail manager moving into UX research; completed a part-time HCI certificate.',
      }),
      work: [
        work('w1', 'Hearth & Home Goods', 'Store Manager', '2018-04-01', '',
          'Managed a 9-person store with $2.4M annual revenue.',
          ['Ran monthly in-store usability walk-throughs that informed 14 layout changes',
           'Cut queue times 35% by redesigning the checkout flow',
           'Hired and trained 11 staff'], true),
        work('w2', 'Harbor Research LLC', 'Research Assistant (part-time)', '2023-09-01', '2024-06-30',
          'Part-time support on consumer research projects.',
          ['Moderated 18 customer interviews', 'Built the coding sheet used across three projects']),
      ],
      education: [
        { id: 'e1', institution: 'UC Berkeley Extension', url: '', area: 'Human-Computer Interaction', studyType: 'Certificate', startDate: '2023-01-01', endDate: '2023-12-15', score: '', courses: [] },
      ],
      skills: [
        { id: 's1', name: 'User interviews', level: '', keywords: [] },
        { id: 's2', name: 'Figma', level: 'Intermediate', keywords: [] },
        { id: 's3', name: 'Retail operations', level: 'Expert', keywords: [] },
      ],
      projects: [
        { id: 'p1', name: 'Checkout redesign portfolio study', description: 'Unmoderated study of 12 shoppers on two checkout prototypes.', highlights: ['Report led to a recommended prototype adopted in the mock brief'], keywords: ['usability testing'], startDate: '2024-01-01', endDate: '2024-03-01', url: '', roles: [], entity: '', type: '' },
      ],
      volunteer: [], awards: [], certifications: [], interests: [], languages: [],
    },
  },
  {
    id: 'res-healthcare',
    label: 'Nurse unit manager',
    resume: {
      basics: baseBasics({
        name: 'Marguerite Fahey', email: 'm.fahey@example.com', phone: '+353 85 555 0192',
        location: { address: '', city: 'Galway', state: '', country: 'Ireland', postalCode: '' },
        summary: 'Registered nurse, 15 years, theatre and ward management.',
      }),
      work: [
        work('w1', 'University Hospital Galway', 'Clinical Nurse Manager II', '2018-06-01', '',
          'Managed rosters and clinical governance for a 28-bed surgical ward.',
          ['Held agency spend 22% under budget across two winters',
           'Introduced the admission checklist now standard on four wards',
           'Managed a team of 31 nurses and healthcare assistants'], true),
        work('w2', 'Bon Secours Hospital', 'Staff Nurse', '2011-01-01', '2018-05-31',
          'Theatre scrub nurse across orthopaedic and general lists.',
          ['Preceptored 9 student nurses']),
      ],
      education: [
        { id: 'e1', institution: 'NUI Galway', url: '', area: 'Nursing', studyType: 'BSc', startDate: '2006-09-01', endDate: '2010-06-30', score: '', courses: [] },
        { id: 'e2', institution: 'RCSI', url: '', area: 'Clinical Leadership', studyType: 'MSc', startDate: '2020-09-01', endDate: '2022-09-01', score: '', courses: [] },
      ],
      skills: [
        { id: 's1', name: 'Rostering', level: '', keywords: [] },
        { id: 's2', name: 'Clinical governance', level: '', keywords: [] },
      ],
      projects: [], volunteer: [], awards: [], certifications: [
        { id: 'c1', name: 'NMBI Registration', issuer: 'NMBI', date: '2010-09-01', url: '' },
      ], interests: [], languages: [{ id: 'l1', language: 'English', fluency: 'Native' }, { id: 'l2', language: 'Irish', fluency: 'Conversational' }],
    },
  },
  {
    id: 'res-trades',
    label: 'Electrician (US spelling source)',
    resume: {
      basics: baseBasics({
        name: 'Carl Jensen', email: 'carl.jensen@example.com', phone: '+1 206 555 0177',
        location: { address: '', city: 'Tacoma', state: 'WA', country: 'USA', postalCode: '' },
        summary: 'Licensed electrician, nine years, residential and light commercial. Organized crews of up to six. Authorized to work in the US.',
      }),
      work: [
        work('w1', 'Puget Sound Electric', 'Journeyman Electrician', '2019-02-01', '',
          'Residential and light commercial installs.',
          ['Programmed and commissioned controls for 40+ multi-unit projects',
           'Led a 6-person crew on a 90-unit apartment fit-out, finished two weeks early'], true),
        work('w2', 'Cascade Wire', 'Apprentice', '2015-06-01', '2019-01-31',
          'Apprenticeship across service calls and new builds.',
          ['Loganized 3,000 hours of documented apprenticeship work']),
      ],
      education: [
        { id: 'e1', institution: 'Bates Technical College', url: '', area: 'Electrical Construction', studyType: 'Certificate', startDate: '2014-09-01', endDate: '2015-06-01', score: '', courses: [] },
      ],
      skills: [
        { id: 's1', name: 'WA L&I Journeyman license', level: '', keywords: [] },
        { id: 's2', name: 'Blueprint reading', level: '', keywords: [] },
      ],
      projects: [], volunteer: [], awards: [], certifications: [
        { id: 'c1', name: 'WA Journeyman Electrician License', issuer: 'Washington L&I', date: '2019-02-01', url: '' },
      ], interests: [], languages: [],
    },
  },
];
