import type { Metadata } from "next";
import { Notice, PageHeader } from "@/components/common/misc";
import { TypeStepForm } from "@/components/owner/step-forms";
import { requirePageUser } from "@/lib/auth/session";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "New listing" };

export default async function NewListingPage({ searchParams }: PageProps<"/dashboard/listings/new">) {
  await requirePageUser(["OWNER"], "/dashboard/listings/new");
  const params = await searchParams;
  const categories = await db.propertyCategory.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" } });

  return (
    <>
      <PageHeader title="Create a listing" description="Step 1 of 7 — choose the type of property. Your progress is saved as a draft after this step." />
      {params.welcome === "1" ? (
        <Notice className="mt-5" title="Your owner account is ready">
          Create your first listing below. Every listing is reviewed by our team before tenants can see it.
        </Notice>
      ) : null}
      <div className="mt-6 rounded-2xl border bg-white p-5 sm:p-6">
        <TypeStepForm categories={categories} />
      </div>
    </>
  );
}
