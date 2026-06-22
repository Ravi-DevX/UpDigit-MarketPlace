import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | UpDigit",
  description: "How UpDigit handles marketplace account and transaction data.",
};

const sections = [
  ["Information we process", "UpDigit processes account identifiers, profile details, marketplace activity, transaction records, support messages, and technical information needed to operate and secure the service."],
  ["How information is used", "Information is used to provide accounts, process marketplace activity, deliver purchases, prevent abuse, support users, calculate seller earnings, and improve platform reliability."],
  ["Service providers", "UpDigit uses infrastructure, authentication, storage, email, and payment providers to operate the marketplace. They receive only the information required to provide those services."],
  ["Data retention", "Records are retained for as long as needed to provide the service, meet financial or legal obligations, resolve disputes, and protect the marketplace from fraud and abuse."],
  ["Your choices", "You may update available profile information from account settings and contact support regarding access, correction, or deletion requests. Some transaction records may need to be retained."],
  ["Security", "UpDigit applies access controls and technical safeguards intended to protect marketplace data. No online system can guarantee absolute security."],
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs uppercase tracking-[0.16em] text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold text-textPrimary">Privacy Policy</h1>
      <p className="mt-3 text-sm text-textSecondary">Effective June 19, 2026</p>
      <div className="mt-10 space-y-8 border-t border-border pt-8">
        {sections.map(([title, body]) => (
          <section key={title}>
            <h2 className="text-lg font-semibold text-textPrimary">{title}</h2>
            <p className="mt-2 text-sm leading-7 text-textSecondary">{body}</p>
          </section>
        ))}
        <section>
          <h2 className="text-lg font-semibold text-textPrimary">Contact</h2>
          <p className="mt-2 text-sm leading-7 text-textSecondary">Privacy requests can be sent to support@updigit.net.</p>
        </section>
      </div>
    </main>
  );
}
