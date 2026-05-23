"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import {
  canAccessConfiguredSection,
  canAccessEducationalBlock,
  getDefaultSectionPermissions,
  type SectionPermissionsMap,
} from "@/data/access-permissions"
import type { UserRole } from "@/data/roles"
import { setCachedSectionPermissions } from "@/data/users"

interface AccessContextValue {
  permissions: SectionPermissionsMap
  loading: boolean
  refreshPermissions: () => Promise<void>
  canAccess: (sectionId: string, role: UserRole, secondaryRole?: string) => boolean
  canAccessEducational: (role: UserRole, secondaryRole?: string) => boolean
}

const AccessContext = createContext<AccessContextValue | undefined>(undefined)

export function AccessProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<SectionPermissionsMap>(getDefaultSectionPermissions())
  const [loading, setLoading] = useState(true)

  const refreshPermissions = useCallback(async () => {
    try {
      const res = await fetch("/api/access-permissions")
      const data = await res.json()
      if (data.permissions) {
        const merged = { ...getDefaultSectionPermissions(), ...data.permissions }
        setPermissions(merged)
        setCachedSectionPermissions(merged)
      }
    } catch {
      setPermissions(getDefaultSectionPermissions())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshPermissions()
    const onUpdated = () => refreshPermissions()
    window.addEventListener("accessPermissionsUpdated", onUpdated)
    return () => window.removeEventListener("accessPermissionsUpdated", onUpdated)
  }, [refreshPermissions])

  const canAccess = useCallback(
    (sectionId: string, role: UserRole, secondaryRole?: string) =>
      canAccessConfiguredSection(sectionId, permissions, role, secondaryRole),
    [permissions]
  )

  const canAccessEducational = useCallback(
    (role: UserRole, secondaryRole?: string) =>
      canAccessEducationalBlock(permissions, role, secondaryRole),
    [permissions]
  )

  return (
    <AccessContext.Provider
      value={{ permissions, loading, refreshPermissions, canAccess, canAccessEducational }}
    >
      {children}
    </AccessContext.Provider>
  )
}

export function useAccess() {
  const ctx = useContext(AccessContext)
  if (!ctx) {
    throw new Error("useAccess must be used within AccessProvider")
  }
  return ctx
}
