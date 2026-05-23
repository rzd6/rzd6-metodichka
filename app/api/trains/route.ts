import { NextRequest, NextResponse } from "next/server"
import { Pool } from "pg"

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"

let pool: Pool | null = null

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.POSTGRES_URL_NON_POOLING })
  }
  return pool
}

async function ensureTables() {
  const db = getPool()
  await db.query(`
    CREATE TABLE IF NOT EXISTS trains (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      train_number INTEGER UNIQUE NOT NULL,
      direction TEXT NOT NULL,
      class TEXT NOT NULL DEFAULT 'Скоростной',
      depart_start TEXT,
      arrive_middle TEXT,
      depart_middle TEXT,
      arrive_end TEXT,
      platform_start INTEGER DEFAULT 1,
      platform_middle INTEGER DEFAULT 1,
      platform_end INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `)
}

// GET /api/trains  — list all trains
// GET /api/trains?id=UUID — single train
export async function GET(req: NextRequest) {
  try {
    await ensureTables()
    const db = getPool()
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")

    if (id) {
      const res = await db.query("SELECT * FROM trains WHERE id = $1", [id])
      return NextResponse.json({ data: res.rows[0] ?? null })
    }

    const res = await db.query("SELECT * FROM trains ORDER BY train_number ASC")
    return NextResponse.json({ data: res.rows })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// POST /api/trains — create train
export async function POST(req: NextRequest) {
  try {
    await ensureTables()
    const db = getPool()
    const body = await req.json()
    const {
      train_number, direction, class: trainClass,
      depart_start, arrive_middle, depart_middle, arrive_end,
      platform_start, platform_middle, platform_end,
    } = body

    const res = await db.query(
      `INSERT INTO trains
        (train_number, direction, class, depart_start, arrive_middle, depart_middle, arrive_end, platform_start, platform_middle, platform_end)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       ON CONFLICT (train_number) DO NOTHING
       RETURNING *`,
      [train_number, direction, trainClass ?? "Скоростной",
        depart_start ?? null, arrive_middle ?? null, depart_middle ?? null, arrive_end ?? null,
        platform_start ?? 1, platform_middle ?? 1, platform_end ?? 1]
    )
    return NextResponse.json({ data: res.rows[0] ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/trains — update train by id
export async function PATCH(req: NextRequest) {
  try {
    await ensureTables()
    const db = getPool()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })
    // rename "class" key to avoid reserved word issues in dynamic query
    if ("class" in updates) {
      updates["class"] = updates["class"]
    }
    const fields = Object.keys(updates)
    if (fields.length === 0) return NextResponse.json({ error: "No fields to update" }, { status: 400 })
    const setClauses = fields.map((f, i) => `"${f}" = $${i + 2}`).join(", ")
    const values = [id, ...fields.map((f) => updates[f])]
    const res = await db.query(
      `UPDATE trains SET ${setClauses} WHERE id = $1 RETURNING *`,
      values
    )
    return NextResponse.json({ data: res.rows[0] ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/trains — delete train by id
export async function DELETE(req: NextRequest) {
  try {
    await ensureTables()
    const db = getPool()
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 })
    await db.query("DELETE FROM trains WHERE id = $1", [body.id])
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
