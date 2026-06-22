import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | UpDigit",
  description: "Terms governing use of the UpDigit marketplace.",
};

const sections = [
  ["Marketplace accounts", "You are responsible for your account activity and for keeping your authentication credentials secure. Information submitted to UpDigit must be accurate and current."],
  ["Products and licenses", "Digital products are provided under the license shown on their product page. Buyers may not redistribute, resell, or share purchased files unless that license explicitly permits it."],
  ["Seller responsibilities", "Sellers must own or have permission to distribute everything they publish. Products must be accurately described, functional as represented, and free from malicious or unauthorized content."],
  ["Payments and refunds", "Prices, fees, taxes, and refund eligibility are displayed during checkout or in the applicable marketplace policy. Payment disputes may result in temporary restrictions while they are investigated."],
  ["Moderation", "UpDigit may review, reject, suspend, or remove accounts and products that violate marketplace rules, applicable law, intellectual-property rights, or platform security requirements."],
  ["Service availability", "The marketplace is provided on an as-available basis. Features may change as the platform develops, and temporary interruptions may occur for maintenance or operational reasons."],
];

export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-xs uppercase tracking-[0.16em] text-primary">Legal</p>
      <h1 className="mt-2 text-3xl font-semibold text-textPrimary">Terms of Service</h1>
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
          <p className="mt-2 text-sm leading-7 text-textSecondary">Questions about these terms can be sent to support@updigit.net.</p>
        </section>
      </div>
    </main>
  );
}
