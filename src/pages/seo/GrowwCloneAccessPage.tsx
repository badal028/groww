import React from "react";
import { Link } from "react-router-dom";
import { SeoHead } from "@/components/SeoHead";
import SeoPublicShell from "./SeoPublicShell";

export default function GrowwCloneAccessPage() {
  return (
    <SeoPublicShell>
      <SeoHead
        title="Groww clone app access | Groww clone apk alternative"
        description="Looking for Groww clone app / apk access? GrowwTrader provides controlled access for testing and demo onboarding."
        canonicalPath="/groww-clone-apk"
      />
      <h1 className="text-2xl font-semibold tracking-tight">Groww clone app access</h1>
      <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
        If you searched for <strong className="text-foreground">Groww clone apk</strong>, <strong className="text-foreground">Groww clone app</strong>,
        or similar keywords, this is the official access page for our test environment.
      </p>
      <div className="mt-6 rounded-xl border border-border bg-card p-4">
        <p className="text-sm font-medium text-foreground">Application access</p>
        <p className="mt-1 text-sm text-muted-foreground">
          New registrations are controlled. For access, contact:
          <span className="ml-1 font-medium text-foreground">badal@gmail.com</span>,
          <span className="ml-1 font-medium text-foreground">badal1@gmail.com</span>,
          <span className="ml-1 font-medium text-foreground">pbadal392@gmail.com</span>.
        </p>
      </div>
      <div className="mt-8">
        <Link to="/login" className="inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          Go to login
        </Link>
      </div>
    </SeoPublicShell>
  );
}
