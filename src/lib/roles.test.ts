import { describe, expect, it } from "vitest"

import {
  ALTITUDES,
  ALTITUDE_BY_ROLE,
  ROLE_VALUES,
  canEditAltitude,
  rolesForAltitude,
} from "@/lib/roles"
import type { Altitude } from "@/lib/roles"
import type { UserRole } from "@/db/schema"

/**
 * `canEditAltitude` is the write gate for every altitude form and for the
 * orchestrator's tools, so the whole matrix is asserted rather than sampled.
 */

describe("canEditAltitude in team mode", () => {
  const expected: Record<UserRole, Altitude> = {
    executive: "roadmap",
    product_manager: "prd",
    engineer: "spec",
    designer: "spec",
  }

  for (const role of ROLE_VALUES) {
    for (const altitude of ALTITUDES) {
      const allowed = expected[role] === altitude
      it(`${allowed ? "lets" : "stops"} ${role} edit ${altitude}`, () => {
        expect(canEditAltitude(role, altitude, "team")).toBe(allowed)
      })
    }
  }

  it("grants each role exactly one altitude", () => {
    for (const role of ROLE_VALUES) {
      const permitted = ALTITUDES.filter((a) =>
        canEditAltitude(role, a, "team")
      )
      expect(permitted).toHaveLength(1)
    }
  })
})

describe("canEditAltitude in solo mode", () => {
  it("opens every altitude to every role", () => {
    // One person holds all three altitudes in solo, so nothing is gated.
    for (const role of ROLE_VALUES) {
      for (const altitude of ALTITUDES) {
        expect(canEditAltitude(role, altitude, "solo")).toBe(true)
      }
    }
  })
})

describe("altitude ownership", () => {
  it("maps engineer and designer to the same altitude", () => {
    expect(ALTITUDE_BY_ROLE.engineer).toBe("spec")
    expect(ALTITUDE_BY_ROLE.designer).toBe("spec")
  })

  it("returns both spec owners for messaging", () => {
    expect(rolesForAltitude("spec").map((r) => r.value)).toEqual([
      "engineer",
      "designer",
    ])
  })

  it("returns a single owner for roadmap and prd", () => {
    expect(rolesForAltitude("roadmap").map((r) => r.value)).toEqual([
      "executive",
    ])
    expect(rolesForAltitude("prd").map((r) => r.value)).toEqual([
      "product_manager",
    ])
  })

  it("covers every altitude with at least one role", () => {
    for (const altitude of ALTITUDES) {
      expect(rolesForAltitude(altitude).length).toBeGreaterThan(0)
    }
  })
})
