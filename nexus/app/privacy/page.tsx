/**
 * TASK-033 — Privacy Policy page
 * Path: /privacy
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | NEXUS",
  description: "How NEXUS collects, uses, and protects your personal data.",
};

export default function PrivacyPage() {
  const lastUpdated = "January 1, 2025";

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-16">
        {/* Header */}
        <div className="mb-10">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back to NEXUS
          </Link>
          <h1 className="mt-6 text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="mt-2 text-muted-foreground">Last updated: {lastUpdated}</p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-8">

          {/* 1 */}
          <section aria-labelledby="section-overview">
            <h2 id="section-overview" className="text-2xl font-semibold">1. Overview</h2>
            <p>
              NEXUS (&ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;) is committed to protecting your personal data in
              accordance with applicable privacy laws, including the General Data Protection
              Regulation (GDPR) and the California Consumer Privacy Act (CCPA). This policy
              explains what data we collect, why we collect it, and your rights regarding it.
            </p>
          </section>

          {/* 2 */}
          <section aria-labelledby="section-data-collected">
            <h2 id="section-data-collected" className="text-2xl font-semibold">2. Data We Collect</h2>
            <p>We collect the following categories of personal information:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Account data:</strong> name, email address, profile picture (via Clerk authentication).</li>
              <li><strong>Organisation data:</strong> organisation name, subscription tier, billing information (via Stripe).</li>
              <li><strong>Usage data:</strong> boards, lists, cards, comments, and activity logs you create within NEXUS.</li>
              <li><strong>Technical data:</strong> IP address, browser type, device information, and cookies necessary for authentication and security.</li>
              <li><strong>AI interaction data:</strong> card titles and descriptions submitted to AI features; these are sent to OpenAI and are not stored beyond the request lifetime.</li>
            </ul>
          </section>

          {/* 3 */}
          <section aria-labelledby="section-use">
            <h2 id="section-use" className="text-2xl font-semibold">3. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Provide and maintain the NEXUS service.</li>
              <li>Process payments and manage subscriptions.</li>
              <li>Send transactional notifications (e.g. card assignments, due-date reminders).</li>
              <li>Monitor platform health, detect abuse, and improve performance.</li>
              <li>Comply with legal obligations.</li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> sell your personal data to third parties.
            </p>
          </section>

          {/* 4 */}
          <section aria-labelledby="section-processors">
            <h2 id="section-processors" className="text-2xl font-semibold">4. Third-Party Processors</h2>
            <p>We engage the following sub-processors:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Clerk</strong> — authentication and user management (SOC 2 Type II).</li>
              <li><strong>Supabase</strong> — PostgreSQL database hosting (AWS us-east-1).</li>
              <li><strong>Stripe</strong> — payment processing (PCI DSS Level 1).</li>
              <li><strong>OpenAI</strong> — AI-powered card suggestions (data not used for model training).</li>
              <li><strong>Vercel</strong> — application hosting and edge delivery.</li>
              <li><strong>Sentry</strong> — error monitoring (PII scrubbing enabled).</li>
            </ul>
          </section>

          {/* 5 */}
          <section aria-labelledby="section-retention">
            <h2 id="section-retention" className="text-2xl font-semibold">5. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active. When you delete your
              account, all personal data is permanently removed within 30 days, except where
              retention is required by law (e.g. financial records retained for 7 years).
              Anonymised analytics data may be retained indefinitely.
            </p>
          </section>

          {/* 6 */}
          <section aria-labelledby="section-rights">
            <h2 id="section-rights" className="text-2xl font-semibold">6. Your Rights</h2>
            <p>Depending on your jurisdiction, you have the right to:</p>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Access</strong> the personal data we hold about you.</li>
              <li><strong>Rectification</strong> — request correction of inaccurate data.</li>
              <li><strong>Erasure</strong> (&ldquo;right to be forgotten&rdquo;) — request deletion of your data.</li>
              <li><strong>Portability</strong> — export your data in JSON or CSV format via the NEXUS export feature.</li>
              <li><strong>Restriction</strong> — restrict how we process your data in certain circumstances.</li>
              <li><strong>Objection</strong> — object to processing based on legitimate interests.</li>
              <li><strong>Withdraw consent</strong> — for consent-based processing at any time.</li>
            </ul>
            <p className="mt-3">
              To exercise your rights, email{" "}
              <a href="mailto:privacy@nexus.app" className="underline text-indigo-600 dark:text-indigo-400">
                privacy@nexus.app
              </a>
              . We will respond within 30 days.
            </p>
          </section>

          {/* 7 */}
          <section aria-labelledby="section-cookies">
            <h2 id="section-cookies" className="text-2xl font-semibold">7. Cookies</h2>
            <p>
              We use strictly necessary cookies for authentication (session tokens) and security
              (CSRF protection). We do not use advertising or tracking cookies. You may disable
              cookies in your browser settings, but this will prevent you from logging in to NEXUS.
            </p>
          </section>

          {/* 8 */}
          <section aria-labelledby="section-security">
            <h2 id="section-security" className="text-2xl font-semibold">8. Security</h2>
            <p>
              We implement industry-standard security measures including TLS 1.3 encryption in
              transit, AES-256 encryption at rest, row-level security in PostgreSQL, and regular
              vulnerability assessments. However, no system is perfectly secure; please use a
              strong, unique password.
            </p>
          </section>

          {/* 9 */}
          <section aria-labelledby="section-international">
            <h2 id="section-international" className="text-2xl font-semibold">9. International Transfers</h2>
            <p>
              Your data is processed in the United States (AWS us-east-1). Transfers from the EEA
              are governed by Standard Contractual Clauses approved by the European Commission.
            </p>
          </section>

          {/* 10 */}
          <section aria-labelledby="section-changes">
            <h2 id="section-changes" className="text-2xl font-semibold">10. Changes to This Policy</h2>
            <p>
              We may update this policy periodically. We will notify you of significant changes
              via email or an in-app notice at least 14 days before the changes take effect.
            </p>
          </section>

          {/* 11 */}
          <section aria-labelledby="section-contact">
            <h2 id="section-contact" className="text-2xl font-semibold">11. Contact</h2>
            <p>
              If you have questions about this policy or wish to exercise your rights, contact our
              Data Protection Officer at{" "}
              <a href="mailto:privacy@nexus.app" className="underline text-indigo-600 dark:text-indigo-400">
                privacy@nexus.app
              </a>
              .
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border text-sm text-muted-foreground">
          <Link href="/terms" className="underline hover:text-foreground transition-colors">
            Terms of Service
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
