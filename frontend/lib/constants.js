/**
 * Application Constants
 */

export const ELECTION_STATUS = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  CLOSED: 'closed',
};

export const USER_ROLES = {
  STUDENT: 'student',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

export const VOTE_PAGE_STATES = {
  NOT_LOADED: 'NOT_LOADED',
  LOADING: 'LOADING',
  VOTING: 'VOTING',
  CONFIRMING: 'CONFIRMING',
  VOTED: 'VOTED',
  RESULTS: 'RESULTS',
  CLOSED_NO_VOTE: 'CLOSED_NO_VOTE',
  ERROR: 'ERROR',
};

export const OTP_LENGTH = 6;
export const OTP_EXPIRY_SECONDS = 600; // 10 minutes (must match backend Redis TTL)
export const OTP_RESEND_COOLDOWN = 60; // 1 minute

export const STATUS_COLORS = {
  draft: 'yellow',
  active: 'green',
  closed: 'gray',
};

export const STATUS_LABELS = {
  draft: 'Draft',
  active: 'Open for Voting',
  closed: 'Closed',
};
