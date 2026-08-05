export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-2xl font-semibold tracking-tight">Conexus</span>
          <span className="text-sm text-muted-foreground">
            One source of truth, at every altitude.
          </span>
        </div>
        {children}
      </div>
    </div>
  )
}
