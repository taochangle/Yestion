export const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export type User = {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type AuthResponse = {
  user: User;
  token: string;
};

export type FileInfo = {
  name: string;
  url: string;
  contentType: string;
  size: number;
};

export type Workspace = {
  id: string;
  name: string;
  icon: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: "owner" | "admin" | "member" | "guest";
  createdAt: string;
  user?: User;
};

export type Block = {
  id: string;
  parentId: string | null;
  workspaceId: string;
  type: string;
  properties: {
    title?: string;
    [key: string]: unknown;
  };
  content: string[];
  position: number;
  version: number;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
};

export type BlockNode = Block & {
  children: BlockNode[];
};

export type BreadcrumbItem = {
  id: string;
  title: string;
};

export type DatabasePropertyType =
  | "text"
  | "number"
  | "select"
  | "date"
  | "checkbox";

export type DatabaseSelectOption = {
  id: string;
  name: string;
  color: string;
};

export type DatabaseProperty = {
  id: string;
  name: string;
  type: DatabasePropertyType;
  options?: DatabaseSelectOption[];
};

export type DatabaseSort = {
  propertyId: string;
  direction: "asc" | "desc";
};

export type DatabaseFilter = {
  propertyId: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "greater_than"
    | "less_than"
    | "is_empty"
    | "is_not_empty";
  value: unknown;
};

export type DatabaseView = {
  id: string;
  name: string;
  type: "table";
  sort?: DatabaseSort;
  filters: DatabaseFilter[];
};

export type Database = {
  id: string;
  blockId: string;
  workspaceId: string;
  name: string;
  propertiesSchema: DatabaseProperty[];
  views: DatabaseView[];
  createdAt: string;
  updatedAt: string;
};

export type DatabaseRow = {
  id: string;
  databaseId: string;
  pageId: string;
  properties: Record<string, unknown>;
  position: number;
  createdAt: string;
  updatedAt: string;
};

export type SearchResult = {
  blockId: string;
  workspaceId: string;
  title: string;
  type: string;
  snippet: string;
};

export type Share = {
  id: string;
  blockId: string;
  token: string;
  permission: "read" | "comment" | "edit";
  expiresAt: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type Template = {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  blockType: string;
  properties: Record<string, unknown>;
  content: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type Revision = {
  id: string;
  blockId: string;
  snapshot: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};

export type ChatConversationRecord = {
  id: string;
  workspaceId: string;
  title: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRecord = {
  id: string;
  conversationId: string;
  role: "user" | "assistant";
  content: string;
  reasoning: string;
  createdAt: string;
};

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));

  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : null;
}

export function setAuthCookie(token: string) {
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; SameSite=Lax`;
}

export function clearAuthCookie() {
  document.cookie =
    "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax";
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const token = getCookie("auth_token");
  const headers = new Headers(init.headers);

  if (!headers.has("Content-Type") && init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
