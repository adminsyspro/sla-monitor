import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getRetentionDays } from '@/lib/settings';

export async function GET(_request: NextRequest) {
  const db = getDb();
  return NextResponse.json({ retentionDays: getRetentionDays(db) });
}
