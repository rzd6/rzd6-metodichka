// All article operations are proxied through /api/articles to avoid
// direct browser→Supabase calls that would be blocked by the CSP.

export interface Article {
  id: string
  title: string
  content: string
  created_at: string
  updated_at: string
  is_published: boolean
  author_name: string
  author_id: string
  category?: string
  allowed_roles: string[]
  image_url?: string[]
}

async function apiFetch(path: string, options?: RequestInit) {
  const base = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000")
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers ?? {}) },
  })
  return res.json()
}

export async function getArticles(): Promise<Article[]> {
  const json = await apiFetch("/api/articles")
  if (json.error) throw new Error(json.error)
  return json.data || []
}

export async function createArticle(
  article: Omit<Article, "id" | "created_at" | "updated_at">,
): Promise<Article> {
  const json = await apiFetch("/api/articles", {
    method: "POST",
    body: JSON.stringify({ action: "create", article }),
  })
  if (json.error) throw new Error(json.error)
  return json.data
}

export async function updateArticle(id: string, updates: Partial<Article>): Promise<Article> {
  const json = await apiFetch("/api/articles", {
    method: "POST",
    body: JSON.stringify({ action: "update", id, updates }),
  })
  if (json.error) throw new Error(json.error)
  return json.data
}

export async function deleteArticle(id: string): Promise<void> {
  const json = await apiFetch("/api/articles", {
    method: "POST",
    body: JSON.stringify({ action: "delete", id }),
  })
  if (json.error) throw new Error(json.error)
}
