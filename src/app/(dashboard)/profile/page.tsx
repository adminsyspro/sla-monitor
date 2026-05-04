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
      setProfileMsg('Profil mis à jour');
    } else {
      const data = await res.json();
      setProfileError(data.error || 'Erreur');
    }
  };

  const handlePasswordSave = async () => {
    setPasswordMsg('');
    setPasswordError('');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }
    if (passwordData.newPassword.length < 4) {
      setPasswordError('Le mot de passe doit contenir au moins 4 caractères');
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
      setPasswordMsg('Mot de passe modifié');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      const data = await res.json();
      setPasswordError(data.error || 'Erreur');
    }
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case 'Administrator': return 'Administrateur';
      case 'Operator': return 'Opérateur';
      default: return 'Utilisateur';
    }
  };

  if (!user) return null;

  return (
    <>
      <Header title="Mon profil" />
      <main className="p-6 space-y-6 max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Informations personnelles</CardTitle>
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
                <Label>Prénom</Label>
                <Input value={profileData.firstname} onChange={(e) => setProfileData({ ...profileData, firstname: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Nom</Label>
                <Input value={profileData.lastname} onChange={(e) => setProfileData({ ...profileData, lastname: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={profileData.email} onChange={(e) => setProfileData({ ...profileData, email: e.target.value })} />
            </div>
            <Button onClick={handleProfileSave}>Enregistrer</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Changer le mot de passe</CardTitle>
            <CardDescription>Uniquement pour les comptes locaux</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {passwordMsg && <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">{passwordMsg}</div>}
            {passwordError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{passwordError}</div>}
            <div className="space-y-2">
              <Label>Mot de passe actuel</Label>
              <Input type="password" value={passwordData.currentPassword} onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nouveau mot de passe</Label>
              <Input type="password" value={passwordData.newPassword} onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Confirmer le nouveau mot de passe</Label>
              <Input type="password" value={passwordData.confirmPassword} onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} />
            </div>
            <Button onClick={handlePasswordSave}>Changer le mot de passe</Button>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
