import React from "react";
import { useNavigate } from "react-router-dom";

export default function ContactUsPage() {
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

        <h1 className="text-2xl font-semibold text-foreground">Contact Us</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          We’re here to help. For support and account-related queries, write to us at:
        </p>

        <div className="mt-4 rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground">Support Email</p>
          <p className="mt-1 text-sm text-muted-foreground">support@growwtrader.in</p>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Note: Replace the email address above with your official support email if different.
        </p>
      </div>
    </div>
  );
}

