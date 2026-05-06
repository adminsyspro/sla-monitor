'use client';

import * as React from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Check, X } from 'lucide-react';

interface UserData {
  id: string;
  username: string;
  email: string;
  firstname: string;
  lastname: string;
  role: string;
  active: boolean;
  authType: string;
  created_at: string;
  updated_at: string;
}

export default function UsersPage() {
  const [users, setUsers] = React.useState<UserData[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<UserData | null>(null);
  const [formData, setFormData] = React.useState({
    username: '',
    email: '',
    firstname: '',
    lastname: '',
    role: 'User',
    password: '',
  });
  const [error, setError] = React.useState('');

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
    setLoading(false);
  };

  React.useEffect(() => { fetchUsers(); }, []);

  const openCreate = () => {
    setEditingUser(null);
    setFormData({ username: '', email: '', firstname: '', lastname: '', role: 'User', password: '' });
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (user: UserData) => {
    setEditingUser(user);
    setFormData({
      username: user.username,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      role: user.role,
      password: '',
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setError('');
    try {
      if (editingUser) {
        const body: Record<string, unknown> = {
          username: formData.username,
          email: formData.email,
          firstname: formData.firstname,
          lastname: formData.lastname,
          role: formData.role,
        };
        if (formData.password) body.password = formData.password;

        const res = await fetch(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Error');
          return;
        }
      } else {
        const res = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const data = await res.json();
          setError(data.error || 'Error');
          return;
        }
      }
      setDialogOpen(false);
      fetchUsers();
    } catch {
      setError('Connection error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this user?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'Error');
    }
  };

  const handleToggleActive = async (user: UserData) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      alert(data.error || 'Error');
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'Administrator': return 'Administrator';
      case 'Operator': return 'Operator';
      default: return 'User';
    }
  };

  return (
    <>
      <Header title="User Management" />
      <main className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground">
            {users.length} user{users.length > 1 ? 's' : ''}
          </p>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New user
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="grid gap-4">
            {users.map((user) => (
              <Card key={user.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-medium">
                      {(user.firstname?.[0] || '') + (user.lastname?.[0] || '') || user.username[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium">
                        {user.firstname} {user.lastname}
                        <span className="ml-2 text-muted-foreground text-sm">@{user.username}</span>
                      </div>
                      <div className="text-sm text-muted-foreground">{user.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={user.authType === 'ldap' ? 'secondary' : 'outline'}>
                      {user.authType === 'ldap' ? 'LDAP' : 'Local'}
                    </Badge>
                    <Badge variant={user.role === 'Administrator' ? 'default' : 'secondary'}>
                      {roleLabel(user.role)}
                    </Badge>
                    <Badge
                      variant={user.active ? 'default' : 'destructive'}
                      className="cursor-pointer"
                      onClick={() => handleToggleActive(user)}
                    >
                      {user.active ? <Check className="mr-1 h-3 w-3" /> : <X className="mr-1 h-3 w-3" />}
                      {user.active ? 'Active' : 'Pending'}
                    </Badge>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(user)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(user.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingUser ? 'Edit user' : 'New user'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {error && (
                <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>First name</Label>
                  <Input value={formData.firstname} onChange={(e) => setFormData({ ...formData, firstname: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Last name</Label>
                  <Input value={formData.lastname} onChange={(e) => setFormData({ ...formData, lastname: e.target.value })} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Username</Label>
                <Input value={formData.username} onChange={(e) => setFormData({ ...formData, username: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Administrator">Administrator</SelectItem>
                    <SelectItem value="Operator">Operator</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{editingUser ? 'New password (leave blank to keep current)' : 'Password'}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingUser}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleSave}>{editingUser ? 'Save' : 'Create'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </>
  );
}
