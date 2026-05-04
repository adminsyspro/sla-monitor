'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  LayoutDashboard,
  Settings,
  Shield,
  Target,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import type { AuthUser } from '@/stores/auth-store'

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
  requiredRole?: AuthUser['role'][]
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navigation: NavGroup[] = [
  {
    title: 'Vue d\'ensemble',
    items: [
      { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { title: 'Monitors', href: '/monitors', icon: Activity },
      { title: 'Incidents', href: '/incidents', icon: AlertTriangle },
      { title: 'Maintenance', href: '/maintenance', icon: Calendar },
    ],
  },
  {
    title: 'SLA & Rapports',
    items: [
      { title: 'Objectifs SLA', href: '/sla-targets', icon: Target },
      { title: 'Rapports', href: '/reports', icon: BarChart3 },
      { title: 'Page de statut', href: '/status', icon: FileText },
    ],
  },
  {
    title: 'Administration',
    items: [
      { title: 'Utilisateurs', href: '/users', icon: Users, requiredRole: ['Administrator'] },
      { title: 'Sécurité', href: '/security', icon: Shield },
      { title: 'Paramètres', href: '/settings', icon: Settings },
    ],
  },
]

export function Sidebar() {
  const pathname = usePathname()
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()
  const { user } = useAuthStore()

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-slate-700 dark:border-border bg-slate-900 text-slate-100 dark:bg-card dark:text-card-foreground transition-all duration-300',
          sidebarCollapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center border-b border-slate-700 dark:border-border px-4">
          {!sidebarCollapsed ? (
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold text-white dark:text-foreground">SLA Monitor</span>
            </Link>
          ) : (
            <Link href="/dashboard" className="mx-auto">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Activity className="h-5 w-5 text-primary-foreground" />
              </div>
            </Link>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-6">
            {navigation.map((group) => {
              const visibleItems = group.items.filter(
                (item) => !item.requiredRole || (user && item.requiredRole.includes(user.role))
              )
              if (visibleItems.length === 0) return null

              return (
                <div key={group.title}>
                  {!sidebarCollapsed && (
                    <h4 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-muted-foreground">
                      {group.title}
                    </h4>
                  )}
                  <div className="space-y-1">
                    {visibleItems.map((item) => {
                      const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`)
                      const Icon = item.icon

                      if (sidebarCollapsed) {
                        return (
                          <Tooltip key={item.href}>
                            <TooltipTrigger asChild>
                              <Link href={item.href}>
                                <Button
                                  variant={isActive ? 'secondary' : 'ghost'}
                                  size="icon"
                                  className={cn(
                                    'w-full text-slate-300 hover:text-white hover:bg-slate-800 dark:text-inherit dark:hover:text-inherit dark:hover:bg-accent',
                                    isActive && 'bg-slate-800 text-white dark:bg-secondary dark:text-secondary-foreground'
                                  )}
                                >
                                  <Icon className="h-5 w-5" />
                                </Button>
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">{item.title}</TooltipContent>
                          </Tooltip>
                        )
                      }

                      return (
                        <Link key={item.href} href={item.href}>
                          <Button
                            variant={isActive ? 'secondary' : 'ghost'}
                            className={cn(
                              'w-full justify-start text-slate-300 hover:text-white hover:bg-slate-800 dark:text-inherit dark:hover:text-inherit dark:hover:bg-accent',
                              isActive && 'bg-slate-800 text-white dark:bg-secondary dark:text-secondary-foreground'
                            )}
                          >
                            <Icon className="mr-3 h-5 w-5" />
                            {item.title}
                          </Button>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Collapse Toggle */}
        <div className="border-t border-slate-700 dark:border-border p-3">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center text-slate-400 hover:text-white hover:bg-slate-800 dark:text-inherit dark:hover:bg-accent"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="mr-2 h-4 w-4" />
                Réduire
              </>
            )}
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  )
}
