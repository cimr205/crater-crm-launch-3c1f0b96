/**
 * INDUSTRY INTENT MAP
 * Maps high-level user intent categories to specific trade/industry keywords.
 * Used by Lead Generation to expand "craftsmen" → ["carpenter", "plumber", "electrician", ...]
 * so we match on BUSINESS CATEGORY, not just company name.
 */

export const INDUSTRY_MAP: Record<string, string[]> = {
  // ── Trades / Craftsmen ───────────────────────────────────────────────────────
  håndværker: [
    'tømrer', 'snedker', 'murer', 'blikkenslager', 'elektriker', 'el-installatør',
    'vvs', 'vvs-installatør', 'maler', 'gulvlægger', 'tagdækker', 'glarmester',
    'smed', 'anlægsgartner', 'entreprenør', 'byggefirma', 'stilladsbygger',
    'kloakmester', 'tækkemand', 'facaderenovering', 'renovering', 'isolatør',
  ],
  craftsmen: [
    'carpenter', 'joiner', 'bricklayer', 'plumber', 'electrician', 'painter',
    'roofer', 'glazier', 'blacksmith', 'landscaper', 'contractor', 'builder',
    'scaffolding', 'flooring', 'insulation', 'renovation', 'construction',
  ],
  handwerker: [
    'zimmermann', 'maurer', 'elektriker', 'klempner', 'maler', 'dachdecker',
    'glaser', 'schlosser', 'gärtner', 'bauunternehmer', 'renovierung', 'bau',
  ],
  bygg: [
    'byggentreprenör', 'elektriker', 'rörmokare', 'målare', 'snickare',
    'plåtslagare', 'golvläggare', 'takläggare', 'gartner', 'byggföretag',
  ],

  // ── Restaurants / Food ───────────────────────────────────────────────────────
  restaurant: [
    'restaurant', 'café', 'bistro', 'pizzeria', 'sushi', 'takeaway', 'catering',
    'bager', 'konditori', 'bar', 'kro', 'bodega', 'fastfood', 'burger', 'thai',
    'kebab', 'indisk', 'kinesisk', 'smørrebrød', 'gastropub',
  ],

  // ── Transport / Logistics ────────────────────────────────────────────────────
  transport: [
    'vognmand', 'speditør', 'fragtmand', 'taxa', 'flyttefirma', 'kurér',
    'busvognmand', 'logistik', 'distribution', 'varetransport', 'lastbil',
    'shipping', 'spedition', 'lagerlogistik',
  ],
  logistics: [
    'logistics', 'freight', 'haulage', 'courier', 'distribution', 'warehouse',
    'shipping', 'transport', 'removal', 'trucking', 'cargo',
  ],

  // ── Cleaning / Facility ──────────────────────────────────────────────────────
  rengøring: [
    'rengøring', 'rengøringsservice', 'facility management', 'vinduespolering',
    'erhvervsrengøring', 'hjemmerengøring', 'kontorrengøring', 'servicevirksomhed',
  ],
  cleaning: [
    'cleaning', 'janitorial', 'facilities', 'window cleaning', 'office cleaning',
    'domestic cleaning', 'property maintenance', 'hygiene services',
  ],

  // ── IT / Tech ────────────────────────────────────────────────────────────────
  it: [
    'softwareudvikling', 'it-konsulent', 'webbureau', 'it-support', 'app-udvikling',
    'systemintegration', 'hosting', 'digitalbureau', 'netværk', 'cybersikkerhed',
    'cloud', 'saas', 'e-handel', 'hjemmeside', 'seo', 'it-drift',
  ],
  tech: [
    'software', 'it consulting', 'web agency', 'app development', 'cloud services',
    'cybersecurity', 'digital agency', 'saas', 'e-commerce', 'devops', 'network',
  ],

  // ── Health / Medical ─────────────────────────────────────────────────────────
  sundhed: [
    'tandlæge', 'fysioterapeut', 'kiropraktor', 'psykolog', 'læge', 'klinik',
    'optiker', 'fodterapeut', 'ergoterapeut', 'sundhedsklinik', 'massageklinik',
    'akupunktur', 'zoneterapeut', 'hospital', 'lægepraksis',
  ],
  health: [
    'dentist', 'physiotherapist', 'chiropractor', 'psychologist', 'doctor', 'clinic',
    'optician', 'podiatrist', 'health center', 'massage', 'acupuncture', 'gp',
  ],

  // ── Retail / Commerce ────────────────────────────────────────────────────────
  detail: [
    'butik', 'forhandler', 'grossist', 'webshop', 'detailhandel', 'tøjbutik',
    'skobutik', 'elektronik', 'møbelforhandler', 'sportsbutik', 'hobby',
    'isenkram', 'legetøj', 'boligindretning',
  ],
  retail: [
    'retail', 'shop', 'store', 'dealer', 'wholesaler', 'ecommerce', 'boutique',
    'fashion', 'electronics', 'furniture', 'sports goods', 'toy store',
  ],

  // ── Finance / Accounting ─────────────────────────────────────────────────────
  finans: [
    'revisor', 'bogfører', 'regnskabskontor', 'finansrådgivning', 'forsikring',
    'inkasso', 'pension', 'investering', 'økonomi', 'bankkonsulent', 'leasingselskab',
  ],
  finance: [
    'accountant', 'bookkeeper', 'financial advisor', 'insurance', 'investment',
    'pension', 'auditor', 'tax advisor', 'chartered accountant', 'cpa',
  ],

  // ── Real Estate ──────────────────────────────────────────────────────────────
  ejendom: [
    'ejendomsmægler', 'boligudlejning', 'ejendomsadministration', 'boligforening',
    'ejendomsservice', 'ejendomsinvestering', 'bygherre', 'developer', 'property',
  ],
  'real estate': [
    'estate agent', 'property management', 'letting agent', 'real estate',
    'housing association', 'property developer', 'surveyor',
  ],

  // ── Marketing / Agencies ─────────────────────────────────────────────────────
  marketing: [
    'reklamebureau', 'marketingbureau', 'pr-bureau', 'mediebureau', 'grafisk design',
    'content', 'social media', 'seo-bureau', 'performance marketing', 'brandingbureau',
    'kommunikationsbureau', 'eventbureau',
  ],
  agency: [
    'marketing agency', 'advertising agency', 'pr agency', 'media agency',
    'design studio', 'creative agency', 'branding', 'content agency',
    'social media agency', 'seo agency', 'event agency',
  ],

  // ── Legal ────────────────────────────────────────────────────────────────────
  advokat: [
    'advokatfirma', 'advokat', 'juridisk rådgivning', 'ret', 'advokatkreds',
    'skatteadvokat', 'erhvervsadvokat', 'familieadvokat',
  ],
  legal: [
    'law firm', 'solicitor', 'barrister', 'attorney', 'legal counsel',
    'corporate law', 'tax law', 'employment law', 'notary',
  ],

  // ── Education / Training ─────────────────────────────────────────────────────
  uddannelse: [
    'skole', 'kursus', 'uddannelsescenter', 'efteruddannelse', 'sprogskole',
    'erhvervsskole', 'højskole', 'konsulentvirksomhed', 'coaching', 'mentor',
  ],
  education: [
    'school', 'training center', 'language school', 'coaching', 'consultant',
    'corporate training', 'e-learning', 'tutoring', 'academy',
  ],

  // ── Beauty / Wellness ────────────────────────────────────────────────────────
  skønhed: [
    'frisør', 'skønhedssalon', 'negle', 'makeup', 'tatovering', 'piercing',
    'solcenter', 'spa', 'wellness', 'kosmetolog', 'vippeforlænger',
  ],
  beauty: [
    'hairdresser', 'beauty salon', 'nail salon', 'tattoo', 'piercing',
    'tanning', 'spa', 'wellness center', 'cosmetologist', 'barbershop',
  ],

  // ── Security ─────────────────────────────────────────────────────────────────
  sikkerhed: [
    'sikkerhedsfirma', 'vagtfirma', 'alarmsystemer', 'overvågning',
    'låsesmed', 'adgangskontrol', 'brandvæsen', 'brandalarmsystem',
  ],
  security: [
    'security company', 'guard service', 'alarm systems', 'surveillance',
    'locksmith', 'access control', 'fire safety', 'cctv',
  ],
};

/** All aliases → canonical keys for reverse lookup */
const ALIAS_MAP: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  for (const [key, aliases] of Object.entries(INDUSTRY_MAP)) {
    map[key.toLowerCase()] = key;
    for (const alias of aliases) {
      map[alias.toLowerCase()] = key;
    }
  }
  return map;
})();

/**
 * Expand a user-supplied category string into a list of industry keywords.
 * Example: expandIndustry("håndværkere") → ["tømrer","murer","elektriker",...]
 */
export function expandIndustry(category: string): string[] {
  const normalized = category.toLowerCase().trim()
    // Remove common Danish plural suffixes
    .replace(/er$/, '')
    .replace(/erne$/, '')
    .replace(/ene$/, '');

  // 1. Direct key match
  if (INDUSTRY_MAP[normalized]) return INDUSTRY_MAP[normalized];

  // 2. Alias/keyword reverse lookup
  const canonical = ALIAS_MAP[normalized];
  if (canonical && INDUSTRY_MAP[canonical]) return INDUSTRY_MAP[canonical];

  // 3. Partial match on keys
  for (const key of Object.keys(INDUSTRY_MAP)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return INDUSTRY_MAP[key];
    }
  }

  // 4. Fallback: return the original term as a single-item list
  return [category.trim()];
}

/**
 * Build a search-ready list of keywords for a given category.
 * Returns both the category itself and all expanded synonyms, deduplicated.
 */
export function buildIndustryKeywords(category: string): string[] {
  const expanded = expandIndustry(category);
  const all = [category, ...expanded];
  return [...new Set(all.map(k => k.toLowerCase()))];
}
