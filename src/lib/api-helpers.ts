import { NextRequest, NextResponse } from 'next/server';
import type { UserRole } from '@/lib/auth/session';

export function checkRole(request: NextRequest, ...allowedRoles: UserRole[]): { userId: string; role: UserRole; username: string } | NextResponse {
  const role = request.headers.get('x-user-role') as UserRole | null;
  const userId = request.headers.get('x-user-id') || '';
  const username = request.headers.get('x-user-name') || '';

  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  return { userId, role, username };
}

export function checkWriteAccess(request: NextRequest): { userId: string; role: UserRole; username: string } | NextResponse {
  return checkRole(request, 'Administrator', 'Operator');
}

export function parseJsonArray(text: string | null): string[] {
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function paginationParams(request: NextRequest): { limit: number; offset: number } {
  const url = request.nextUrl;
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '50'), 1), 500);
  const page = Math.max(parseInt(url.searchParams.get('page') || '1'), 1);
  const offset = parseInt(url.searchParams.get('offset') || '') || (page - 1) * limit;
  return { limit, offset };
}

export function fromEpoch(seconds: number): string {
  return new Date(seconds * 1000).toISOString();
}
