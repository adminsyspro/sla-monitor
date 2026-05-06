'use client'

import { useState, useEffect } from 'react'
import {
  Bell,
  Globe,
  Key,
  Mail,
  Moon,
  Palette,
  Save,
  Server,
  Shield,
  Sun,
  User,
  Webhook,
} from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { useAuthStore } from '@/stores/auth-store'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/stores/app-store'

export default function SettingsPage() {
  const { theme, setTheme } = useAppStore()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('general')
  const isAdmin = user?.role === 'Administrator'

  // General settings state
  const [generalSettings, setGeneralSettings] = useState({
    siteName: '',
    contactEmail: '',
    timezone: '',
  })
  const [generalMsg, setGeneralMsg] = useState('')
  const [generalError, setGeneralError] = useState('')

  // LDAP state
  const [ldapConfig, setLdapConfig] = useState({
    enabled: false,
    url: '',
    baseDN: '',
    bindDN: '',
    bindPassword: '',
    userFilter: '(uid={{username}})',
    adminGroup: 'sla-admins',
    operatorGroup: 'sla-operators',
  })
  const [ldapMsg, setLdapMsg] = useState('')
  const [ldapError, setLdapError] = useState('')

  useEffect(() => {
    if (activeTab === 'general') {
      fetch('/api/settings/general')
        .then((r) => r.json())
        .then((data) => setGeneralSettings(data))
        .catch(() => {})
    }
  }, [activeTab])

  const saveGeneral = async () => {
    setGeneralMsg('')
    setGeneralError('')
    const res = await fetch('/api/settings/general', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(generalSettings),
    })
    if (res.ok) {
      setGeneralMsg('General settings saved')
    } else {
      setGeneralError('Error while saving')
    }
  }

  useEffect(() => {
    if (isAdmin && activeTab === 'ldap') {
      fetch('/api/settings/ldap')
        .then((r) => r.json())
        .then((data) => setLdapConfig(data))
        .catch(() => {})
    }
  }, [isAdmin, activeTab])

  const saveLdap = async () => {
    setLdapMsg('')
    setLdapError('')
    const res = await fetch('/api/settings/ldap', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ldapConfig),
    })
    if (res.ok) {
      setLdapMsg('LDAP configuration saved')
    } else {
      setLdapError('Error while saving')
    }
  }

  return (
    <>
      <Header title="Settings" />
      <main className="p-6">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 shrink-0">
            <nav className="space-y-1">
              {[
                { id: 'general', icon: User, label: 'General' },
                { id: 'appearance', icon: Palette, label: 'Appearance' },
                { id: 'notifications', icon: Bell, label: 'Notifications' },
                { id: 'integrations', icon: Webhook, label: 'Integrations' },
                { id: 'api', icon: Key, label: 'API' },
                { id: 'security', icon: Shield, label: 'Security' },
                ...(isAdmin ? [{ id: 'ldap', icon: Server, label: 'LDAP' }] : []),
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    activeTab === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <div className="flex-1 space-y-6">
            {activeTab === 'general' && (
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>
                    Configure your account's basic information
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {generalMsg && <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">{generalMsg}</div>}
                  {generalError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{generalError}</div>}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Organization name</Label>
                      <Input
                        id="name"
                        value={generalSettings.siteName}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, siteName: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Contact email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={generalSettings.contactEmail}
                        onChange={(e) => setGeneralSettings({ ...generalSettings, contactEmail: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Input
                      id="timezone"
                      value={generalSettings.timezone}
                      onChange={(e) => setGeneralSettings({ ...generalSettings, timezone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status-url">Status page URL</Label>
                    <div className="flex gap-2">
                      <Input
                        id="status-url"
                        defaultValue="https://status.example.com"
                        readOnly
                      />
                      <Button variant="outline">Configure</Button>
                    </div>
                  </div>
                  <Separator />
                  <Button onClick={saveGeneral}>
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeTab === 'appearance' && (
              <Card>
                <CardHeader>
                  <CardTitle>Appearance</CardTitle>
                  <CardDescription>
                    Customize the interface appearance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <Label>Theme</Label>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { value: 'light', icon: Sun, label: 'Light' },
                        { value: 'dark', icon: Moon, label: 'Dark' },
                        { value: 'system', icon: Globe, label: 'System' },
                      ].map((option) => (
                        <button
                          key={option.value}
                          onClick={() => setTheme(option.value as any)}
                          className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-colors ${
                            theme === option.value
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          <option.icon className="h-6 w-6" />
                          <span className="text-sm font-medium">
                            {option.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'notifications' && (
              <Card>
                <CardHeader>
                  <CardTitle>Notifications</CardTitle>
                  <CardDescription>
                    Configure how and when you are notified
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    {[
                      {
                        title: 'Email',
                        description: 'Receive alerts by email',
                        icon: Mail,
                        enabled: true,
                      },
                      {
                        title: 'Slack',
                        description: 'Notifications in Slack',
                        icon: Bell,
                        enabled: false,
                      },
                      {
                        title: 'Webhook',
                        description: 'Custom HTTP calls',
                        icon: Webhook,
                        enabled: true,
                      },
                    ].map((channel) => (
                      <div
                        key={channel.title}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div className="flex items-center gap-4">
                          <div className="rounded-lg bg-muted p-2">
                            <channel.icon className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="font-medium">{channel.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {channel.description}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant={channel.enabled ? 'default' : 'secondary'}
                        >
                          {channel.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {activeTab === 'api' && (
              <Card>
                <CardHeader>
                  <CardTitle>API Keys</CardTitle>
                  <CardDescription>
                    Manage your API access keys
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="rounded-lg border p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Production key</h4>
                        <p className="text-sm text-muted-foreground">
                          Created on January 15, 2024
                        </p>
                      </div>
                      <Badge>Active</Badge>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        value="sk_live_••••••••••••••••"
                        readOnly
                        className="font-mono"
                      />
                      <Button variant="outline">Copy</Button>
                      <Button variant="destructive">Revoke</Button>
                    </div>
                  </div>
                  <Button>
                    <Key className="mr-2 h-4 w-4" />
                    Create a new key
                  </Button>
                </CardContent>
              </Card>
            )}

            {activeTab === 'integrations' && (
              <Card>
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>
                    Connect your external tools
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Integrations will be available soon.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === 'security' && (
              <Card>
                <CardHeader>
                  <CardTitle>Security</CardTitle>
                  <CardDescription>
                    Manage your account security
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Security settings will be available soon.
                  </p>
                </CardContent>
              </Card>
            )}

            {activeTab === 'ldap' && isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Configuration LDAP</CardTitle>
                  <CardDescription>
                    Configure LDAP / Active Directory authentication
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {ldapMsg && <div className="rounded-lg bg-green-500/10 p-3 text-sm text-green-600">{ldapMsg}</div>}
                  {ldapError && <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{ldapError}</div>}

                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div>
                      <h4 className="font-medium">Enable LDAP</h4>
                      <p className="text-sm text-muted-foreground">Allow sign-in through an LDAP directory</p>
                    </div>
                    <Switch
                      checked={ldapConfig.enabled}
                      onCheckedChange={(v) => setLdapConfig({ ...ldapConfig, enabled: v })}
                    />
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>LDAP server URL</Label>
                      <Input
                        placeholder="ldap://ldap.example.com:389"
                        value={ldapConfig.url}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, url: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Base DN</Label>
                      <Input
                        placeholder="dc=example,dc=com"
                        value={ldapConfig.baseDN}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, baseDN: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bind DN (service account)</Label>
                      <Input
                        placeholder="cn=admin,dc=example,dc=com"
                        value={ldapConfig.bindDN}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, bindDN: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Bind password</Label>
                      <Input
                        type="password"
                        value={ldapConfig.bindPassword}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, bindPassword: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>User search filter</Label>
                      <Input
                        placeholder="(uid={{username}})"
                        value={ldapConfig.userFilter}
                        onChange={(e) => setLdapConfig({ ...ldapConfig, userFilter: e.target.value })}
                      />
                      <p className="text-xs text-muted-foreground">
                        Use {'{{username}}'} as the username placeholder
                      </p>
                    </div>

                    <Separator />
                    <h4 className="font-medium">Group Mapping</h4>
                    <p className="text-sm text-muted-foreground">
                      Map LDAP groups to application roles
                    </p>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Administrator group</Label>
                        <Input
                          placeholder="sla-admins"
                          value={ldapConfig.adminGroup}
                          onChange={(e) => setLdapConfig({ ...ldapConfig, adminGroup: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Operator group</Label>
                        <Input
                          placeholder="sla-operators"
                          value={ldapConfig.operatorGroup}
                          onChange={(e) => setLdapConfig({ ...ldapConfig, operatorGroup: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />
                  <Button onClick={saveLdap}>
                    <Save className="mr-2 h-4 w-4" />
                    Save LDAP configuration
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </>
  )
}
