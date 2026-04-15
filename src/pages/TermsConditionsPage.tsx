import React from "react";
import { useNavigate } from "react-router-dom";

const TERMS_TEXT = `By accessing this webpage, you are agreeing to be bound by these Terms and Conditions ("Terms") in a legally binding agreement between us ("Merchant" or "us" or "we" or "our") and the User ("you" or "your"). Please read these Terms carefully before accessing or using the Website. If you do not agree to the Terms, you may not access the Platform.

We reserve the right to update and change the Terms and Conditions by posting updates and changes to the Platform. You are advised to check the Terms and Conditions from time to time for any updates or changes that may impact you.

ELIGIBILITY
You hereby represent and warrant that you have the right, power, and authority to agree to the Terms, to become a party to a legally binding agreement and to perform your obligations hereunder.

DEFINITIONS
"Payment Instrument" includes credit card, debit card, bank account, prepaid payment instrument, Unified Payment Interface (UPI), Immediate Payment Service (IMPS) or any other methods of payments.
"Platform" refers to the website or platform where the Merchant offers its products or services and where the Transaction may be initiated.
"Transaction" shall refer to the order or request placed by the User with the Merchant to purchase the products and/or services listed on the Platform by paying the Transaction Amount to the Merchant.
"Transaction Amount" shall mean the amount paid by the User in connection with a Transaction.
"User/Users" means any person availing the products and/or services offered on the Platform.
"Website" shall mean www.instamojo.com or the mobile application.

MERCHANT'S RIGHTS
You agree that we may collect, store, and share the information provided by you in order to deliver the products and/or services availed by you on our Platform and/or contact you in relation to the same.

YOUR RESPONSIBILITIES
You agree to provide us with true, complete and up-to-date information about yourself as may be required for the purpose of completing the Transactions.

PROHIBITED ACTIONS
You may not access or use the Platform for any purpose other than that for which we make the Platform available. You agree not to misuse the Platform, attempt unauthorized access, trick/defraud users, upload malicious content, interfere with services, scrape data, reverse engineer the Platform, harass others, or use the Platform in violation of applicable law.

LIMITATION OF LIABILITY
The User agrees that in case of a defective product/service or mismatch, the available recourse is a refund request subject to this policy. The User shall indemnify and hold harmless the Merchant and its affiliates from claims arising from breach of these terms by the User.

GUIDELINES FOR REVIEWS
Reviews must be based on genuine first-hand experience, must not contain hate/offensive/illegal content, and must not be false or misleading. We may accept, reject, or remove reviews at our discretion.

GOVERNING LAW & DISPUTE RESOLUTION
These terms are governed by the laws of India. Courts in India shall have exclusive jurisdiction. Disputes may be referred to arbitration in Bengaluru under the Arbitration and Conciliation Act, 1996.

GRIEVANCE REDRESSAL
For questions or complaints regarding transactions, refunds, unauthorized transactions, or related concerns, contact us through the details provided below.

DISCLAIMER
By initiating a transaction, you enter into a legally binding contract to purchase the listed product/service. Payments are made at your own risk and volition. We are not liable for authorization declines, technical malfunctions, or unauthorized use of payment instruments. Third-party links are for convenience and do not imply endorsement.

CANCELLATION / REFUND
After a transaction is completed, cancellation is only available if explicitly allowed on the platform. Refund requests can be raised if product/service does not match the description. Refund decisions are at our discretion after review.

DELIVERY
Delivery timelines, where applicable, are estimates unless fixed in writing. If delivery is not received even after seven days from estimated date, please contact us promptly.`;

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
          Please review these terms before using the GrowwTrader platform.
        </p>

        <div className="mt-6 rounded-xl border border-border bg-card p-5">
          <p className="whitespace-pre-line text-sm leading-7 text-muted-foreground">{TERMS_TEXT}</p>
        </div>

        <div className="mt-4 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
          <p>Contact: pbadal392@gmail.com</p>
          <p>Phone: 7016394406</p>
        </div>
      </div>
    </div>
  );
}

