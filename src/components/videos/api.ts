import type { FilterCounts, Project, ProjectFilter } from "@/lib/projects/types";

/** Tiny browser client for /api/projects. Throws `{ code, message }` from the API's error body. */
async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json" } : undefined,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw body?.error ?? { code: "INTERNAL", message: "Something went wrong." };
  return body as T;
}

export type ListPage = { items: Project[]; nextCursor: string | null };

export const projectsApi = {
  list(filter: ProjectFilter, q: string, cursor?: string | null) {
    const params = new URLSearchParams({ filter });
    if (q) params.set("q", q);
    if (cursor) params.set("cursor", cursor);
    return call<ListPage>(`/api/projects?${params}`);
  },
  counts: () => call<FilterCounts>("/api/projects/counts"),
  create: () => call<Project>("/api/projects", { method: "POST" }),
  rename: (p: Project, title: string) =>
    call<Project>(`/api/projects/${p.id}`, { method: "PATCH", body: JSON.stringify({ rev: p.rev, title }) }),
  remove: (id: string) => call<{ deletedAt: string }>(`/api/projects/${id}`, { method: "DELETE" }),
  restore: (id: string) => call<Project>(`/api/projects/${id}/restore`, { method: "POST" }),
  duplicate: (id: string) => call<Project>(`/api/projects/${id}/duplicate`, { method: "POST" }),
};
