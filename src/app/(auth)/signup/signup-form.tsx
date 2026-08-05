"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm, useWatch } from "react-hook-form"

import { signUp } from "@/app/(auth)/signup/actions"
import { Button } from "@/components/ui/button"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ROLES } from "@/lib/roles"
import type { WorkspaceMode } from "@/db/schema"
import { signupSchema, type SignupInput } from "@/lib/validation"

export function SignupForm({
  mode,
  firstRun,
}: {
  mode: WorkspaceMode
  firstRun: boolean
}) {
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { mode: firstRun ? "solo" : undefined },
  })

  // On first run the choice made here sets the workspace mode, so the role
  // question follows that answer rather than the stored one.
  const chosenMode = useWatch({ control, name: "mode" })
  const effectiveMode = firstRun ? (chosenMode ?? "solo") : mode
  const showRole = effectiveMode === "team"

  async function onSubmit(values: SignupInput) {
    // On success signUp redirects, so anything returned here is a failure.
    const result = await signUp(values)
    if (result?.error) {
      setError("root", { message: result.error })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" autoComplete="name" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            {...register("email")}
          />
          <FieldError errors={[errors.email]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
          <FieldDescription>At least 8 characters.</FieldDescription>
          <FieldError errors={[errors.password]} />
        </Field>

        {firstRun ? (
          <Field>
            <FieldLabel htmlFor="mode">How are you working?</FieldLabel>
            <Controller
              control={control}
              name="mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="mode" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="solo">On my own</SelectItem>
                    <SelectItem value="team">With a team</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
            <FieldDescription>
              On your own, you hold every altitude and nothing is read-only.
              With a team, each role owns one. You can change this later in
              settings.
            </FieldDescription>
            <FieldError errors={[errors.mode]} />
          </Field>
        ) : null}

        {showRole ? (
          <Field>
            <FieldLabel htmlFor="role">Role</FieldLabel>
            <Controller
              control={control}
              name="role"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="role" className="w-full">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError errors={[errors.role]} />
          </Field>
        ) : null}

        <FieldError errors={[errors.root]} />

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating account..." : "Create account"}
        </Button>
      </FieldGroup>
    </form>
  )
}
