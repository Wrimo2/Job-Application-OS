export type ID = string;
/** ISO-8601 timestamp string */
export type ISODate = string;
export type Priority = 1 | 2 | 3;

/* ───────────────────────── Applications ───────────────────────── */

export type Stage =
  | 'wishlist'
  | 'applied'
  | 'screening'
  | 'assessment'
  | 'interviewing'
  | 'offer'
  | 'accepted'
  | 'rejected'
  | 'withdrawn'
  | 'ghosted';

export type WorkMode = 'remote' | 'hybrid' | 'onsite';
export type JobType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance';
export type ApplyMethod = 'easy_apply' | 'company_portal' | 'referral' | 'cold_email' | 'recruiter_inbound' | 'other';

export interface StageEvent {
  stage: Stage;
  at: ISODate;
  note?: string;
}

export interface Application {
  id: ID;
  company: string;
  role: string;
  url?: string;
  platform: string;
  method: ApplyMethod;
  location?: string;
  workMode?: WorkMode;
  jobType?: JobType;
  salaryMin?: number;
  salaryMax?: number;
  currency?: string;
  status: Stage;
  priority: Priority;
  /** 0–5 how excited you are */
  excitement?: number;
  appliedAt?: ISODate;
  postedAt?: ISODate;
  deadline?: ISODate;
  /** First time the company responded (any response, incl. rejection) */
  respondedAt?: ISODate;
  closedAt?: ISODate;
  resumeId?: ID;
  coverLetter?: boolean;
  referrerId?: ID;
  contactIds: ID[];
  jobDescription?: string;
  notes?: string;
  tags: string[];
  nextAction?: string;
  nextActionAt?: ISODate;
  rejectionReason?: string;
  /** The stage the application was in when it got rejected / ghosted / withdrawn */
  closedFromStage?: Stage;
  history: StageEvent[];
  archived?: boolean;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ───────────────────────── Interviews ───────────────────────── */

export type InterviewType =
  | 'phone_screen'
  | 'technical'
  | 'coding'
  | 'system_design'
  | 'take_home'
  | 'case'
  | 'behavioral'
  | 'hiring_manager'
  | 'panel'
  | 'onsite'
  | 'hr'
  | 'other';

export type InterviewMode = 'video' | 'phone' | 'onsite';
export type InterviewOutcome = 'scheduled' | 'awaiting' | 'passed' | 'failed' | 'cancelled';

export interface ChecklistItem {
  id: ID;
  text: string;
  done: boolean;
}

export interface Interview {
  id: ID;
  applicationId: ID;
  round: string;
  type: InterviewType;
  scheduledAt: ISODate;
  durationMins: number;
  mode: InterviewMode;
  /** Meeting link or address */
  location?: string;
  interviewers?: string;
  prepNotes?: string;
  questionsAsked?: string;
  reflection?: string;
  selfRating?: number;
  outcome: InterviewOutcome;
  thankYouSent?: boolean;
  checklist: ChecklistItem[];
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ───────────────────────── Network ───────────────────────── */

export type ContactStage =
  | 'target'
  | 'contacted'
  | 'replied'
  | 'engaged'
  | 'referred'
  | 'network'
  | 'no_response'
  | 'closed';

export type Relationship =
  | 'recruiter'
  | 'hiring_manager'
  | 'engineer'
  | 'employee'
  | 'alumni'
  | 'founder'
  | 'leader'
  | 'mentor'
  | 'friend'
  | 'other';

export type Warmth = 'cold' | 'warm' | 'hot';

export interface Contact {
  id: ID;
  name: string;
  title?: string;
  company?: string;
  relationship: Relationship;
  stage: ContactStage;
  warmth: Warmth;
  priority: Priority;
  linkedin?: string;
  email?: string;
  phone?: string;
  twitter?: string;
  website?: string;
  location?: string;
  /** Where/how you found them */
  source?: string;
  /** Personalization hooks */
  mutualConnection?: string;
  commonGround?: string;
  tags: string[];
  notes?: string;
  applicationIds: ID[];
  lastContactedAt?: ISODate;
  nextFollowUpAt?: ISODate;
  connectedOn?: ISODate;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type Channel = 'linkedin' | 'email' | 'twitter' | 'whatsapp' | 'phone' | 'naukri' | 'in_person' | 'other';

export type InteractionKind =
  | 'connection_request'
  | 'message'
  | 'inmail'
  | 'email'
  | 'follow_up'
  | 'referral_request'
  | 'call'
  | 'meeting'
  | 'comment'
  | 'thank_you'
  | 'reply'
  | 'note';

export type InteractionOutcome = 'awaiting' | 'replied' | 'positive' | 'negative' | 'no_reply' | 'accepted';

export interface Interaction {
  id: ID;
  contactId?: ID;
  applicationId?: ID;
  date: ISODate;
  channel: Channel;
  kind: InteractionKind;
  direction: 'out' | 'in';
  templateId?: ID;
  enrollmentId?: ID;
  stepIndex?: number;
  subject?: string;
  content?: string;
  outcome: InteractionOutcome;
  repliedAt?: ISODate;
  isSample?: boolean;
  createdAt: ISODate;
}

/* ───────────────────────── Outreach engine ───────────────────────── */

export type TemplateCategory =
  | 'connection_note'
  | 'linkedin_message'
  | 'referral'
  | 'cold_email'
  | 'recruiter'
  | 'follow_up'
  | 'thank_you'
  | 'networking'
  | 'negotiation'
  | 'other';

export interface Template {
  id: ID;
  name: string;
  category: TemplateCategory;
  channel: Channel;
  subject?: string;
  body: string;
  favorite?: boolean;
  builtIn?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface SequenceStep {
  id: ID;
  /** Day offset from the start of the sequence */
  day: number;
  channel: Channel;
  kind: InteractionKind;
  title: string;
  templateId?: ID;
}

export interface Sequence {
  id: ID;
  name: string;
  description?: string;
  steps: SequenceStep[];
  builtIn?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type EnrollmentStatus = 'active' | 'paused' | 'completed' | 'replied' | 'stopped';

export interface Enrollment {
  id: ID;
  sequenceId: ID;
  contactId: ID;
  applicationId?: ID;
  status: EnrollmentStatus;
  /** Index of the next step to perform */
  stepIndex: number;
  startedAt: ISODate;
  nextDueAt?: ISODate;
  lastStepAt?: ISODate;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ───────────────────────── Productivity ───────────────────────── */

export interface Task {
  id: ID;
  title: string;
  notes?: string;
  dueAt?: ISODate;
  done: boolean;
  doneAt?: ISODate;
  priority: Priority;
  applicationId?: ID;
  contactId?: ID;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type CompanyTier = 'dream' | 'target' | 'backup' | 'none';

export interface Company {
  id: ID;
  name: string;
  website?: string;
  careersUrl?: string;
  linkedin?: string;
  industry?: string;
  size?: string;
  location?: string;
  tier: CompanyTier;
  rating?: number;
  notes?: string;
  tags: string[];
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type DocKind = 'resume' | 'cover_letter' | 'portfolio' | 'other';

export interface DocumentFile {
  id: ID;
  name: string;
  kind: DocKind;
  targetRole?: string;
  notes?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  blob?: Blob;
  link?: string;
  isDefault?: boolean;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface Snippet {
  id: ID;
  title: string;
  body: string;
  category?: string;
  uses?: number;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface StarStory {
  id: ID;
  title: string;
  competencies: string[];
  situation: string;
  task: string;
  action: string;
  result: string;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type QuestionCategory = 'behavioral' | 'technical' | 'system_design' | 'hr' | 'company' | 'other';

export interface Question {
  id: ID;
  text: string;
  category: QuestionCategory;
  company?: string;
  applicationId?: ID;
  answer?: string;
  /** 1–5 */
  confidence: number;
  storyId?: ID;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type OfferFactor = 'growth' | 'culture' | 'wlb' | 'learning' | 'stability' | 'brand';
export type OfferStatus = 'pending' | 'negotiating' | 'accepted' | 'declined';

export interface Offer {
  id: ID;
  applicationId?: ID;
  company: string;
  role: string;
  currency: string;
  base: number;
  bonus: number;
  /** Equity value per year */
  equity: number;
  joiningBonus: number;
  /** Yearly value of other benefits (insurance, allowances…) */
  benefits: number;
  location?: string;
  workMode?: WorkMode;
  deadline?: ISODate;
  startDate?: ISODate;
  status: OfferStatus;
  ratings: Record<OfferFactor, number>;
  notes?: string;
  isSample?: boolean;
  createdAt: ISODate;
  updatedAt: ISODate;
}

/* ───────────────────────── Settings ───────────────────────── */

export type ThemePref = 'system' | 'light' | 'dark';
export type AccentKey = 'indigo' | 'violet' | 'blue' | 'emerald' | 'rose' | 'orange';

export interface Profile {
  name: string;
  headline: string;
  currentRole: string;
  currentCompany: string;
  experienceYears?: number;
  skills: string[];
  targetRoles: string[];
  targetLocations: string[];
  linkedin: string;
  github: string;
  portfolio: string;
  email: string;
  phone: string;
  school: string;
  pitch: string;
  achievement: string;
  noticePeriod: string;
  currentCtc: string;
  expectedCtc: string;
  /** Plain-text resume used for JD keyword matching */
  resumeText: string;
}

export interface Goals {
  applicationsPerWeek: number;
  outreachPerWeek: number;
  dailyOutreach: number;
}

export interface Settings {
  profile: Profile;
  goals: Goals;
  followUpDays: number;
  ghostDays: number;
  staleWishlistDays: number;
  currency: string;
  theme: ThemePref;
  accent: AccentKey;
  showLogos: boolean;
  notifications: boolean;
  customPlatforms: string[];
  onboarded: boolean;
  weekStartsOn: 0 | 1;
  sampleLoaded?: boolean;
  lastBackupAt?: ISODate;
}

export interface KV {
  key: string;
  value: unknown;
}
