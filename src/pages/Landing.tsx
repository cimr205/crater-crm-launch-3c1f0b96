import { useState } from 'react';
import { Link, useParams, Navigate } from 'react-router-dom';
import { isLocale, useI18n } from '@/lib/i18n';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowRight, TrendingUp, Users, FileText, Bot, Zap, Building2,
  Megaphone, Menu, X, Check, CreditCard, CheckCircle2, Circle,
  Receipt, ChevronDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

function Navbar({ locale, isDa }: { locale: string; isDa: boolean }) {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  if (typeof window !== 'undefined') {
    window.addEventListener('scroll', () => setScrolled(window.scrollY > 8), { passive: true });
  }

  const links = [
    { href: '#features', label: isDa ? 'Features' : 'Features' },
    { href: '#pricing', label: isDa ? 'Priser' : 'Pricing' },
    { href: '#faq', label: 'FAQ' },
  ];

  return (
    <nav className={`fixed top-0 inset-x-0 z-50 transition-all duration-200 ${
      scrolled ? 'bg-background/95 backdrop-blur-xl border-b border-border' : 'bg-transparent'
    }`}>
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="h-14 flex items-center justify-between">
          <Link to={`/${locale}`} className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-[13px]">A</span>
            </div>
            <span className="text-foreground font-semibold text-[15px] tracking-tight">
              AI Agency<span className="text-primary">.</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            {links.map(link => (
              <a key={link.href} href={link.href}
                className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <Button asChild variant="ghost" size="sm"
              className="text-[13px] h-8">
              <Link to={`/${locale}/auth/login`}>{isDa ? 'Log ind' : 'Sign in'}</Link>
            </Button>
            <Button asChild size="sm"
              className="h-8 px-4 text-[13px] font-semibold rounded-lg">
              <Link to={`/${locale}/auth/signup`}>{isDa ? 'Kom i gang' : 'Get started'}</Link>
            </Button>
          </div>

          <button className="md:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setOpen(!open)}>
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {open && (
          <div className="md:hidden py-4 border-t border-border space-y-1 bg-background">
            {links.map(link => (
              <a key={link.href} href={link.href}
                className="block text-[14px] text-muted-foreground hover:text-foreground py-2.5"
                onClick={() => setOpen(false)}>
                {link.label}
              </a>
            ))}
            <div className="flex gap-2 pt-3 border-t border-border mt-3">
              <Button asChild variant="outline" size="sm" className="flex-1">
                <Link to={`/${locale}/auth/login`}>{isDa ? 'Log ind' : 'Sign in'}</Link>
              </Button>
              <Button asChild size="sm" className="flex-1">
                <Link to={`/${locale}/auth/signup`}>{isDa ? 'Kom i gang' : 'Get started'}</Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

function Hero({ locale, isDa }: { locale: string; isDa: boolean }) {
  return (
    <section className="relative min-h-screen bg-background flex flex-col justify-center overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:48px_48px] opacity-40" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-primary/8 rounded-full blur-[140px] pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-5 lg:px-8 pt-28 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-[12px] font-medium mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
              {isDa ? 'AI-drevet platform · Bygget i Danmark' : 'AI-powered platform · Built in Denmark'}
            </div>

            <h1 className="text-[clamp(2.4rem,5vw,3.8rem)] font-bold text-foreground leading-[1.06] tracking-tight mb-6">
              {isDa ? (
                <>Ét system.<br /><span className="text-primary">Alt du behøver.</span></>
              ) : (
                <>One system.<br /><span className="text-primary">Everything you need.</span></>
              )}
            </h1>

            <p className="text-[17px] text-muted-foreground leading-relaxed mb-10 max-w-[460px]">
              {isDa
                ? 'CRM, HR, fakturering, marketing og AI-automatisering samlet ét sted. Til danske virksomheder der vil vokse uden at jonglere 8 systemer.'
                : 'CRM, HR, invoicing, marketing and AI automation in one place. For businesses ready to grow without juggling 8 different tools.'}
            </p>

            <div className="flex flex-wrap gap-3 mb-12">
              <Button asChild size="lg" className="gap-2 font-semibold">
                <Link to={`/${locale}/auth/signup`}>
                  {isDa ? 'Start gratis i dag' : 'Start for free today'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <a href="#features">
                  {isDa ? 'Se hvad det kan' : 'See what it does'}
                </a>
              </Button>
            </div>

            <div className="flex items-center gap-4 pt-6 border-t border-border">
              <div className="flex -space-x-2">
                {[
                  'bg-primary','bg-violet-500','bg-emerald-500','bg-amber-500'
                ].map((c, i) => (
                  <div key={i} className={`w-7 h-7 rounded-full border-2 border-background ${c} flex items-center justify-center text-[10px] font-bold text-white`}>
                    {['M','K','A','L'][i]}
                  </div>
                ))}
              </div>
              <p className="text-[13px] text-muted-foreground">
                <span className="text-foreground font-medium">200+</span>{' '}
                {isDa ? 'virksomheder på platformen · ' : 'companies on the platform · '}
                <span className="text-foreground/70">4.9/5</span>
              </p>
            </div>
          </div>

          {/* Product mockup */}
          <div className="hidden lg:block relative">
            <div className="relative rounded-2xl border border-border bg-card overflow-hidden shadow-2xl">
              <div className="flex items-center gap-1.5 px-4 py-3 border-b border-border bg-muted/30">
                <div className="w-2.5 h-2.5 rounded-full bg-destructive/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
                <span className="ml-3 text-[11px] font-mono text-muted-foreground">AI Agency · Dashboard</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: TrendingUp, label: isDa ? 'Pipeline' : 'Pipeline', value: 'kr 2.847.200', sub: '+24%', color: 'text-primary' },
                    { icon: Users, label: isDa ? 'Leads' : 'Leads', value: '47', sub: isDa ? '8 nye' : '8 new', color: 'text-emerald-400' },
                    { icon: Receipt, label: isDa ? 'Faktureret' : 'Invoiced', value: 'kr 487.000', sub: isDa ? '3 forfaldne' : '3 overdue', color: 'text-amber-400' },
                    { icon: Bot, label: isDa ? 'AI opgaver' : 'AI tasks', value: '142', sub: isDa ? 'denne md.' : 'this mo.', color: 'text-violet-400' },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/40 rounded-xl p-3.5 border border-border">
                      <div className="flex items-center justify-between mb-2">
                        <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
                        <span className={`text-[10px] font-mono ${s.color}`}>{s.sub}</span>
                      </div>
                      <div className="text-[18px] font-bold text-foreground leading-none mb-1">{s.value}</div>
                      <div className="text-[11px] text-muted-foreground">{s.label}</div>
                    </div>
                  ))}
                </div>

                <div className="bg-muted/30 rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-border">
                    <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                      {isDa ? 'Seneste aktivitet' : 'Recent activity'}
                    </span>
                  </div>
                  <div className="divide-y divide-border">
                    {[
                      { icon: CheckCircle2, text: isDa ? 'Sofia lukkede deal · Acme A/S' : 'Sofia closed deal · Acme A/S', val: 'kr 48.000', color: 'text-emerald-400', time: '2m' },
                      { icon: Circle, text: isDa ? 'Nyt lead: Mads Hansen · Nordics.io' : 'New lead: Mads Hansen · Nordics.io', val: '', color: 'text-primary', time: '14m' },
                      { icon: FileText, text: isDa ? 'Faktura #2847 betalt · Vector' : 'Invoice #2847 paid · Vector', val: 'kr 12.500', color: 'text-violet-400', time: '1t' },
                    ].map((a, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                        <a.icon className={`w-3.5 h-3.5 shrink-0 ${a.color}`} />
                        <span className="text-[12px] text-muted-foreground flex-1 truncate">{a.text}</span>
                        {a.val && <span className={`text-[11px] font-mono ${a.color} shrink-0`}>{a.val}</span>}
                        <span className="text-[10px] text-muted-foreground/60 font-mono shrink-0">{a.time}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute -bottom-4 -left-4 bg-card border border-border rounded-xl px-4 py-3 shadow-xl">
              <div className="flex items-center gap-2.5">
                <div className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-foreground">99.98% uptime</div>
                  <div className="text-[10px] text-muted-foreground">{isDa ? 'Alle systemer kører' : 'All systems operational'}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-20 pt-10 border-t border-border">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-muted-foreground mb-6">
            {isDa ? 'Brugt af teams hos' : 'Trusted by teams at'}
          </p>
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            {['NORDIC.IO','Lumen&Co','Kindred','Halcyon','Vector','Northwind'].map(name => (
              <span key={name} className="text-[15px] font-semibold text-muted-foreground/40 hover:text-muted-foreground transition-colors tracking-tight">
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Features({ isDa }: { isDa: boolean }) {
  const features = [
    { icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10',
      title: isDa ? 'CRM & Pipeline' : 'CRM & Pipeline',
      desc: isDa ? 'Track leads fra første kontakt til lukket deal. AI scorer dine leads automatisk og fortæller dig hvem der er klar til køb.' : 'Track leads from first touch to closed deal. AI scores leads automatically.' },
    { icon: Bot, color: 'text-violet-400', bg: 'bg-violet-500/10',
      title: isDa ? 'AI Autopilot' : 'AI Autopilot',
      desc: isDa ? 'Lad AI\'en klare rutineopgaver, besvare leads og booke møder mens du fokuserer på vækst.' : 'Let AI handle routine tasks, respond to leads and book meetings while you focus on growth.' },
    { icon: Building2, color: 'text-emerald-400', bg: 'bg-emerald-500/10',
      title: isDa ? 'HR & Medarbejdere' : 'HR & Employees',
      desc: isDa ? 'Ansæt, onboard, vagtplan, fravær og løn. Alt om dit team i ét overblik.' : 'Hire, onboard, scheduling, leave and payroll. Everything about your team in one place.' },
    { icon: FileText, color: 'text-amber-400', bg: 'bg-amber-500/10',
      title: isDa ? 'Fakturering & Økonomi' : 'Invoicing & Finance',
      desc: isDa ? 'Opret og send fakturaer direkte fra CRM. Automatiske rykkere og GDPR-klar bogføring.' : 'Create and send invoices from CRM. Automatic reminders and GDPR-ready bookkeeping.' },
    { icon: Megaphone, color: 'text-rose-400', bg: 'bg-rose-500/10',
      title: isDa ? 'Marketing & Meta Ads' : 'Marketing & Meta Ads',
      desc: isDa ? 'Lav og optimér Meta-kampagner forbundet direkte til dit CRM. Se hvilke annoncer der skaber rigtige deals.' : 'Create and optimize Meta campaigns connected to your CRM. See which ads create real deals.' },
    { icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10',
      title: isDa ? 'Automation & Workflows' : 'Automation & Workflows',
      desc: isDa ? 'Byg automatiserede workflows der kører forretningen i baggrunden. Trigger på events på tværs af alle moduler.' : 'Build automated workflows that run the business in the background across all modules.' },
  ];

  return (
    <section id="features" className="bg-background py-28 border-t border-border">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="mb-16">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
            {isDa ? '— Platformen' : '— The platform'}
          </p>
          <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold text-foreground tracking-tight leading-tight mb-4">
            {isDa ? 'Alt du nogensinde har haft brug for.' : 'Everything you\'ve ever needed.'}
          </h2>
          <p className="text-[17px] text-muted-foreground max-w-[520px] leading-relaxed">
            {isDa
              ? 'Otte moduler der taler sammen. Data flyder fra første lead til betalt faktura uden integrationer.'
              : 'Eight modules that talk to each other. Data flows from first lead to paid invoice without integrations.'}
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map(f => (
            <div key={f.title} className="group p-6 rounded-2xl border border-border bg-card hover:border-primary/30 transition-colors">
              <div className={`w-9 h-9 rounded-xl ${f.bg} flex items-center justify-center mb-5`}>
                <f.icon className={`w-4.5 h-4.5 ${f.color}`} />
              </div>
              <h3 className="text-[15px] font-semibold text-foreground mb-2">{f.title}</h3>
              <p className="text-[13.5px] text-muted-foreground leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing({ locale, isDa }: { locale: string; isDa: boolean }) {
  const included = [
    isDa ? 'CRM & Kundestyring' : 'CRM & Customer management',
    isDa ? 'HR & Medarbejdere' : 'HR & Employees',
    isDa ? 'Fakturering & Betalinger' : 'Invoicing & Payments',
    isDa ? 'Opgavestyring & Kalender' : 'Task management & Calendar',
    isDa ? 'Inbox & Kommunikation' : 'Inbox & Communication',
    isDa ? 'Marketing & Meta Ads' : 'Marketing & Meta Ads',
    isDa ? 'AI Autopilot' : 'AI Autopilot',
    isDa ? 'Workflows & Automation' : 'Workflows & Automation',
    isDa ? 'API adgang' : 'API access',
    isDa ? 'Daglige backups (EU-hosted)' : 'Daily backups (EU-hosted)',
  ];

  return (
    <section id="pricing" className="bg-background py-28 border-t border-border">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="mb-16">
          <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
            {isDa ? '— Pris' : '— Pricing'}
          </p>
          <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold text-foreground tracking-tight leading-tight mb-4">
            {isDa ? 'Én pris. Alt med. Ingen tier-spil.' : 'One price. Everything included. No tier games.'}
          </h2>
          <p className="text-[17px] text-muted-foreground">
            {isDa ? 'Fuld adgang fra dag ét — ingen skjulte gebyrer.' : 'Full access from day one — no hidden fees.'}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="bg-card border border-primary/40 rounded-2xl p-8">
            <span className="text-[11px] font-mono uppercase tracking-widest text-primary">
              {isDa ? 'Enterprise · 14 dages gratis prøve' : 'Enterprise · 14-day free trial'}
            </span>
            <div className="flex items-baseline gap-2 mt-5 mb-2">
              <span className="text-[4rem] font-bold text-foreground leading-none tracking-tight">499</span>
              <div className="pb-2">
                <div className="text-[15px] text-foreground font-semibold">kr</div>
                <div className="text-[12px] text-muted-foreground font-mono">/{isDa ? 'md' : 'mo'}</div>
              </div>
            </div>
            <p className="text-[14px] text-muted-foreground mb-8">
              {isDa ? 'pr. bruger · alle funktioner · annuller når som helst' : 'per user · all features · cancel anytime'}
            </p>
            <Button asChild size="lg" className="w-full gap-2 font-semibold">
              <Link to={`/${locale}/auth/signup`}>
                {isDa ? 'Start gratis prøve' : 'Start free trial'}
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <p className="text-center text-[12px] text-muted-foreground mt-4">
              {isDa ? 'Intet kreditkort nødvendigt' : 'No credit card required'}
            </p>
          </div>

          <div className="bg-card border border-border rounded-2xl p-8">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-6">
              {isDa ? 'Alt inkluderet:' : 'Everything included:'}
            </p>
            <ul className="space-y-3.5">
              {included.map(item => (
                <li key={item} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-primary" strokeWidth={2.5} />
                  </div>
                  <span className="text-[14px] text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function FAQ({ isDa }: { isDa: boolean }) {
  const [open, setOpen] = useState<number | null>(null);

  const faqs = isDa ? [
    { q: 'Hvad er inkluderet i prisen?', a: 'Alt. CRM, HR, Fakturering, Opgavestyring, Kalender, Inbox, AI-features og API-adgang er inkluderet i én pris pr. bruger.' },
    { q: 'Kan jeg importere data fra andre systemer?', a: 'Ja, vi understøtter CSV-import af leads, kunder og medarbejderdata. Du kan også bruge vores API til automatisk integration.' },
    { q: 'Hvor sikker er mine data?', a: 'Vi bruger enterprise-grade kryptering, daglige backups og overholder GDPR fuldt ud. Dine data er hostet i EU.' },
    { q: 'Er der en binding?', a: 'Nej, du kan opsige når som helst. Ingen binding, ingen skjulte gebyrer.' },
    { q: 'Hvad sker der med mine data hvis jeg opsiger?', a: 'Du kan eksportere alle dine data inden opsigelse. Vi sletter dine data inden 30 dage efter opsigelse i overensstemmelse med GDPR.' },
    { q: 'Kan jeg have flere brugere?', a: 'Ja. Prisen er pr. bruger — du tilføjer og fjerner brugere når det passer dig.' },
  ] : [
    { q: 'What is included in the price?', a: 'Everything. CRM, HR, Invoicing, Task management, Calendar, Inbox, AI features and API access are all included in one price per user.' },
    { q: 'Can I import data from other systems?', a: 'Yes, we support CSV import of leads, customers and employee data. You can also use our API for automatic integration.' },
    { q: 'How secure is my data?', a: 'We use enterprise-grade encryption, daily backups and are fully GDPR compliant. Your data is hosted in the EU.' },
    { q: 'Is there a commitment?', a: 'No, you can cancel at any time. No commitment, no hidden fees.' },
    { q: 'What happens to my data if I cancel?', a: 'You can export all your data before cancellation. We delete your data within 30 days of cancellation in accordance with GDPR.' },
    { q: 'Can I have multiple users?', a: 'Yes. The price is per user — add and remove users whenever you need.' },
  ];

  return (
    <section id="faq" className="bg-background py-28 border-t border-border">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-16">
          <div>
            <p className="text-[11px] font-mono uppercase tracking-[0.2em] text-primary mb-4">
              {isDa ? '— FAQ' : '— FAQ'}
            </p>
            <h2 className="text-[clamp(1.6rem,3vw,2.4rem)] font-bold text-foreground tracking-tight leading-tight mb-4">
              {isDa ? 'Spørgsmål vi faktisk får.' : 'Questions we actually get.'}
            </h2>
            <p className="text-[14px] text-muted-foreground leading-relaxed">
              {isDa
                ? 'Stadig i tvivl? Skriv til os — vi svarer inden for en time på hverdage.'
                : 'Still unsure? Write to us — we respond within an hour on weekdays.'}
            </p>
          </div>

          <div className="lg:col-span-2 border-t border-border">
            {faqs.map((faq, i) => (
              <div key={i} className="border-b border-border">
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  className="w-full flex items-center justify-between gap-4 py-5 text-left group">
                  <span className="text-[15px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {faq.q}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open === i ? 'rotate-180' : ''}`} />
                </button>
                {open === i && (
                  <div className="pb-5 text-[14px] text-muted-foreground leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function CTA({ locale, isDa }: { locale: string; isDa: boolean }) {
  return (
    <section className="bg-background py-28 border-t border-border">
      <div className="max-w-6xl mx-auto px-5 lg:px-8 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold text-foreground tracking-tight mb-4">
            {isDa ? 'Klar til at automatisere din forretning?' : 'Ready to automate your business?'}
          </h2>
          <p className="text-[17px] text-muted-foreground mb-8">
            {isDa
              ? 'Start din gratis 14-dages prøve i dag — intet kreditkort nødvendigt.'
              : 'Start your free 14-day trial today — no credit card required.'}
          </p>
          <Button asChild size="lg" className="gap-2 font-semibold px-8">
            <Link to={`/${locale}/auth/signup`}>
              {isDa ? 'Kom i gang gratis' : 'Get started for free'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Footer({ locale, isDa }: { locale: string; isDa: boolean }) {
  return (
    <footer className="bg-card border-t border-border py-16">
      <div className="max-w-6xl mx-auto px-5 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-[13px]">A</span>
              </div>
              <span className="text-foreground font-semibold">AI Agency<span className="text-primary">.</span></span>
            </div>
            <p className="text-[13px] text-muted-foreground leading-relaxed max-w-[200px]">
              {isDa ? 'Bygget i Danmark. Til virksomheder der vil mere.' : 'Built in Denmark. For companies that want more.'}
            </p>
          </div>

          {[
            { title: isDa ? 'Produkt' : 'Product', links: [
              { label: 'Features', href: '#features' },
              { label: isDa ? 'Priser' : 'Pricing', href: '#pricing' },
              { label: 'FAQ', href: '#faq' },
            ]},
            { title: isDa ? 'Konto' : 'Account', links: [
              { label: isDa ? 'Opret konto' : 'Sign up', href: `/${locale}/auth/signup` },
              { label: isDa ? 'Log ind' : 'Sign in', href: `/${locale}/auth/login` },
            ]},
            { title: isDa ? 'Legal' : 'Legal', links: [
              { label: isDa ? 'Privatlivspolitik' : 'Privacy policy', href: `/${locale}/privacy` },
              { label: isDa ? 'Vilkår' : 'Terms', href: `/${locale}/terms` },
            ]},
          ].map(col => (
            <div key={col.title}>
              <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground/60 mb-4">{col.title}</p>
              <ul className="space-y-3">
                {col.links.map(l => (
                  <li key={l.label}>
                    {l.href.startsWith('/') ? (
                      <Link to={l.href} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link>
                    ) : (
                      <a href={l.href} className="text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">{l.label}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between gap-4">
          <p className="text-[12px] text-muted-foreground">© 2026 AI Agency Danmark · CVR: 45949923</p>
          <p className="text-[12px] text-muted-foreground">
            {isDa ? 'Data hostet i EU · GDPR-kompatibel' : 'Data hosted in EU · GDPR compliant'}
          </p>
        </div>
      </div>
    </footer>
  );
}

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
      <Pricing locale={locale} isDa={isDa} />
      <FAQ isDa={isDa} />
      <CTA locale={locale} isDa={isDa} />
      <Footer locale={locale} isDa={isDa} />
    </div>
  );
}
