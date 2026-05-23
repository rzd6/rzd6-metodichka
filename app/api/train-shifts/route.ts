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
    CREATE TABLE IF NOT EXISTS train_shifts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      train_id UUID NOT NULL,
      train_number INTEGER NOT NULL,
      claimed_by_nickname TEXT NOT NULL,
      claimed_by_role TEXT NOT NULL,
      shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(train_number, shift_date)
    );
  `)
}

// GET /api/train-shifts?date=YYYY-MM-DD — all shifts for date (default today)
// GET /api/train-shifts?date=...&with_trains=1 — joined with train info
export async function GET(req: NextRequest) {
  try {
    await ensureTables()
    const db = getPool()
    const { searchParams } = new URL(req.url)
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10)
    const withTrains = searchParams.get("with_trains") === "1"

    if (withTrains) {
      const res = await db.query(
        `SELECT ts.*, t.direction, t.class, t.depart_start, t.arrive_middle,
                t.depart_middle, t.arrive_end, t.platform_start, t.platform_middle, t.platform_end
         FROM train_shifts ts
         JOIN trains t ON t.id = ts.train_id
         WHERE ts.shift_date = $1
         ORDER BY ts.train_number ASC`,
        [date]
      )
      return NextResponse.json({ data: res.rows }, { headers: corsHeaders() })
    }

    const res = await db.query(
      "SELECT * FROM train_shifts WHERE shift_date = $1 ORDER BY train_number ASC",
      [date]
    )
    return NextResponse.json({ data: res.rows }, { headers: corsHeaders() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders() })
  }
}

// POST /api/train-shifts — claim a shift
export async function POST(req: NextRequest) {
  try {
    await ensureTables()
    const db = getPool()
    const body = await req.json()
    const { train_id, train_number, claimed_by_nickname, claimed_by_role, shift_date } = body

    const date = shift_date || new Date().toISOString().slice(0, 10)

    const res = await db.query(
      `INSERT INTO train_shifts (train_id, train_number, claimed_by_nickname, claimed_by_role, shift_date)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (train_number, shift_date) DO NOTHING
       RETURNING *`,
      [train_id, train_number, claimed_by_nickname, claimed_by_role, date]
    )
    return NextResponse.json({ data: res.rows[0] ?? null })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/train-shifts — release a shift
export async function DELETE(req: NextRequest) {
  try {
    await ensureTables()
    const db = getPool()
    const body = await req.json()

    if (body.id) {
      await db.query("DELETE FROM train_shifts WHERE id = $1", [body.id])
    } else if (body.train_number && body.shift_date) {
      await db.query(
        "DELETE FROM train_shifts WHERE train_number = $1 AND shift_date = $2",
        [body.train_number, body.shift_date]
      )
    } else {
      return NextResponse.json({ error: "id or (train_number + shift_date) required" }, { status: 400 })
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500, headers: corsHeaders() })
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() })
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  }
}
