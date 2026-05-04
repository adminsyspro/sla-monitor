import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, setSessionCookie, clearSession, getSession } from '@/lib/auth/session';
import type { UserRole } from '@/lib/auth/session';

interface UserRow {
  id: string;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  active: number;
  password_hash: string | null;
  auth_type: string;
}

// POST /api/auth/login
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password, authType = 'local' } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Nom d'utilisateur et mot de passe requis" },
        { status: 400 }
      );
    }

    const db = getDb();
    let user: { id: string; username: string; email: string; firstname: string; lastname: string; role: UserRole } | null = null;

    if (authType === 'ldap') {
      const existingRow = db.prepare(
        "SELECT * FROM users WHERE username = ? AND auth_type = 'ldap'"
      ).get(username) as UserRow | undefined;

      if (existingRow) {
        const ldapOk = await tryLDAPAuth(db, username, password);
        if (!ldapOk) {
          return NextResponse.json({ error: "Nom d'utilisateur ou mot de passe invalide" }, { status: 401 });
        }
        if (!existingRow.active) {
          return NextResponse.json({ error: "Votre compte est en attente d'approbation par un administrateur." }, { status: 403 });
        }
        const freshRow = db.prepare(
          "SELECT * FROM users WHERE id = ?"
        ).get(existingRow.id) as UserRow;
        user = {
          id: freshRow.id,
          username: freshRow.username,
          email: freshRow.email,
          firstname: freshRow.firstname,
          lastname: freshRow.lastname,
          role: freshRow.role as UserRole,
        };
      } else {
        const provisioned = await tryLDAPAuthAndProvision(db, username, password);
        if (provisioned) {
          return NextResponse.json({ error: "Votre compte a été créé et est en attente d'approbation par un administrateur." }, { status: 403 });
        }
      }
    } else {
      const row = db.prepare(
        "SELECT * FROM users WHERE username = ? AND active = 1 AND auth_type = 'local'"
      ).get(username) as UserRow | undefined;

      if (row && row.password_hash) {
        const valid = await verifyPassword(password, row.password_hash);
        if (valid) {
          user = {
            id: row.id,
            username: row.username,
            email: row.email,
            firstname: row.firstname,
            lastname: row.lastname,
            role: row.role as UserRole,
          };
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Nom d'utilisateur ou mot de passe invalide" }, { status: 401 });
    }

    const userRow = db.prepare('SELECT avatar FROM users WHERE id = ?').get(user.id) as { avatar: string | null } | undefined;

    const token = await createSession(user);
    await setSessionCookie(token);

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
        avatar: userRow?.avatar || null,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: "Erreur d'authentification" }, { status: 500 });
  }
}

// DELETE /api/auth/login (logout)
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}

// GET /api/auth/login (get current session)
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  const db = getDb();
  const row = db.prepare('SELECT avatar, firstname, lastname FROM users WHERE id = ?').get(session.userId) as { avatar: string | null; firstname: string; lastname: string } | undefined;

  return NextResponse.json({
    user: {
      id: session.userId,
      username: session.username,
      email: session.email,
      role: session.role,
      firstname: row?.firstname,
      lastname: row?.lastname,
      avatar: row?.avatar || null,
    },
  });
}

// --- LDAP helpers ---

import { decrypt } from '@/lib/crypto';
import type { LDAPConfig } from '@/lib/auth/ldap';

function getLDAPConfigFromDB(db: ReturnType<typeof getDb>): LDAPConfig | null {
  const rows = db.prepare(
    "SELECT key, value FROM app_settings WHERE key LIKE 'ldap_%'"
  ).all() as Array<{ key: string; value: string }>;

  const config: Record<string, string> = {};
  for (const row of rows) {
    config[row.key] = row.key === 'ldap_bind_password' ? decrypt(row.value) : row.value;
  }

  if (config.ldap_enabled !== 'true') return null;
  if (!config.ldap_url || !config.ldap_base_dn) return null;

  return {
    url: config.ldap_url,
    baseDN: config.ldap_base_dn,
    bindDN: config.ldap_bind_dn || undefined,
    bindPassword: config.ldap_bind_password || undefined,
    userSearchFilter: config.ldap_user_filter || '(uid={{username}})',
    adminGroup: config.ldap_admin_group || 'sla-admins',
    operatorGroup: config.ldap_operator_group || 'sla-operators',
  };
}

async function tryLDAPAuth(
  db: ReturnType<typeof getDb>,
  username: string,
  password: string
): Promise<boolean> {
  const ldapConfig = getLDAPConfigFromDB(db);
  if (!ldapConfig) return false;
  try {
    const { createLDAPClientFromConfig } = await import('@/lib/auth/ldap');
    const client = createLDAPClientFromConfig(ldapConfig);
    const result = await client.authenticate(username, password);
    if (!result) return false;

    const role = client.getUserRole(result.groups);
    db.prepare(
      `UPDATE users SET email = ?, firstname = ?, lastname = ?, avatar = ?, role = ?, updated_at = unixepoch() WHERE username = ?`
    ).run(result.email, result.firstName, result.lastName, result.avatar || null, role, username);

    return true;
  } catch (err) {
    console.error('[LDAP] Auth error:', err);
    return false;
  }
}

async function tryLDAPAuthAndProvision(
  db: ReturnType<typeof getDb>,
  username: string,
  password: string
): Promise<boolean> {
  const ldapConfig = getLDAPConfigFromDB(db);
  if (!ldapConfig) return false;
  try {
    const { createLDAPClientFromConfig } = await import('@/lib/auth/ldap');
    const client = createLDAPClientFromConfig(ldapConfig);
    const ldapUser = await client.authenticate(username, password);
    if (!ldapUser) return false;

    const role = client.getUserRole(ldapUser.groups);
    const id = crypto.randomUUID();

    db.prepare(
      `INSERT INTO users (id, username, email, firstname, lastname, role, active, avatar, auth_type)
       VALUES (?, ?, ?, ?, ?, ?, 0, ?, 'ldap')
       ON CONFLICT(username) DO UPDATE SET
         email = excluded.email,
         firstname = excluded.firstname,
         lastname = excluded.lastname,
         avatar = excluded.avatar,
         updated_at = unixepoch()`
    ).run(id, ldapUser.username, ldapUser.email, ldapUser.firstName, ldapUser.lastName, role, ldapUser.avatar || null);

    return true;
  } catch (err) {
    console.error('[LDAP] Auth+provision error:', err);
    return false;
  }
}
