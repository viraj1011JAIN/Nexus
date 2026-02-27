/**
 * TASK-033 — Terms of Service page
 * Path: /terms
 */

import type { Metadata } from "next";
import Link from "next/link";
import { TERMS_LAST_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service | NEXUS",
  description: "Terms governing your use of the NEXUS platform.",
};

export default function TermsPage() {

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to NEXUS
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-tight">Terms of Service</h1>
          <p className="mt-2 text-muted-foreground">Last updated: {TERMS_LAST_UPDATED}</p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">

          {/* 1 */}
          <section aria-labelledby="terms-acceptance">
            <h2 id="terms-acceptance" className="text-2xl font-semibold">1. Acceptance of Terms</h2>
            <p>
              By accessing or using NEXUS (&ldquo;Service&rdquo;), you agree to be bound by these Terms of
              Service (&ldquo;Terms&rdquo;). If you are using the Service on behalf of an organisation, you
              represent that you have authority to bind that organisation. If you do not agree to
              these Terms, do not use the Service.
            </p>
          </section>

          {/* 2 */}
          <section aria-labelledby="terms-description">
            <h2 id="terms-description" className="text-2xl font-semibold">2. Description of Service</h2>
            <p>
              NEXUS is a B2B SaaS project management platform providing boards, lists, cards,
              team collaboration, analytics, and workflow automation features. The Service is
              provided on a subscription basis with tiered plans (Free, Pro, Enterprise).
            </p>
          </section>

          {/* 3 */}
          <section aria-labelledby="terms-account">
            <h2 id="terms-account" className="text-2xl font-semibold">3. Accounts and Organisations</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>You must be 16 years or older to create an account.</li>
              <li>You are responsible for maintaining the security of your credentials.</li>
              <li>Each organisation is a separate tenant; data is strictly isolated between organisations.</li>
              <li>Organisation admins may invite members, assign roles (Admin, Member, Viewer), and remove users at any time.</li>
              <li>You must not share credentials or allow unauthorised access to your account.</li>
            </ul>
          </section>

          {/* 4 */}
          <section aria-labelledby="terms-acceptable-use">
            <h2 id="terms-acceptable-use" className="text-2xl font-semibold">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li>Use the Service for any unlawful purpose or in violation of any applicable law.</li>
              <li>Attempt to gain unauthorised access to any part of the Service or other users&apos; data.</li>
              <li>Transmit malware, viruses, or other harmful code.</li>
              <li>Use automated tools to scrape, mine, or overload the Service without written permission.</li>
              <li>Reverse-engineer, decompile, or attempt to derive the source code of the Service.</li>
              <li>Resell, sublicense, or otherwise commercially exploit the Service without authorisation.</li>
            </ul>
          </section>

          {/* 5 */}
          <section aria-labelledby="terms-ip">
            <h2 id="terms-ip" className="text-2xl font-semibold">5. Intellectual Property</h2>
            <p>
              NEXUS and its licensors retain all intellectual property rights in the Service,
              including software, design, trademarks, and documentation. You retain ownership of
              the content (boards, cards, files) you create; by using the Service you grant us a
              limited licence to host, display, and transmit that content solely to operate the
              Service.
            </p>
          </section>

          {/* 6 */}
          <section aria-labelledby="terms-billing">
            <h2 id="terms-billing" className="text-2xl font-semibold">6. Billing and Payments</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Paid plans are billed monthly or annually in advance via Stripe.</li>
              <li>Prices are in USD and exclude applicable taxes.</li>
              <li>Subscriptions renew automatically unless cancelled before the renewal date.</li>
              <li>Refunds are available within 14 days of a new subscription or annual renewal; no refunds for mid-cycle cancellations.</li>
              <li>We reserve the right to modify pricing with 30 days&apos; notice; continued use after the notice period constitutes acceptance.</li>
            </ul>
          </section>

          {/* 7 */}
          <section aria-labelledby="terms-free-tier">
            <h2 id="terms-free-tier" className="text-2xl font-semibold">7. Free Tier and Trials</h2>
            <p>
              The Free plan is subject to usage limits (boards, members, AI calls per day) as
              published on our pricing page. We reserve the right to adjust free-tier limits with
              30 days&apos; notice. Trial periods, if offered, automatically convert to paid
              subscriptions unless cancelled before the trial ends.
            </p>
          </section>

          {/* 8 */}
          <section aria-labelledby="terms-uptime">
            <h2 id="terms-uptime" className="text-2xl font-semibold">8. Availability and SLA</h2>
            <p>
              We target 99.9% monthly uptime for paid plans. Scheduled maintenance is announced
              at least 24 hours in advance. We are not liable for downtime caused by third-party
              infrastructure providers, force majeure events, or actions outside our control.
            </p>
          </section>

          {/* 9 */}
          <section aria-labelledby="terms-data">
            <h2 id="terms-data" className="text-2xl font-semibold">9. Data and Privacy</h2>
            <p>
              Your use of the Service is governed by our{" "}
              <Link href="/privacy" className="underline text-indigo-600 dark:text-indigo-400">
                Privacy Policy
              </Link>
              , which is incorporated into these Terms by reference.
            </p>
          </section>

          {/* 10 */}
          <section aria-labelledby="terms-termination">
            <h2 id="terms-termination" className="text-2xl font-semibold">10. Termination</h2>
            <p>
              You may close your account at any time from Account Settings. We reserve the right
              to suspend or terminate accounts that violate these Terms. Upon termination, your
              data will be deleted within 30 days in accordance with our Privacy Policy. You may
              export your data before closing your account using the built-in export features.
            </p>
          </section>

          {/* 11 */}
          <section aria-labelledby="terms-disclaimers">
            <h2 id="terms-disclaimers" className="text-2xl font-semibold">11. Disclaimers</h2>
            <p>
              The Service is provided &quot;as is&quot; without warranty of any kind, express or implied.
              We do not warrant that the Service will be error-free, uninterrupted, or free from
              security vulnerabilities. AI-generated suggestions are provided for convenience and
              should not be relied upon as professional advice.
            </p>
          </section>

          {/* 12 */}
          <section aria-labelledby="terms-liability">
            <h2 id="terms-liability" className="text-2xl font-semibold">12. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, NEXUS shall not be liable for any indirect,
              incidental, special, or consequential damages, including loss of profit, data, or
              business interruption. Our total cumulative liability shall not exceed the amounts
              paid by you in the 12 months preceding the claim.
            </p>
          </section>

          {/* 13 */}
          <section aria-labelledby="terms-governing-law">
            <h2 id="terms-governing-law" className="text-2xl font-semibold">13. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the State of Delaware, United States,
              without regard to conflict-of-law principles. Disputes shall be resolved by binding
              arbitration under the AAA Commercial Arbitration Rules, except that either party
              may seek injunctive relief in a court of competent jurisdiction.
            </p>
          </section>

          {/* 14 */}
          <section aria-labelledby="terms-changes">
            <h2 id="terms-changes" className="text-2xl font-semibold">14. Changes to Terms</h2>
            <p>
              We may revise these Terms at any time. Material changes will be notified via email
              or in-app notice at least 14 days before they take effect. Continued use of the
              Service after the effective date constitutes acceptance of the revised Terms.
            </p>
          </section>

          {/* 15 */}
          <section aria-labelledby="terms-contact">
            <h2 id="terms-contact" className="text-2xl font-semibold">15. Contact</h2>
            <p>
              Questions about these Terms? Contact us at{" "}
              <a href="mailto:legal@nexus.app" className="underline text-indigo-600 dark:text-indigo-400">
                legal@nexus.app
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-sm text-muted-foreground">
          <Link href="/privacy" className="underline hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          {" · "}
          <Link href="/" className="underline hover:text-foreground transition-colors">
            Back to NEXUS
          </Link>
        </div>
      </div>
    </main>
  );
}
