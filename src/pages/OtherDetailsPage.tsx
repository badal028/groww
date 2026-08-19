import React from "react";
import { useNavigate } from "react-router-dom";

export default function OtherDetailsPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background px-4 py-8 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mb-6 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          Back
        </button>

        <h1 className="text-2xl font-semibold text-foreground">Other Details</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Products/services offered and their pricing in INR.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
          <section>
            <h2 className="text-sm font-semibold text-foreground">Pro-League (Trading Tournaments)</h2>
            <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>Entry Fee: typically ₹79 per user (admin configurable).</li>
              <li>Winners: Top 3 prizes (admin configurable).</li>
              <li>Example prizes: #1 ₹10,000, #2 ₹5,000, #3 ₹2,000.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground">Wallet Top-ups</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Add money to your real wallet using supported payment gateways in INR. Availability and minimums may vary.
            </p>
          </section>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          If you have additional services, add them here with INR pricing for whitelist compliance.
        </p>
      </div>
    </div>
  );
}

