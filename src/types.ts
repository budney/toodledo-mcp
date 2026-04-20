// Toodledo API entity types

export interface ToodledoTask {
  id: number;
  title: string;
  modified: number;
  completed: number;
  folder: number;
  context: number;
  goal: number;
  location: number;
  tag: string;
  parent: number;
  children: number;
  order: number;
  duedate: number;
  duedatemod: number;
  startdate: number;
  duetime: number;
  starttime: number;
  remind: number;
  repeat: string;
  status: number;
  length: number;
  priority: number;
  star: number;
  added: number;
  timer: number;
  timeron: number;
  note: string;
  meta: string;
}

export interface ToodledoFolder {
  id: number;
  name: string;
  private: number;
  archived: number;
  ord: number;
}

export interface ToodledoContext {
  id: number;
  name: string;
  private: number;
}

export interface ToodledoGoal {
  id: number;
  name: string;
  level: number; // 0=lifetime, 1=long-term, 2=short-term
  archived: number;
  contributes: number; // parent goal id
  note: string;
}

export interface ToodledoLocation {
  id: number;
  name: string;
  description: string;
  lat: number;
  lon: number;
}

export interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix ms
  scope: string;
}

export interface ToodledoTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
  errorCode?: number;
  errorDesc?: string;
}

export interface ToodledoError {
  errorCode: number;
  errorDesc: string;
}

export interface ToodledoSearchRule {
  field: string;
  type: string;
  value: string;
}

export interface ToodledoSavedSearch {
  id: number;
  name: string;
  bool: "All" | "Any";
  search: Record<string, ToodledoSearchRule[]>;
}

// Status enum for human-readable mapping
export const STATUS_MAP: Record<number, string> = {
  0: "None",
  1: "Next Action",
  2: "Active",
  3: "Planning",
  4: "Delegated",
  5: "Waiting",
  6: "Hold",
  7: "Postponed",
  8: "Someday",
  9: "Canceled",
  10: "Reference",
};

export const STATUS_REVERSE: Record<string, number> = Object.fromEntries(
  Object.entries(STATUS_MAP).map(([k, v]) => [v.toLowerCase().replace(/ /g, "_"), Number(k)])
);

export const PRIORITY_MAP: Record<number, string> = {
  [-1]: "Negative",
  0: "Low",
  1: "Medium",
  2: "High",
  3: "Top",
};

export const PRIORITY_REVERSE: Record<string, number> = Object.fromEntries(
  Object.entries(PRIORITY_MAP).map(([k, v]) => [v.toLowerCase(), Number(k)])
);
