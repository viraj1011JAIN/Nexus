import { OrganizationList } from "@clerk/nextjs";

/**
 * Organisation selector page.
 *
 * Users land here when they are authenticated but have no active organisation
 * (e.g. first sign-in, or after switching accounts). Clerk's <OrganizationList>
 * component handles both joining existing orgs and creating new ones.
 *
 * Middleware redirects here when: userId exists AND orgId is missing.
 */
export default function SelectOrgPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Choose your workspace</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Select an organisation to continue, or create a new one.
          </p>
        </div>
        <OrganizationList
          hidePersonal
          afterCreateOrganizationUrl="/dashboard"
          afterSelectOrganizationUrl="/dashboard"
        />
      </div>
    </div>
  );
}
