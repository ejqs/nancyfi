import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function BrandMark() {
  return (
    <div
      aria-hidden
      className="mx-auto flex size-8 items-center justify-center rounded-full bg-foreground text-background"
    >
      <div className="flex h-3.5 gap-0.5">
        <span className="w-0.5 rounded-full bg-current" />
        <span className="w-0.5 rounded-full bg-current" />
        <span className="w-0.5 rounded-full bg-current" />
      </div>
    </div>
  )
}

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted/40 px-4 py-12">
      <Card className="w-full max-w-sm rounded-2xl py-6 shadow-sm ring-foreground/5">
        <CardHeader className="items-center text-center">
          <BrandMark />
          <CardTitle className="mt-3 text-base font-semibold tracking-tight">
            {title}
          </CardTitle>
          <CardDescription className="text-balance">{description}</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
        <CardFooter className="justify-center text-center">
          <p className="text-xs/relaxed text-muted-foreground text-balance">
            By using Nancyfi, you agree to our Terms of Service & Privacy
            Policy.
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
