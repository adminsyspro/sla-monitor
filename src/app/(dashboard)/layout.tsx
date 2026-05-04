'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sidebar } from '@/components/layout/sidebar'
import { useAppStore } from '@/stores/app-store'
import { useAuthStore } from '@/stores/auth-store'
import { cn } from '@/lib/utils'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { sidebarCollapsed } = useAppStore()
  const { logout, setUser } = useAuthStore()
  const router = useRouter()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    fetch('/api/auth/login')
      .then((res) => {
        if (res.status === 401) {
          logout()
          router.push('/login')
          return
        }
        return res.json()
      })
      .then((data) => {
        if (data?.user) {
          setUser({
            id: data.user.id,
            username: data.user.username,
            email: data.user.email,
            firstname: data.user.firstname || '',
            lastname: data.user.lastname || '',
            role: data.user.role,
            avatar: data.user.avatar,
          })
          setReady(true)
        }
      })
      .catch(() => {
        logout()
        router.push('/login')
      })
  }, [logout, setUser, router])

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div
        className={cn(
          'transition-all duration-300',
          sidebarCollapsed ? 'ml-16' : 'ml-64'
        )}
      >
        {children}
      </div>
    </div>
  )
}
