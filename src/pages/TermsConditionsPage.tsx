import React from "react";
import { useNavigate } from "react-router-dom";

export default function TermsConditionsPage() {
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

        <h1 className="text-2xl font-semibold text-foreground">Terms &amp; Conditions</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Please review these terms before using the GrowwTrader app.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
          <section>
            <h2 className="text-sm font-semibold text-foreground">1. Use of Service</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This service provides paper-trading and contest features. By accessing the app, you agree to comply
              with all applicable laws and the rules of contests.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground">2. Contests &amp; Entry Fees (INR)</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Pro-League contests use entry fees and prizes denominated in INR. Typical entry fees (configurable by admin)
              may apply and are shown in-app before you join.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground">3. No Guaranteed Returns</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Rewards depend on contest outcomes. Results are not guaranteed.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground">4. Payments</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Wallet top-ups and contest entry payments are processed via supported payment gateways.
            </p>
          </section>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Replace this placeholder text with your legal policy if you have one. For whitelist approval, ensure this page is accessible and contains the required sections.
        </p>
      </div>
    </div>
  );
}

