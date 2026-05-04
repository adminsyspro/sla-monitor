import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const row = db.prepare("SELECT value FROM app_settings WHERE key = 'ldap_enabled'").get() as { value: string } | undefined;
  const ldapEnabled = row?.value === 'true';

  return NextResponse.json({
    local: true,
    ldap: ldapEnabled,
  });
}
