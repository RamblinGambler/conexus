import type { UserRole, WorkspaceMode } from "@/db/schema"

export const ROLES: { value: UserRole; label: string }[] = [
  { value: "executive", label: "Executive" },
  { value: "product_manager", label: "Product Manager" },
  { value: "engineer", label: "Engineer" },
  { value: "designer", label: "Designer" },
]

export const ROLE_VALUES = ROLES.map((r) => r.value) as [UserRole, ...UserRole[]]

export function roleLabel(role: UserRole) {
  return ROLES.find((r) => r.value === role)?.label ?? role
}

/**
 * Solo operators are still stored with a role, so a workspace can switch back
 * to team mode without inventing one. Which role it is doesn't affect access in
 * solo mode — nothing is gated there.
 */
export const SOLO_DEFAULT_ROLE: UserRole = "product_manager"

export const ALTITUDES = ["roadmap", "prd", "spec"] as const
export type Altitude = (typeof ALTITUDES)[number]

export const ALTITUDE_LABELS: Record<Altitude, string> = {
  roadmap: "Roadmap",
  prd: "PRD",
  spec: "Spec",
}

/** The altitude each role works at, and the only one they may edit. */
export const ALTITUDE_BY_ROLE: Record<UserRole, Altitude> = {
  executive: "roadmap",
  product_manager: "prd",
  engineer: "spec",
  designer: "spec",
}

/**
 * Whether this person may edit this altitude.
 *
 * `mode` is required rather than optional on purpose: this decides write
 * access, and a required parameter makes the compiler find every call site
 * instead of letting one silently fall back to team rules.
 *
 * In solo mode one person holds every altitude, so nothing is gated.
 */
export function canEditAltitude(
  role: UserRole,
  altitude: Altitude,
  mode: WorkspaceMode
) {
  if (mode === "solo") return true
  return ALTITUDE_BY_ROLE[role] === altitude
}

/** Roles that own a given altitude, for "only X can edit this" messaging. */
export function rolesForAltitude(altitude: Altitude) {
  return ROLES.filter((r) => ALTITUDE_BY_ROLE[r.value] === altitude)
}
