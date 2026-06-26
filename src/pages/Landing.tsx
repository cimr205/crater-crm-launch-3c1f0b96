import { useEffect, useRef, useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { isLocale } from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowRight, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/* ── Navbar ── */
function Navbar({ locale, isDa }: { locale: string; isDa: boolean }) {
  const [open, setOpen] = useState(false);
  const [top, setTop] = useState(true);
  useEffect(() => {
    const fn = () => setTop(window.scrollY < 16);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <nav className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${top ? '' : 'bg-background/96 backdrop-blur-md border-b border-border'}`}>
      <div className="max-w-[1120px] mx-auto px-6 h-[60px] flex items-center justify-between">
        <Link to={`/${locale}`} className="text-[15px] font-semibold tracking-tight text-foreground">
          AI Agency<span className="text-primary">.</span>dk
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {[
            { href: '#hvad', label: isDa ? 'Funktioner' : 'Features' },
            { href: '#pris', label: isDa ? 'Pris' : 'Pricing' },
            { href: '#faq', label: 'FAQ' },
          ].map(l => (
            <a key={l.href} href={l.href} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link to={`/${locale}/auth/login`} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">
            {isDa ? 'Log ind' : 'Sign in'}
          </Link>
          <Link
            to={`/${locale}/auth/signup`}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-[8px] bg-foreground text-background text-[13px] font-semibold hover:bg-foreground/90 transition-colors"
          >
            {isDa ? 'Start gratis' : 'Start free'}
          </Link>
        </div>

        <button className="md:hidden text-foreground" onClick={() => setOpen(!open)}>
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-background border-b border-border px-6 pb-6 space-y-4">
          {[
            { href: '#hvad', label: isDa ? 'Funktioner' : 'Features' },
            { href: '#pris', label: isDa ? 'Pris' : 'Pricing' },
            { href: '#faq', label: 'FAQ' },
          ].map(l => (
            <a key={l.href} href={l.href} className="block text-[15px] text-muted-foreground" onClick={() => setOpen(false)}>
              {l.label}
            </a>
          ))}
          <div className="pt-4 border-t border-border flex flex-col gap-2">
            <Link to={`/${locale}/auth/login`} className="text-center text-[14px] text-muted-foreground">
              {isDa ? 'Log ind' : 'Sign in'}
            </Link>
            <Link
              to={`/${locale}/auth/signup`}
              className="block text-center px-4 py-3 rounded-[8px] bg-foreground text-background text-[14px] font-semibold"
            >
              {isDa ? 'Start gratis' : 'Start free'}
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ── Hero ── */
function Hero({ locale, isDa }: { locale: string; isDa: boolean }) {
  return (
    <section className="min-h-screen flex flex-col justify-center bg-background pt-[60px]">
      <div className="max-w-[1120px] mx-auto px-6 py-24 lg:py-32">

        <p className="font-mono text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-10">
          {isDa ? 'Bygget i Danmark — Klar til din virksomhed' : 'Built in Denmark — Ready for your business'}
        </p>

        <h1 className="text-[clamp(3rem,7.5vw,6.5rem)] font-extrabold leading-[0.95] tracking-[-0.03em] text-foreground max-w-[14ch] mb-10">
          {isDa ? (
            <>Ét system.<br />Hele<br /><span className="text-primary">forretningen.</span></>
          ) : (
            <>One system.<br />The whole<br /><span className="text-primary">business.</span></>
          )}
        </h1>

        <p className="text-[18px] text-muted-foreground max-w-[500px] leading-[1.6] mb-12">
          {isDa
            ? 'CRM, HR, fakturering, marketing og AI-automatisering. Ikke otte systemer — ét.'
            : 'CRM, HR, invoicing, marketing and AI automation. Not eight tools — one.'}
        </p>

        <div className="flex flex-wrap items-center gap-4 mb-20">
          <Link
            to={`/${locale}/auth/signup`}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[10px] bg-primary text-primary-foreground text-[15px] font-semibold hover:bg-primary/90 transition-colors"
          >
            {isDa ? 'Start gratis i dag' : 'Start for free today'}
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#hvad" className="text-[14px] text-muted-foreground hover:text-foreground transition-colors underline underline-offset-4 decoration-border">
            {isDa ? 'Se hvad det kan →' : 'See what it does →'}
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-border rounded-[12px] overflow-hidden">
          {[
            { n: '200+', label: isDa ? 'Virksomheder' : 'Companies' },
            { n: '4.9', label: isDa ? 'Gennemsnitlig rating' : 'Average rating' },
            { n: '99.98%', label: isDa ? 'Oppetid' : 'Uptime' },
            { n: isDa ? '14 dage' : '14 days', label: isDa ? 'Gratis prøve' : 'Free trial' },
          ].map((s, i) => (
            <div key={i} className={`px-6 py-5 ${i < 3 ? 'border-r border-border' : ''} ${i >= 2 ? 'border-t md:border-t-0 border-border' : ''}`}>
              <div className="text-[1.6rem] font-bold text-foreground font-mono leading-none mb-1">{s.n}</div>
              <div className="text-[12px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-[1120px] mx-auto px-6 py-5 flex flex-wrap items-center gap-x-10 gap-y-2">
          <span className="text-[11px] font-mono uppercase tracking-[0.18em] text-muted-foreground/50">
            {isDa ? 'Brugt af' : 'Used by'}
          </span>
          {['Nordic.io', 'Lumen & Co', 'Kindred', 'Halcyon', 'Vector', 'Northwind'].map(n => (
            <span key={n} className="text-[14px] font-medium text-muted-foreground/40 tracking-tight hover:text-muted-foreground/70 transition-colors cursor-default">
              {n}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Feature list ── */
function Features({ isDa }: { isDa: boolean }) {
  const items = isDa ? [
    { n: '01', title: 'CRM & Salgspipeline', body: 'Spor leads fra første kontakt til lukket deal. AI-scoring identificerer hvem der er klar til at købe — ingen manuel gætteri.' },
    { n: '02', title: 'AI Autopilot', body: 'Besvarer leads, booker møder og opretter opfølgningsopgaver automatisk. Kører 24/7 i baggrunden uden at du løfter en finger.' },
    { n: '03', title: 'Fakturering & Betaling', body: 'Opret fakturaer direkte fra et deal. Automatiske rykkere, EU-moms-regler og betalingsoversigt med ét klik.' },
    { n: '04', title: 'HR & Medarbejdere', body: 'Ansættelse, onboarding, vagtplanlægning, ferieansøgninger og løn samlet ét sted — for dig og dit team.' },
    { n: '05', title: 'Marketing & Meta Ads', body: 'Forbind dine Meta-kampagner direkte til CRM. Se præcis hvilke annoncer der skaber rigtige deals — ikke blot klik.' },
    { n: '06', title: 'Workflows & Automation', body: 'Byg trigger-baserede workflows på tværs af alle moduler. Når en faktura forfalder, en lead kvalificeres eller en medarbejder ansættes.' },
  ] : [
    { n: '01', title: 'CRM & Sales pipeline', body: 'Track leads from first contact to closed deal. AI scoring identifies who is ready to buy — no manual guessing.' },
    { n: '02', title: 'AI Autopilot', body: 'Responds to leads, books meetings and creates follow-up tasks automatically. Runs 24/7 in the background.' },
    { n: '03', title: 'Invoicing & Payments', body: 'Create invoices directly from a deal. Automatic reminders, EU VAT rules and payment overview in one click.' },
    { n: '04', title: 'HR & Employees', body: 'Hiring, onboarding, scheduling, leave requests and payroll in one place — for you and your team.' },
    { n: '05', title: 'Marketing & Meta Ads', body: 'Connect your Meta campaigns directly to CRM. See exactly which ads create real deals — not just clicks.' },
    { n: '06', title: 'Workflows & Automation', body: 'Build trigger-based workflows across all modules. When an invoice is overdue, a lead qualifies or an employee is hired.' },
  ];

  return (
    <section id="hvad" className="bg-background border-t border-border">
      <div className="max-w-[1120px] mx-auto px-6 py-20 lg:py-28">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-foreground max-w-[16ch]">
            {isDa ? 'Hvad det faktisk kan.' : 'What it actually does.'}
          </h2>
          <p className="text-[15px] text-muted-foreground max-w-[340px] leading-[1.65]">
            {isDa
              ? 'Alle modulerne er bygget til at virke sammen fra dag ét. Ingen integrationer. Ingen CSV-eksport.'
              : 'All modules are built to work together from day one. No integrations. No CSV exports.'}
          </p>
        </div>

        <div className="border-t border-border">
          {items.map((item, i) => (
            <div key={i} className="group border-b border-border py-8 md:py-10 flex flex-col md:flex-row md:items-start gap-4 md:gap-12 cursor-default">
              <span className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground/40 shrink-0 md:w-10 md:mt-1">
                {item.n}
              </span>
              <h3 className="text-[1.25rem] md:text-[1.45rem] font-bold text-foreground tracking-tight leading-snug md:w-[280px] shrink-0 group-hover:text-primary transition-colors">
                {item.title}
              </h3>
              <p className="text-[15px] text-muted-foreground leading-[1.7] max-w-[520px]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ── */
function Testimonials({ isDa }: { isDa: boolean }) {
  const quotes = isDa ? [
    { text: 'Vi lukkede vores tre andre systemer inden for den første uge. Det er sjældent man sparer tid OG penge dag ét.', name: 'Mads Larsen', role: 'CEO, Nordic.io' },
    { text: 'Faktureringen alene har sparet os for mindst 6 timer om måneden. Nu er den integreret direkte i vores pipeline.', name: 'Sofie Kvist', role: 'COO, Kindred A/S' },
    { text: 'Meta Ads forbundet direkte til CRM ændrede alt. Vi kan nu se præcis hvilke leads der konverterer til kunder.', name: 'Anders Holm', role: 'Marketing Director, Vector' },
  ] : [
    { text: 'We closed our three other systems within the first week. It\'s rare to save both time AND money on day one.', name: 'Mads Larsen', role: 'CEO, Nordic.io' },
    { text: 'Invoicing alone has saved us at least 6 hours per month. Now it\'s integrated directly into our pipeline.', name: 'Sofie Kvist', role: 'COO, Kindred A/S' },
    { text: 'Meta Ads connected directly to CRM changed everything. We can now see exactly which leads convert to customers.', name: 'Anders Holm', role: 'Marketing Director, Vector' },
  ];

  return (
    <section className="bg-background border-t border-border">
      <div className="max-w-[1120px] mx-auto px-6 py-20 lg:py-28">
        <div className="grid md:grid-cols-3 gap-0 border border-border rounded-[12px] overflow-hidden">
          {quotes.map((q, i) => (
            <div key={i} className={`p-8 lg:p-10 ${i < 2 ? 'border-b md:border-b-0 md:border-r border-border' : ''}`}>
              <p className="text-[16px] leading-[1.75] text-foreground mb-8 font-light">
                &ldquo;{q.text}&rdquo;
              </p>
              <div>
                <div className="text-[13.5px] font-semibold text-foreground">{q.name}</div>
                <div className="text-[12px] text-muted-foreground mt-0.5">{q.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Pricing ── */
function Pricing({ locale, isDa }: { locale: string; isDa: boolean }) {
  const included = isDa ? [
    'CRM & Kundestyring',
    'HR & Medarbejderstyring',
    'Fakturering & Betalingsoverblik',
    'Opgavestyring & Kalender',
    'Inbox & Email-kommunikation',
    'Marketing & Meta Ads-integration',
    'AI Autopilot & AI Chat',
    'Workflows & Automation-builder',
    'Prospektmotor & CVR-søgning',
    'API-adgang & Webhook-support',
    'Daglige backups · EU-hosted · GDPR',
  ] : [
    'CRM & Customer management',
    'HR & Employee management',
    'Invoicing & Payment overview',
    'Task management & Calendar',
    'Inbox & Email communication',
    'Marketing & Meta Ads integration',
    'AI Autopilot & AI Chat',
    'Workflows & Automation builder',
    'Prospect engine & VAT lookup',
    'API access & Webhook support',
    'Daily backups · EU-hosted · GDPR',
  ];

  return (
    <section id="pris" className="bg-background border-t border-border">
      <div className="max-w-[1120px] mx-auto px-6 py-20 lg:py-28">
        <div className="grid lg:grid-cols-[1fr_440px] gap-16 lg:gap-24 items-start">
          <div>
            <h2 className="text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-[1.02] tracking-[-0.025em] text-foreground mb-6">
              {isDa ? 'Én pris.\nAlt med.' : 'One price.\nEverything in.'}
            </h2>
            <p className="text-[15px] text-muted-foreground leading-[1.7] mb-10 max-w-[400px]">
              {isDa
                ? 'Ingen starter-plan. Ingen add-ons. Ingen overraskelser på fakturaen. Fuld adgang fra dag ét.'
                : 'No starter plan. No add-ons. No surprises on the invoice. Full access from day one.'}
            </p>

            <div className="mb-8">
              <div className="flex items-end gap-3 mb-2">
                <span className="text-[5rem] font-extrabold text-foreground leading-none tracking-tight font-mono">499</span>
                <div className="pb-3">
                  <div className="text-[16px] font-bold text-foreground">kr.</div>
                  <div className="text-[13px] text-muted-foreground font-mono">
                    {isDa ? '/bruger/md' : '/user/mo'}
                  </div>
                </div>
              </div>
              <p className="text-[13px] text-muted-foreground font-mono">
                {isDa ? '14 dage gratis · Annuller når som helst · Intet kreditkort' : '14 days free · Cancel anytime · No credit card'}
              </p>
            </div>

            <Link
              to={`/${locale}/auth/signup`}
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-[10px] bg-primary text-primary-foreground text-[15px] font-semibold hover:bg-primary/90 transition-colors"
            >
              {isDa ? 'Start gratis prøve' : 'Start free trial'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="border border-border rounded-[12px] overflow-hidden">
            <div className="px-6 py-4 border-b border-border">
              <span className="font-mono text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                {isDa ? 'Inkluderet' : 'Included'}
              </span>
            </div>
            <ul>
              {included.map((item, i) => (
                <li key={i} className={`flex items-center gap-4 px-6 py-3.5 ${i < included.length - 1 ? 'border-b border-border' : ''}`}>
                  <span className="w-1 h-1 rounded-full bg-primary shrink-0" />
                  <span className="text-[13.5px] text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── FAQ ── */
function FAQ({ isDa }: { isDa: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  const faqs = isDa ? [
    { q: 'Hvad er inkluderet?', a: 'Alt. CRM, HR, fakturering, marketing, AI og API-adgang. Én pris, ingen add-ons.' },
    { q: 'Kan jeg importere mine eksisterende data?', a: 'Ja, vi understøtter CSV-import for leads, kunder og medarbejderdata. API giver fuld automatisk integration.' },
    { q: 'Hvad med GDPR og datasikkerhed?', a: 'Enterprise-grade kryptering, daglige backups, hostet i EU. Fuldt GDPR-kompatibelt.' },
    { q: 'Er der binding eller minimum-perioder?', a: 'Ingen binding. Måned til måned. Annuller med én knap.' },
    { q: 'Hvad sker der med mine data ved opsigelse?', a: 'Du eksporterer dine data. Vi sletter dem inden 30 dage efter opsigelse, jf. GDPR.' },
    { q: 'Kan jeg have mange brugere?', a: 'Ja — prisen er pr. bruger. Tilføj og fjern folk løbende.' },
  ] : [
    { q: 'What is included?', a: 'Everything. CRM, HR, invoicing, marketing, AI and API access. One price, no add-ons.' },
    { q: 'Can I import my existing data?', a: 'Yes, we support CSV import for leads, customers and employee data. API gives full automatic integration.' },
    { q: 'What about GDPR and data security?', a: 'Enterprise-grade encryption, daily backups, hosted in EU. Fully GDPR compliant.' },
    { q: 'Are there contracts or minimum periods?', a: 'No contracts. Month to month. Cancel with one click.' },
    { q: 'What happens to my data if I cancel?', a: 'You export your data. We delete it within 30 days of cancellation per GDPR.' },
    { q: 'Can I have many users?', a: 'Yes — the price is per user. Add and remove people as you go.' },
  ];

  return (
    <section id="faq" className="bg-background border-t border-border">
      <div className="max-w-[1120px] mx-auto px-6 py-20 lg:py-28">
        <div className="grid lg:grid-cols-[280px_1fr] gap-16">
          <div>
            <h2 className="text-[1.8rem] font-extrabold tracking-tight text-foreground mb-3">FAQ</h2>
            <p className="text-[14px] text-muted-foreground leading-[1.65]">
              {isDa
                ? 'Spørgsmål? Skriv til os — vi svarer inden for en time på hverdage.'
                : 'Questions? Write to us — we respond within an hour on weekdays.'}
            </p>
          </div>

          <div>
            {faqs.map((f, i) => (
              <div key={i} className={`border-t border-border ${i === faqs.length - 1 ? 'border-b' : ''}`}>
                <button
                  className="w-full text-left py-5 flex items-start justify-between gap-6"
                  onClick={() => setOpen(open === i ? null : i)}
                >
                  <span className={`text-[15px] font-medium transition-colors ${open === i ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    {f.q}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[18px] leading-none mt-0.5">
                    {open === i ? '−' : '+'}
                  </span>
                </button>
                {open === i && (
                  <p className="pb-5 text-[14px] text-muted-foreground leading-[1.7] max-w-[560px]">
                    {f.a}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── CTA ── */
function CTA({ locale, isDa }: { locale: string; isDa: boolean }) {
  return (
    <section className="bg-background border-t border-border">
      <div className="max-w-[1120px] mx-auto px-6 py-24 lg:py-36">
        <div className="max-w-[700px]">
          <h2 className="text-[clamp(2.4rem,5vw,4.5rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-foreground mb-8">
            {isDa
              ? <>Klar til at<br /><span className="text-primary">samle det hele</span><br />ét sted?</>
              : <>Ready to bring<br /><span className="text-primary">it all together</span><br />in one place?</>}
          </h2>
          <p className="text-[16px] text-muted-foreground mb-10 leading-[1.65]">
            {isDa
              ? '14 dages gratis prøve. Ingen kreditkort. Ingen binding. Kom i gang på under 5 minutter.'
              : '14-day free trial. No credit card. No commitment. Get started in under 5 minutes.'}
          </p>
          <Link
            to={`/${locale}/auth/signup`}
            className="inline-flex items-center gap-2 px-7 py-4 rounded-[10px] bg-primary text-primary-foreground text-[15px] font-semibold hover:bg-primary/90 transition-colors"
          >
            {isDa ? 'Opret gratis konto' : 'Create free account'}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ── Footer ── */
function Footer({ locale, isDa }: { locale: string; isDa: boolean }) {
  return (
    <footer className="border-t border-border">
      <div className="max-w-[1120px] mx-auto px-6 py-12">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          <div className="max-w-[220px]">
            <div className="text-[15px] font-semibold text-foreground mb-3">
              AI Agency<span className="text-primary">.</span>dk
            </div>
            <p className="text-[13px] text-muted-foreground leading-[1.7]">
              {isDa ? 'Bygget i Danmark. CVR: 45949923.' : 'Built in Denmark. CVR: 45949923.'}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-16 gap-y-8">
            {[
              { heading: isDa ? 'Produkt' : 'Product', links: [
                { l: isDa ? 'Funktioner' : 'Features', h: '#hvad' },
                { l: isDa ? 'Priser' : 'Pricing', h: '#pris' },
                { l: 'FAQ', h: '#faq' },
              ]},
              { heading: isDa ? 'Konto' : 'Account', links: [
                { l: isDa ? 'Log ind' : 'Sign in', h: `/${locale}/auth/login` },
                { l: isDa ? 'Opret konto' : 'Sign up', h: `/${locale}/auth/signup` },
              ]},
              { heading: isDa ? 'Legal' : 'Legal', links: [
                { l: isDa ? 'Privatlivspolitik' : 'Privacy', h: `/${locale}/privacy` },
                { l: isDa ? 'Vilkår' : 'Terms', h: `/${locale}/terms` },
              ]},
            ].map(col => (
              <div key={col.heading}>
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50 mb-4">{col.heading}</div>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.l}>
                      {link.h.startsWith('/') ? (
                        <Link to={link.h} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">{link.l}</Link>
                      ) : (
                        <a href={link.h} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">{link.l}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-border flex flex-col sm:flex-row justify-between gap-3">
          <p className="text-[12px] text-muted-foreground font-mono">© 2026 AI Agency Danmark</p>
          <p className="text-[12px] text-muted-foreground font-mono">
            {isDa ? 'EU-hostet · GDPR-kompatibel' : 'EU-hosted · GDPR compliant'}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ── Root ── */
export default function Landing() {
  const params = useParams();
  const locale = isLocale(params.locale) ? params.locale : 'en';
  const isDa = locale === 'da';
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && isAuthenticated) {
    return <Navigate to={`/${locale}/app/dashboard`} replace />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar locale={locale} isDa={isDa} />
      <Hero locale={locale} isDa={isDa} />
      <Features isDa={isDa} />
      <Testimonials isDa={isDa} />
      <Pricing locale={locale} isDa={isDa} />
      <FAQ isDa={isDa} />
      <CTA locale={locale} isDa={isDa} />
      <Footer locale={locale} isDa={isDa} />
    </div>
  );
}
