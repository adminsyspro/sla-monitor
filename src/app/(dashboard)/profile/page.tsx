'use client';

import * as React from 'react';
import { Header } from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/stores/auth-store';

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const [profileData, setProfileData] = React.useState({
    email: '',
    firstname: '',
    lastname: '',
  });
  const [passwordData, setPasswordData] = React.useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [profileMsg, setProfileMsg] = React.useState('');
  const [passwordMsg, setPasswordMsg] = React.useState('');
  const [profileError, setProfileError] = React.useState('');
  const [passwordError, setPasswordError] = React.useState('');

  React.useEffect(() => {
    if (user) {
      setProfileData({
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
      });
    }
  }, [user]);

  const handleProfileSave = async () => {
    setProfileMsg('');
    setProfileError('');
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profileData),
    });
    if (res.ok) {
      const data = await res.json();
      setUser({
        id: data.id,
        username: data.username,
        email: data.email,
        firstname: data.firstname,
        lastname: data.lastname,
        role: data.role,
        avatar: data.avatar,
      });
      setProfileMsg('Profile updated');
    } else {
      const data = await res.json();
      setProfileError(data.error || 'Error');
    }
  };

  const handlePasswordSave = async () => {
    setPasswordMsg('');
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 4) {
      setPasswordError('Password must contain at least 4 characters');
      return;
    }
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      }),
    });
    if (res.ok) {
      setPasswordMsg('Password changed');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      const data = await res.json();
      setPasswordError(data.error || 'Error');
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'Administrator': return 'Administrator';
      case 'Operator': return 'Operator';
      default: return 'User';
    }
  };

  if (!user) return null;

  return (
    <>
      <Header title="My Profile" />
      <main className="p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>@{user.username}</CardDescription>
              </div>
              <Badge>{roleLabel(user.role)}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {profileMsg && <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">{profileMsg}</div>}
            {profileError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{profileError}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First name</Label>
                <Input value={profileData.firstname} onChange={(e) => setProfileData({ ...profileData, firstname: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Last name</Label>
                <Input value={profileData.lastname} onChange={(e) => setProfileData({ ...profileData, lastname: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={profileData.email} onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} />
            </div>
            <Button onClick={handleProfileSave}>Save</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
            <CardDescription>Only for local accounts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {passwordMsg && <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">{passwordMsg}</div>}
            {passwordError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{passwordError}</div>}
            <div className="space-y-2">
              <Label>Current password</Label>
              <Input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>New password</Label>
              <Input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Confirm new password</Label>
              <Input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
            </div>
            <Button onClick={handlePasswordSave}>Change password</Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
