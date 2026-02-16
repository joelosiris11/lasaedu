/**
 * Tipos para estándares e-learning: SCORM, xAPI, LTI
 */

// =============================================
// SCORM TYPES
// =============================================

export type SCORMVersion = '1.2' | '2004';

export interface SCORMPackage {
  id: string;
  courseId: string;
  lessonId: string;
  version: SCORMVersion;
  title: string;
  storageBasePath: string;
  launchUrl: string;
  manifest: SCORMManifest;
  packageSize: number;
  uploadedBy: string;
  uploadedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface SCORMManifest {
  identifier: string;
  version?: string;
  organizations: SCORMOrganization[];
  defaultOrganization: string;
  resources: SCORMResource[];
  metadata?: {
    schema?: string;
    schemaVersion?: string;
    title?: string;
    description?: string;
  };
}

export interface SCORMOrganization {
  identifier: string;
  title: string;
  items: SCORMItem[];
}

export interface SCORMItem {
  identifier: string;
  title: string;
  resourceIdentifier?: string;
  children: SCORMItem[];
  sequencing?: {
    controlMode?: {
      choice?: boolean;
      flow?: boolean;
    };
    completionThreshold?: number;
  };
}

export interface SCORMResource {
  identifier: string;
  type: string;
  href?: string;
  scormType?: 'sco' | 'asset';
  files: string[];
  dependencies?: string[];
}

export interface SCORMRuntimeData {
  id: string;
  userId: string;
  packageId: string;
  lessonId: string;
  courseId: string;
  version: SCORMVersion;
  cmiData: Record<string, string>;
  sessionTime: number;
  totalTime: number;
  completionStatus: SCORMCompletionStatus;
  successStatus?: 'passed' | 'failed' | 'unknown';
  scoreRaw?: number;
  scoreMin?: number;
  scoreMax?: number;
  scoreScaled?: number;
  suspendData?: string;
  location?: string;
  attemptCount: number;
  firstAccessedAt: number;
  lastAccessedAt: number;
  createdAt: number;
  updatedAt: number;
}

export type SCORMCompletionStatus =
  | 'not attempted'
  | 'incomplete'
  | 'completed'
  | 'browsed'
  | 'unknown';

export interface SCORMError {
  code: number;
  message: string;
  diagnostic: string;
}

// =============================================
// xAPI TYPES
// =============================================

export interface XAPIStatement {
  id: string;
  actor: XAPIActor;
  verb: XAPIVerb;
  object: XAPIObject;
  result?: XAPIResult;
  context?: XAPIContext;
  timestamp: string;
  stored?: string;
  authority?: XAPIActor;
}

export interface XAPIActor {
  objectType?: 'Agent' | 'Group';
  name?: string;
  mbox?: string;
  mbox_sha1sum?: string;
  account?: {
    homePage: string;
    name: string;
  };
}

export interface XAPIVerb {
  id: string;
  display: Record<string, string>;
}

export interface XAPIObject {
  objectType?: 'Activity' | 'Agent' | 'SubStatement' | 'StatementRef';
  id: string;
  definition?: XAPIActivityDefinition;
}

export interface XAPIActivityDefinition {
  name?: Record<string, string>;
  description?: Record<string, string>;
  type?: string;
  moreInfo?: string;
  interactionType?: string;
  correctResponsesPattern?: string[];
  extensions?: Record<string, unknown>;
}

export interface XAPIResult {
  score?: {
    scaled?: number;
    raw?: number;
    min?: number;
    max?: number;
  };
  success?: boolean;
  completion?: boolean;
  response?: string;
  duration?: string;
  extensions?: Record<string, unknown>;
}

export interface XAPIContext {
  registration?: string;
  instructor?: XAPIActor;
  team?: XAPIActor;
  contextActivities?: {
    parent?: XAPIObject[];
    grouping?: XAPIObject[];
    category?: XAPIObject[];
    other?: XAPIObject[];
  };
  revision?: string;
  platform?: string;
  language?: string;
  statement?: { objectType: 'StatementRef'; id: string };
  extensions?: Record<string, unknown>;
}

export interface LRSConfig {
  id: string;
  name: string;
  endpoint: string;
  authType: 'basic' | 'oauth';
  username?: string;
  password?: string;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}

// =============================================
// LTI TYPES
// =============================================

export interface LTIToolConfig {
  id: string;
  name: string;
  description?: string;
  launchUrl: string;
  consumerKey: string;
  consumerSecret: string;
  customParameters?: Record<string, string>;
  iconUrl?: string;
  supportsOutcomes: boolean;
  version: '1.1' | '1.3';
  privacyLevel: 'public' | 'name_only' | 'email_only' | 'anonymous';
  isActive: boolean;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface LTILaunchParams {
  lti_message_type: 'basic-lti-launch-request';
  lti_version: 'LTI-1p0';
  resource_link_id: string;
  user_id?: string;
  lis_person_name_full?: string;
  lis_person_name_given?: string;
  lis_person_name_family?: string;
  lis_person_contact_email_primary?: string;
  roles: string;
  context_id?: string;
  context_title?: string;
  context_label?: string;
  tool_consumer_instance_guid: string;
  tool_consumer_instance_name: string;
  tool_consumer_info_product_family_code: string;
  tool_consumer_info_version: string;
  lis_outcome_service_url?: string;
  lis_result_sourcedid?: string;
  oauth_consumer_key: string;
  oauth_signature_method: string;
  oauth_timestamp: string;
  oauth_nonce: string;
  oauth_version: string;
  oauth_signature?: string;
  [key: string]: string | undefined;
}

export interface LTILaunchRecord {
  id: string;
  toolId: string;
  userId: string;
  courseId: string;
  lessonId?: string;
  launchedAt: number;
  gradeReceived?: number;
  gradeReceivedAt?: number;
  status: 'launched' | 'completed' | 'error';
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}
