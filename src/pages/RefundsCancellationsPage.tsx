import React from "react";
import { useNavigate } from "react-router-dom";

export default function RefundsCancellationsPage() {
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

        <h1 className="text-2xl font-semibold text-foreground">Refunds &amp; Cancellations</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          This page explains refund/cancellation policy for payments and contest entries.
        </p>

        <div className="mt-6 space-y-4 rounded-xl border border-border bg-card p-5">
          <section>
            <h2 className="text-sm font-semibold text-foreground">1. Payment Refunds</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Refunds, if applicable, are processed based on the payment gateway and transaction status.
              Refund timelines may vary.
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground">2. Contest Entry Cancellation</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Once a contest entry is confirmed, cancellation may be restricted depending on contest state
              (OPEN vs. FINALIZED).
            </p>
          </section>

          <section>
            <h2 className="text-sm font-semibold text-foreground">3. Support</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              For refund-related queries, contact support via the Contact Us page.
            </p>
          </section>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Replace with your final legal policy if required for whitelist approval.
        </p>
      </div>
    </div>
  );
}

