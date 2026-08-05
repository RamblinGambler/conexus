"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { updateProfile } from "@/app/(app)/settings/actions"
import { initialsFrom } from "@/components/user-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import { profileSchema, type ProfileInput } from "@/lib/validation"

export function ProfileForm({
  email,
  defaultValues,
  showRole,
}: {
  email: string
  defaultValues: ProfileInput
  /** Hidden in solo mode, where role doesn't gate anything. */
  showRole: boolean
}) {
  const router = useRouter()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    defaultValues,
  })

  const watchedName = useWatch({ control, name: "name" })
  const watchedImage = useWatch({ control, name: "image" })

  async function onSubmit(values: ProfileInput) {
    const result = await updateProfile(values)
    if (result.error) {
      setError("root", { message: result.error })
      return
    }

    router.refresh()
    toast.success("Profile updated")
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <FieldGroup>
        <div className="flex items-center gap-4">
          <Avatar className="size-14">
            {watchedImage ? <AvatarImage src={watchedImage} alt="" /> : null}
            <AvatarFallback>{initialsFrom(watchedName, email)}</AvatarFallback>
          </Avatar>
          <div className="text-sm text-muted-foreground">{email}</div>
        </div>

        <Field>
          <FieldLabel htmlFor="name">Name</FieldLabel>
          <Input id="name" autoComplete="name" {...register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="image">Avatar URL</FieldLabel>
          <Input
            id="image"
            placeholder="https://example.com/avatar.png"
            {...register("image")}
          />
          <FieldDescription>
            Paste a link to an image. Leave blank to use your initials.
          </FieldDescription>
          <FieldError errors={[errors.image]} />
        </Field>

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

        <div>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  )
}
