import communes from '../data/communes.json';
import { getSmartNearbyCommunes } from './geoLinks';

export interface Commune {
  nom: string;
  slug: string;
  codeInsee: string;
  codePostal: string;
  population: number;
  latitude?: number;
  longitude?: number;
  altitude?: number;
  intercommunalite?: string;
  microRegion?: string;
  microRegionLabel?: string;
  landmarks?: string[];
  roofCharacteristics?: {
    tuileDominante?: string;
    fixation?: string;
    ventilation?: string;
    ecran?: string;
  };
  introText?: string;
  conseilLocal?: string;
  faq?: { q: string; a: string }[];
  marketData?: {
    couvreursRGE: number;
    prixM2Refection: number;
    prixM2Demoussage: number;
    delaiMoyenJours: number;
  };
}

export function getDynamicPrices(commune: Commune) {
  const rPrice = commune.marketData?.prixM2Refection || 120;
  const dPrice = commune.marketData?.prixM2Demoussage || 20;
  
  return {
    refectionRomane: { min: Math.round(rPrice * 0.95), max: Math.round(rPrice * 1.35) },
    refectionArdoise: { min: Math.round(rPrice * 1.30), max: Math.round(rPrice * 1.70) },
    refectionLauze: { min: Math.round(rPrice * 1.80), max: Math.round(rPrice * 2.40) },
    demoussageHydro: { min: Math.round(dPrice * 0.85), max: Math.round(dPrice * 1.35) },
    crochetNeigeMl: { min: 25, max: 45 },
    reparationFuite: { min: 350, max: 900 },
    faitageMl: { min: 45, max: 85 },
    zinguerieMl: { min: 50, max: 95 },
    isolationSarking: { min: 100, max: 180 },
    charpenteMontagne: { min: 80, max: 150 }
  };
}

class SeededRandom {
  private state: number;

  constructor(seedStr: string) {
    let h = 2166136261;
    for (let i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    this.state = h >>> 0;
  }

  next(): number {
    this.state = (this.state * 1664525 + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export function parseSpintax(slug: string, key: string, template: string): string {
  const prng = new SeededRandom(slug + "-" + key);
  let text = template;
  
  const braceRegex = /\{([^{}]+)\}/;
  let match;
  while ((match = braceRegex.exec(text)) !== null) {
    const options = match[1].split('|');
    const chosenIndex = prng.nextInt(options.length);
    const chosen = options[chosenIndex];
    text = text.slice(0, match.index) + chosen + text.slice(match.index + match[0].length);
  }
  return text;
}

function replaceVariables(template: string, vars: Record<string, string>): string {
  let text = template;
  for (const [key, val] of Object.entries(vars)) {
    text = text.split(`{${key}}`).join(val);
  }
  return text;
}

function shuffleArray<T>(arr: T[], seedStr: string): T[] {
  const prng = new SeededRandom(seedStr);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = prng.nextInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Classify commune density and altitude bands */
function classifyCommune(commune: Commune): {
  geoZone: 'montagne' | 'plaine' | 'cuvette';
  density: 'metropole' | 'village';
  altitudeBand: 'basse' | 'moyenne' | 'haute';
  isMontagne: boolean;
  isHighAltitude: boolean;
} {
  const alt = commune.altitude || 250;
  const pop = commune.population || 3000;
  const reg = commune.microRegion || 'grenoble-cuvette';

  let geoZone: 'montagne' | 'plaine' | 'cuvette' = 'plaine';
  if (reg === 'grenoble-cuvette') geoZone = 'cuvette';
  else if (reg === 'oisans-altitude' || reg === 'prealpes-massifs' || alt > 500) geoZone = 'montagne';

  const density: 'metropole' | 'village' = pop > 15000 ? 'metropole' : 'village';
  const altitudeBand: 'basse' | 'moyenne' | 'haute' = alt < 300 ? 'basse' : alt < 800 ? 'moyenne' : 'haute';
  const isMontagne = geoZone === 'montagne';
  const isHighAltitude = altitudeBand === 'haute' || alt > 800;

  return { geoZone, density, altitudeBand, isMontagne, isHighAltitude };
}

/** Useful links per commune */
export function getExternalLinks(commune: Commune): { label: string; href: string; description: string; icon: string }[] {
  const links = [
    {
      label: "France Rénov' — Aides Publiques",
      href: "https://france-renov.gouv.fr/",
      description: "Estimez vos primes énergie pour vos chantiers d'isolation de toiture",
      icon: "🏛️"
    },
    {
      label: "Annuaire des Couvreurs RGE",
      href: "https://france-renov.gouv.fr/annuaire-rge",
      description: "Trouvez et vérifiez les qualifications RGE des couvreurs dans l'Isère",
      icon: "🔍"
    },
    {
      label: "DTU 40.21 — Couverture Tuiles Terre Cuite",
      href: "https://www.cstb.fr/",
      description: "Spécifications techniques de pose de tuiles en Isère",
      icon: "📋"
    },
    {
      label: "Météo Isère — Bulletins Neige & Vent",
      href: "https://meteofrance.com/previsions-meteo-france/isere/38",
      description: "Suivez l'état du manteau neigeux et les alertes météo en Isère",
      icon: "❄️"
    },
    {
      label: "ADIL de l'Isère (38) — Conseil Habitat",
      href: "https://www.adil38.org/",
      description: "Obtenez un accompagnement juridique gratuit sur vos travaux de toiture",
      icon: "⚖️"
    },
    {
      label: "Qualibat — Vérification Décennale",
      href: "https://www.qualibat.com/rechercher-une-entreprise/",
      description: "Contrôlez les labels de garantie et assurances de vos artisans RGE",
      icon: "🏅"
    }
  ];

  if (commune.codeInsee) {
    links.push({
      label: `Mairie de ${commune.nom} — Déclaration de travaux`,
      href: `https://www.service-public.fr/particuliers/vosdroits/N319`,
      description: `Formulaires officiels pour votre déclaration préalable de toiture à ${commune.nom}`,
      icon: "🏛️"
    });
  }

  return links;
}

/** Subventions info per city */
export function getAidesContent(commune: Commune): {
  maprime: string;
  cee: string;
  tva: string;
  anah: string;
  total: string;
} {
  const { isMontagne } = classifyCommune(commune);
  const slug = commune.slug;
  const prng = new SeededRandom(slug + "-aides");

  const maprimeTemplates = [
    `MaPrimeRénov' accorde des aides substantielles à ${commune.nom} (${commune.codePostal}) pour l'isolation thermique sous toiture (jusqu'à 75€/m² selon vos revenus). En zone de montagne, l'isolation sarking haute performance (R≥6) est vivement encouragée pour diviser vos factures de chauffage.`,
    `Pour les chantiers d'isolation de toiture à ${commune.nom}, MaPrimeRénov' 2026 offre des aides financières proportionnelles à vos revenus. Cette prime nationale, cumulée aux subventions locales de l'Isère, finance la rénovation énergétique de votre couverture.`,
    `L'aide nationale MaPrimeRénov' subventionne l'isolation par l'extérieur ou sous rampants de votre maison à ${commune.nom} (${commune.codePostal}). En confiant le projet à un professionnel RGE, vous pouvez réduire considérablement votre reste à charge.`
  ];

  const ceeTemplates = [
    `Les primes CEE (Certificats d'Économie d'Énergie) versées par les fournisseurs d'énergie s'ajoutent à MaPrimeRénov' à ${commune.nom}. Elles permettent d'obtenir entre 12 et 25 €/m² pour l'isolation de vos combles perdus ou aménagés, sans conditions de ressources.`,
    `Les subventions CEE du 38 sont mobilisables pour vos travaux de toiture à ${commune.nom}. Cumulables avec MaPrimeRénov', elles bonifient le financement de l'isolation thermique continue (sarking) ou traditionnelle de vos combles.`,
    `Grâce au système des Certificats d'Économie d'Énergie à ${commune.nom}, recevez une compensation financière calculée selon la surface de toiture isolée, versée sous forme de virement direct ou bon d'achat par les fournisseurs d'énergie.`
  ];

  const tvaTemplates = [
    `La TVA est réduite à 5,5% au lieu de 20% pour l'achat et la pose d'isolants thermiques de toiture par un artisan RGE qualifié à ${commune.nom}. Cette économie est directement déduite sur votre facture finale.`,
    `À ${commune.nom}, profitez d'un taux de TVA réduit à 5,5% sur toute la partie isolation thermique (matériaux et pose) de votre projet de toit. L'unique condition requise est de passer par un couvreur certifié RGE du 38.`,
    `Pour tout projet d'amélioration énergétique du toit à ${commune.nom}, la facturation applique la TVA à taux réduit de 5,5% pour l'isolation et les travaux induits indissociables (dépose de tuiles, raccords de zinguerie).`
  ];

  const anahTemplates = [
    `L'ANAH propose le programme MaPrimeRénov' Parcours Accompagné à ${commune.nom} pour financer jusqu'à 80% d'une rénovation d'ampleur comprenant l'isolation thermique de la toiture et le renfort des structures pour les résidences anciennes.`,
    `Si votre logement à ${commune.nom} nécessite une rénovation complète (toit + isolation + menuiseries), les subventions de l'ANAH via le parcours d'accompagnement financent une majeure partie du devis sous condition de gain énergétique global.`,
    `Les propriétaires bailleurs ou occupants à ${commune.nom} peuvent solliciter les aides de l'ANAH pour restaurer des toitures vétustes d'avant-guerre, à condition d'installer des isolants à haute performance thermique.`
  ];

  const totalTemplates = [
    `En combinant MaPrimeRénov', la prime CEE de l'Isère, et la TVA réduite, les propriétaires à ${commune.nom} peuvent financer jusqu'à 65% du budget total d'isolation thermique de leur toiture.`,
    `Le cumul des subventions (CEE, prime nationale ANAH, TVA 5,5%) permet de diviser par deux le reste à charge réel sur vos travaux de réfection thermique de toit à ${commune.nom}.`,
    `Les dispositifs d'aide cumulables en Isère pour le secteur de ${commune.nom} diminuent de manière importante la facture finale de sarking ou d'isolation de vos combles.`
  ];

  return {
    maprime: parseSpintax(slug, 'maprime-sub', maprimeTemplates[prng.nextInt(maprimeTemplates.length)]),
    cee: parseSpintax(slug, 'cee-sub', ceeTemplates[prng.nextInt(ceeTemplates.length)]),
    tva: parseSpintax(slug, 'tva-sub', tvaTemplates[prng.nextInt(tvaTemplates.length)]),
    anah: parseSpintax(slug, 'anah-sub', anahTemplates[prng.nextInt(anahTemplates.length)]),
    total: parseSpintax(slug, 'total-sub', totalTemplates[prng.nextInt(totalTemplates.length)])
  };
}

/** Regulations content per city */
export function getRegulationsContent(commune: Commune): {
  plu: string;
  risqueIncendie: string;
  mistral: string;
  abf: string;
} {
  const { isMontagne, isHighAltitude } = classifyCommune(commune);
  const alt = commune.altitude || 250;
  const slug = commune.slug;
  const prng = new SeededRandom(slug + "-regulations");

  const pluTemplates = [
    `Le Plan Local d'Urbanisme (PLU) de ${commune.nom} fixe les règles d'aspect extérieur pour les toitures. Les matériaux traditionnels comme l'ardoise naturelle ou la tuile écaille dauphinoise sont privilégiés en village, tandis que la tuile béton ou romane grise ou rouge is fréquente sur les constructions récentes de ${commune.nom}.`,
    `Consultez la mairie de ${commune.nom} pour prendre connaissance des contraintes du PLU. L'architecture locale du Dauphiné impose des teintes harmonieuses (terres cuites, ocre, anthracite), proscrivant les coloris trop vifs pour préserver l'identité de la commune.`,
    `Le règlement d'urbanisme (PLU) en vigueur à ${commune.nom} encadre les pentes de toiture (souvent supérieures à 45° dans le bâti ancien en pisé) et exige la pose de tuiles de terre cuite respectant les teintes régionales.`
  ];

  const risqueIncendieTemplates = isHighAltitude
    ? [
        `En altitude à ${commune.nom} (${alt}m), le poids de la neige (zone C2) impose des sections de charpente renforcées. La charpente doit être dimensionnée selon l'Eurocode 5 pour résister aux surcharges exceptionnelles de neige de montagne pouvant dépasser 180 kg/m².`,
        `À ${commune.nom} (${alt}m d'altitude), le calcul de charge neige C2 dicte le dimensionnement des chevrons. La structure de charpente en bois de pays doit être validée pour prévenir tout risque d'affaissement sous le manteau neigeux lourd en hiver.`,
        `La surcharge climatique de neige en Isère au-dessus de 800m impose de concevoir la charpente de votre chalet à ${commune.nom} selon les normes Eurocode 5, garantissant la tenue structurelle face à la neige accumulée.`
      ]
    : [
        `À ${commune.nom}, les toitures doivent être équipées d'écrans de sous-toiture HPV pour limiter la pénétration d'humidité due aux fortes précipitations automnales caractéristiques du climat de l'Isère.`,
        `Pour faire face aux précipitations violentes et orages en plaine à ${commune.nom}, la pose d'un écran de sous-toiture étanche et respirant (HPV) sous les tuiles prévient toute infiltration d'humidité accidentelle.`,
        `Les normes du bâtiment à ${commune.nom} préconisent l'installation systématique d'une membrane pare-pluie HPV pour étanchéiser le grenier contre la pluie battante et les infiltrations par les jointures de tuiles.`
      ];

  const mistralTemplates = isMontagne
    ? [
        `À ${commune.nom}, les arrêts de neige (crochets anti-avalanche) sont indispensables. Ils retiennent la neige sur le toit pour éviter les chutes massives sur les entrées et trottoirs. La pose d'un écran pare-neige renforcé sous-toiture évite les infiltrations lors du cycle quotidien de gel-dégel.`,
        `En montagne à ${commune.nom}, prévoyez des crochets garde-neige réglementaires fixés sur la couverture. Ils empêchent la chute soudaine de blocs de glace. Une membrane pare-neige renforcée sous-toiture protège vos combles du dégel.`,
        `La sécurité routière et piétonne à ${commune.nom} impose d'équiper les couvertures inclinées de barrières ou crochets anti-avalanche pour stopper le glissement de la couche neigeuse sur le domaine public.`
      ]
    : [
        `À ${commune.nom}, les vents soufflant le long de la vallée du Rhône ou de la cuvette grenobloise imposent des fixations mécaniques individuelles renforcées des tuiles de rive et de faîtage, conformément à la norme DTU 40.21.`,
        `La plaine dauphinoise et les couloirs de vent du 38 requièrent un chevillage ou vissage individuel des tuiles de rive à ${commune.nom}. Ce système prévient le soulèvement des couvertures lors des coups de vent d'orage.`,
        `Le DTU 40.21 impose des fixations solides pour les faîtages et rives à ${commune.nom}. L'utilisation de closoirs ventilés cloués évite le décollement mécanique des tuiles par fortes rafales.`
      ];

  const abfTemplates = [
    `Si votre maison à ${commune.nom} est située à proximité d'un monument historique ou dans un village préservé, tout projet de toiture devra faire l'objet d'une validation des Architectes des Bâtiments de France (ABF) avec un délai d'instruction supplémentaire de 3 à 4 mois.`,
    `La proximité de monuments classés ou du centre médiéval de ${commune.nom} soumet les travaux de toiture à l'accord obligatoire de l'ABF. Celui-ci impose des teintes de tuiles authentiques et interdit les modifications trop contemporaines.`,
    `Les chantiers de toit dans les zones de protection du patrimoine à ${commune.nom} requièrent l'aval conforme de l'Architecte des Bâtiments de France. Préparez un dossier complet montrant les échantillons de tuiles écaille ou d'ardoise naturelle.`
  ];

  return {
    plu: parseSpintax(slug, 'plu-reg', pluTemplates[prng.nextInt(pluTemplates.length)]),
    risqueIncendie: parseSpintax(slug, 'inc-reg', risqueIncendieTemplates[prng.nextInt(risqueIncendieTemplates.length)]),
    mistral: parseSpintax(slug, 'mis-reg', mistralTemplates[prng.nextInt(mistralTemplates.length)]),
    abf: parseSpintax(slug, 'abf-reg', abfTemplates[prng.nextInt(abfTemplates.length)])
  };
}

export function generateCommuneContent(commune: Commune, pageType: 'refection' | 'demoussage' | 'artisan') {
  const rPrice = commune.marketData?.prixM2Refection || 120;
  const dPrice = commune.marketData?.prixM2Demoussage || 20;
  const minRPrice = Math.round(rPrice * 0.95);
  const maxRPrice = Math.round(rPrice * 1.35);
  const minDPrice = Math.round(dPrice * 0.85);
  const maxDPrice = Math.round(dPrice * 1.25);
  const rge = commune.marketData?.couvreursRGE || 3;
  const delays = commune.marketData?.delaiMoyenJours || 10;
  const pop = commune.population || 3000;
  const slug = commune.slug;
  const alt = commune.altitude || 250;

  const { geoZone, density, altitudeBand, isMontagne, isHighAltitude } = classifyCommune(commune);
  const prng = new SeededRandom(slug + "-" + pageType);

  // Neighbor communes
  const nearby = getSmartNearbyCommunes(slug, communes as any[], 4, 0);
  const proxC1 = nearby[0]?.nom || "Grenoble";
  const proxC2 = nearby[1]?.nom || "Voiron";
  const proxC3 = nearby[2]?.nom || "Vienne";
  const proxC4 = nearby[3]?.nom || "Bourgoin-Jallieu";

  // Landmarks
  const landmark1 = commune.landmarks?.[0] || `le centre-ville de ${commune.nom}`;
  const landmark2 = commune.landmarks?.[1] || `les quartiers résidentiels de ${commune.nom}`;
  const tuileDominante = commune.roofCharacteristics?.tuileDominante || "Tuile mécanique romane ou tuile écaille";
  const fixation = commune.roofCharacteristics?.fixation || "Crochets galvanisés renforcés";
  const microRegionLabel = commune.microRegionLabel || "Isère";
  const interco = commune.intercommunalite || "Département de l'Isère";

  const vars: Record<string, string> = {
    VILLE: commune.nom,
    ZIP: commune.codePostal,
    DEPARTEMENT: "Isère",
    DEPARTEMENT_CODE: "38",
    MIN_PRIX_REF: minRPrice.toString(),
    MAX_PRIX_REF: maxRPrice.toString(),
    MIN_PRIX_DEM: minDPrice.toString(),
    MAX_PRIX_DEM: maxDPrice.toString(),
    RGE_NB: rge.toString(),
    DELAIS: delays.toString(),
    POPULATION: pop.toLocaleString('fr-FR'),
    INTERCO: interco,
    PROX_C1: proxC1,
    PROX_C2: proxC2,
    PROX_C3: proxC3,
    PROX_C4: proxC4,
    ALTITUDE: alt.toString(),
    LANDMARK1: landmark1,
    LANDMARK2: landmark2,
    TUILE_DOMINANTE: tuileDominante,
    FIXATION: fixation,
    MICRO_REGION: microRegionLabel,
    INSEE: commune.codeInsee
  };

  // ============ TITLE TEMPLATES ============
  let titleTemplate = "";
  if (pageType === 'refection') {
    titleTemplate = "{Toiture & Charpente à {VILLE} ({ZIP}) — Spécialiste Montagne Isère|Rénovation de Toiture à {VILLE} ({ZIP}) — Artisan RGE Décennale 38|Couverture & Réfection Toiture à {VILLE} — Devis Gratuit Couvreur Isère}";
  } else if (pageType === 'demoussage') {
    titleTemplate = "{Démoussage & Nettoyage de Toiture à {VILLE} ({ZIP}) — Traitement Antigel|Nettoyage de Toiture & Démoussage à {VILLE} (38) — Devis Gratuit|Entretien Toiture à {VILLE} — Démoussage + Hydrofuge par Couvreur alpins}";
  } else {
    titleTemplate = "{Artisan Couvreur RGE à {VILLE} ({ZIP}) — Devis Décennale Gratuit|Trouver un Couvreur Qualifié à {VILLE} (38) — Aides Énergie RGE|Couvreur de Confiance à {VILLE} — {RGE_NB} Couvreurs alpins RGE Disponibles}";
  }

  // ============ INTRO PARAGRAPH TEMPLATES ============
  let introTemplate = "";
  if (pageType === 'refection') {
    const refectionIntros = isMontagne ? [
      "Vous recherchez un couvreur spécialisé en montagne à {VILLE} ({ZIP}) ? À {ALTITUDE} m d'altitude dans le massif de la {MICRO_REGION}, les toitures doivent faire face à des conditions extrêmes : de fortes chutes de neige lourde en zone C2, des cycles intenses de gel-dégel et des pentes escarpées. Nos couvreurs partenaires rénovent votre couverture (ardoise naturelle, tuile certifiée antigel, lauze calcaire) entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, pose et dépose incluses, avec renforcement de charpente et crochets arrêts de neige réglementaires.",
      "Besoin de refaire le toit d'un chalet ou d'une maison d'altitude à {VILLE} ({ZIP}) ? Le climat alpin extrême du secteur {MICRO_REGION} met à mal les couvertures traditionnelles. Les charpentes doivent supporter le gel persistant et le poids de la neige C2. Faites appel à des artisans couvreurs qualifiés de l'Isère pour restaurer votre couverture en tuiles grand gel ou ardoises de pays pour un coût moyen de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m² TTC.",
      "Pour vos travaux de couverture et de réfection à {VILLE} ({ZIP}), choisissez des couvreurs rompus aux contraintes de montagne. En zone montagneuse ({ALTITUDE}m), les risques d'infiltrations au dégel et de surcharges de neige imposent une pose technique soignée. Obtenez une rénovation thermique sarking performante et une étanchéité pérenne pour un budget de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m²."
    ] : geoZone === 'cuvette' ? [
      "Votre toiture à {VILLE} ({ZIP}) nécessite des travaux de rénovation ? L'humidité stagnante de la cuvette grenobloise et les amplitudes thermiques annuelles fatiguent prématurément les isolants et les tuiles en terre cuite de la métropole. Proche de {LANDMARK1}, les artisans couvreurs du 38 refont votre couverture et renforcent votre isolation sous toiture pour un budget moyen compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, avec garantie décennale de 10 ans.",
      "En quête d'un couvreur-charpentier à {VILLE} ({ZIP}) ? Les conditions météo de la cuvette métropolitaine (pics de chaleur, fortes pluies d'automne et brouillards hivernaux) nécessitent un toit parfaitement ventilé et isolé. Nos partenaires locaux rénovent les copropriétés et pavillons isérois pour un tarif de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m² TTC avec des matériaux de couverture certifiés.",
      "Rénover son toit à {VILLE} ({ZIP}) permet d'améliorer significativement le DPE de son habitation face aux étés étouffants de l'Isère. Des couvreurs qualifiés RGE interviennent pour la pose de tuiles mécaniques romanes ou toitures-terrasses modernes. Le coût de réfection complète oscille entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC avec garantie décennale."
    ] : [
      "Votre toiture à {VILLE} en Isère nécessite une intervention spécialisée ? Dans la plaine du Nord-Isère, les maisons dauphinoises traditionnelles en pisé et les pavillons résidentiels de {VILLE} ({ZIP}) exigent une couverture résistante aux fortes tempêtes de grêle estivales et au froid hivernal continental. Les charpentiers-couvreurs du 38 rénovent votre toit à {VILLE} pour un budget moyen compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, normes d'étanchéité incluses.",
      "Pour votre projet de couverture à {VILLE} ({ZIP}), sollicitez des couvreurs isérois qualifiés. Entre les risques d'orages de grêle en été et le gel modéré en hiver, les tuiles écaille ou romanes doivent être fixées mécaniquement selon le DTU 40.21. Prévoyez un budget de réfection moyen de {MIN_PRIX_REF}€ à {MAX_PRIX_REF}€ le m² pour une pose de qualité avec garantie 10 ans.",
      "Des travaux de réfection de toiture à réaliser à {VILLE} ({ZIP}) ? Assurez la protection de votre patrimoine dauphinois avec un toit neuf en tuiles terre cuite scellées ou mécaniques. Nos couvreurs partenaires de l'Isère proposent des devis gratuits pour la rénovation complète de votre toit, avec un tarif compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m²."
    ];
    introTemplate = refectionIntros[prng.nextInt(refectionIntros.length)];
  } else if (pageType === 'demoussage') {
    const demoussageIntros = isMontagne ? [
      "Votre toiture à {VILLE} ({ZIP}) est recouverte de lichens ou de mousses ? Le gel persistant combiné à l'humidité de la neige en montagne fait éclater les tuiles devenues poreuses sous l'effet des lichens d'altitude. Un démoussage rigoureux suivi de l'application d'un traitement hydrofuge siloxane incolore antigel est indispensable pour préserver votre toit des hivers rigoureux à {VILLE}. Budget moyen : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Faire démousser son chalet ou sa toiture d'altitude à {VILLE} ({ZIP}) prévient les gros dégâts du gel. Les mousses et lichens gorgés d'eau font éclater le support lorsque le thermomètre descend sous zéro. Nos équipes réalisent un nettoyage complet basse pression suivi de l'application d'un hydrofuge de qualité professionnelle pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².",
      "Pour la toiture de votre maison à {VILLE} ({ZIP}), planifiez un nettoyage antimousse professionnel. Éliminer les résidus biologiques avant les chutes de neige protège l'étanchéité de votre toit et évite d'endommager la couverture. Bénéficiez d'un diagnostic d'usure gratuit et d'un traitement hydrofuge siloxane pour un budget maîtrisé de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m²."
    ] : [
      "Besoin d'un entretien de toiture professionnel à {VILLE} ({ZIP}) ? L'humidité hivernale et les fortes chaleurs estivales favorisent le développement d'algues et de mousses noires sur les couvertures de {VILLE}. Nos couvreurs partenaires réalisent le nettoyage, l'application d'un algicide professionnel et l'imperméabilisation par hydrofuge de vos tuiles romanes ou dauphinoises pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m² TTC.",
      "Pour préserver vos tuiles à {VILLE} ({ZIP}) des agressions du climat dauphinois, réalisez un traitement antimousse complet. Un nettoyage doux basse pression (sans chlore agressif) élimine les mousses tenaces. L'application finale d'un hydrofuge incolore offre une protection perlant durable de 10 ans pour un budget de {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€ le m².",
      "L'entretien régulier des couvertures à {VILLE} ({ZIP}) prévient l'infiltration d'eaux pluviales. Les toits dauphinois en tuiles écaille ou romanes subissent les assauts de la météo iséroise. Comparez gratuitement les devis de nettoyage et démoussage de toiture (avec traitement hydrofuge autonettoyant compris) oscillant entre {MIN_PRIX_DEM}€ et {MAX_PRIX_DEM}€ le m²."
    ];
    introTemplate = demoussageIntros[prng.nextInt(demoussageIntros.length)];
  } else {
    const artisanIntros = [
      "Besoin d'un couvreur de confiance certifié RGE à {VILLE} ({ZIP}) ? Pour la rénovation de tuiles écaille dauphinoises, la pose d'ardoises naturelles, l'étanchéité de toitures-terrasses, ou la pose d'une isolation sarking performante ouvrant droit aux aides de l'État, comparez gratuitement jusqu'à 3 offres de couvreurs assurés en décennale actifs dans le secteur de {VILLE} et ses environs ({PROX_C1}, {PROX_C2}).",
      "Trouvez un artisan couvreur qualifié dans le secteur de {VILLE} ({ZIP}) pour réaliser vos travaux de toiture en toute sérénité. Que ce soit pour réparer une fuite de tuiles, changer les gouttières en zinc ou poser une isolation par l'extérieur, comparez les prix des meilleures entreprises certifiées RGE locales du 38 disposant d'assurances décennales vérifiées.",
      "Vous projetez des travaux de couverture à {VILLE} ({ZIP}) ? Notre réseau sélectionne les couvreurs qualifiés RGE et charpentiers professionnels de l'Isère pour votre chantier. Obtenez en quelques clics des devis comparatifs pour la pose de vos tuiles, l'entretien antimousse ou l'isolation de votre maison à {VILLE} ou communes voisines comme {PROX_C1}."
    ];
    introTemplate = artisanIntros[prng.nextInt(artisanIntros.length)];
  }

  // ============ DYNAMIC CARDS TAILORED PER PAGE TYPE ============
  let card1Text = "";
  let card1Title = "";
  let card2Text = "";
  let card2Title = "";
  let card3Text = "";
  let card3Title = "";

  if (pageType === 'refection') {
    card1Title = parseSpintax(slug, 'c1t-r', "{Climat & Contraintes Neige|Rigueur Climatique & Neige C2|Contraintes Neige & Climat}");
    const opts = [
      `À {VILLE}, le climat montagnard du massif de la {MICRO_REGION} expose les bâtiments à des charges neigeuses classées en zone de neige C2 (jusqu'à 200 kg/m²). Les charpentes doivent posséder des sections de bois renforcées et un contre-lattage ventilé robuste. Les cycles répétés de gel-dégel (entre 80 et 120 nuits de gel par an à {VILLE}) font éclater les tuiles ordinaires. L'utilisation d'ardoise naturelle de qualité ou de tuiles de terre cuite certifiées antigel (EN 539-2) posées avec des crochets inox renforcés et des crochets arrêts de neige est obligatoire au-dessus de 500m d'altitude pour sécuriser les abords du chalet.`,
      `Le massif de la {MICRO_REGION} et son altitude moyenne de {ALTITUDE}m exposent la toiture à {VILLE} ({ZIP}) à des sollicitations physiques intenses. L'accumulation de neige glacée (normes zone C2) impose de renforcer les appuis de charpente en bois massif (mélèze ou sapin classé C24). Pour éviter l'éclatement des tuiles sous l'action répétée du gel, on pose des matériaux conformes à la norme EN 539-2 avec un système de crochets d'ancrage en inox et des garde-neige de sécurité.`,
      `Les intempéries alpines à {VILLE} exigent une couverture résistante. Avec des températures chutant régulièrement sous zéro, les matériaux classiques se fissurent. Les couvreurs du 38 préconisent la pose de tuiles de terre cuite certifiées grand gel ou d'ardoises naturelles. Un double contre-lattage ventilé sous couverture permet l'évacuation rapide des eaux de condensation lors de la fonte de la neige, protégeant ainsi l'isolation sous-jacente.`
    ];
    if (!isMontagne) {
      if (geoZone === 'cuvette') {
        opts[0] = `À {VILLE} ({ZIP}), la cuvette grenobloise subit des inversions thermiques marquées provoquant des brouillards givrants prolongés en hiver et des pics de chaleur étouffante en été. Cette amplitude thermique élevée accélère la fatigue mécanique des tuiles et des isolations de toiture. La stagnation de l'humidité favorise la prolifération rapide de mousses et lichens. Pour assurer la durabilité de votre toit à {VILLE}, la pose d'un écran de sous-toiture respirant HPV de classe R2 et une ventilation croisée sont requises.`;
        opts[1] = `L'effet de cuvette thermique à {VILLE} met les matériaux de couverture à rude épreuve. Les alternances rapides de gel et d'ensoleillement intense provoquent des chocs thermiques sur les tuiles en terre cuite de la métropole. Afin d'éviter les infiltrations d'eau lors des orages violents, les couvreurs préconisent des tuiles à emboîtement scellées et un écran HPV respirant posé sous contre-liteaux ventilés.`;
        opts[2] = `Les toits de {VILLE} subissent les contraintes d'une zone urbaine encerclée de reliefs. Les brouillards stagnants en hiver déposent une humidité acide propice aux mousses. En été, les toits montent à plus de 60°C. Pour stabiliser la toiture, nos couvreurs installent des closoirs ventilés à sec au faîtage et des grilles de protection contre les feuilles pour garantir un écoulement parfait de l'eau.`;
      } else {
        opts[0] = `Dans le secteur de {VILLE} en Bas-Dauphiné, le climat continental engendre de violents orages d'été accompagnés de grêle. Les toitures dauphinoises traditionnelles en pisé se caractérisent par des pentes de toit fortes, souvent supérieures à 45°, pour évacuer rapidement l'eau. Ces toitures nécessitent une pose soignée de tuiles écaille ou de tuiles romanes avec fixation mécanique renforcée sur chaque rive et au faîtage selon le DTU 40.21.`;
        opts[1] = `Le climat du Nord-Isère à {VILLE} se distingue par des contrastes saisonniers marqués : hivers froids et étés orageux propices à la grêle. Les couvertures dauphinoises de {VILLE} ({ZIP}) requièrent des tuiles robustes solidement fixées sur les liteaux. Les artisans du 38 réalisent des fixations renforcées par clouage ou crochetage des tuiles de rive pour contrer les rafales de vent canalisées dans les plaines.`;
        opts[2] = `Pour faire face aux contraintes de la plaine dauphinoise à {VILLE}, la toiture doit concilier pente forte et étanchéité face aux orages de grêle de plus en plus fréquents. Les artisans couvreurs privilégient des tuiles écaille plates de forte densité ou des tuiles mécaniques double emboîtement, complétées par un écran pare-pluie HPV pour parer toute rupture de tuile accidentelle.`;
      }
    }
    card1Text = opts[prng.nextInt(opts.length)];

    card2Title = parseSpintax(slug, 'c2t-r', "{PLU & Réglementation ABF|Normes Urbanisme & Mairie|Règles PLU & Patrimoine}");
    const opts2 = [
      `Le Plan Local d'Urbanisme (PLU) de {VILLE} définit de manière précise les critères architecturaux à respecter pour préserver l'harmonie du paysage dauphinois. Les tuiles écaille plates de coloris rouge vieilli ou ocre ou l'ardoise naturelle de pays posée sur liteaux est généralement exigée dans les centres anciens de {VILLE} pour préserver le patrimoine. Pour tout projet modifiant l'aspect extérieur de votre toiture à {VILLE} ou si votre bâtiment se situe dans le périmètre de protection d'un monument historique (comme {LANDMARK1}), l'accord préalable de l'Architecte des Bâtiments de France (ABF) est obligatoire. Les couvreurs professionnels du 38 vous guident dans l'élaboration de votre dossier administratif.`,
      `La réglementation d'urbanisme à {VILLE} ({ZIP}) encadre strictement la rénovation de toiture. Selon le PLU communal, vous devez respecter la typologie locale de couverture (tuiles romanes de terre cuite dans les lotissements, ardoise naturelle ou tuile écaille fine dans les zones protégées). Si votre maison se trouve dans le cône de visibilité de {LANDMARK1}, l'avis conforme de l'ABF déterminera le choix des coloris et des pentes. Un couvreur certifié RGE vous assistera pour déposer la déclaration préalable (DP) en mairie.`,
      `Tout projet de toiture à {VILLE} doit s'accorder avec le Plan Local d'Urbanisme et les avis des Architectes des Bâtiments de France (ABF). Près de {LANDMARK1}, les exigences patrimoniales imposent souvent des matériaux de pays et proscrivent les bacs acier ou Velux surdimensionnés visibles depuis le domaine public. Les artisans couvreurs du 38 connaissent parfaitement ces contraintes et proposent des solutions conformes (faîtage scellé à l'ancienne, teintes ocre rouge) pour l'approbation de votre dossier de travaux.`
    ];
    card2Text = opts2[prng.nextInt(opts2.length)];

    card3Title = parseSpintax(slug, 'c3t-r', "{Typologie du Bâti Local|Architecture & Bâti Local|Structure du Bâtiment Local}");
    const opts3 = [
      isMontagne
        ? `L'habitat à {VILLE} se compose principalement de chalets en bois traditionnels, de résidences de vacances en station de ski, et de granges d'alpage réhabilitées. Les charpentes de ces bâtisses sont construites en madriers et poutres épaisses en résineux de pays (mélèze, sapin) pour supporter le poids cumulé de la neige. La proximité des forêts d'altitude à {VILLE} favorise le dépôt d'aiguilles de pin et de brindilles qui obstruent les gouttières : les couvreurs locaux préconisent l'installation de protège-gouttières métalliques renforcés pour éviter la déformation des cheneaux par le gel de l'eau stagnante en hiver.`
        : geoZone === 'cuvette'
        ? `À {VILLE} ({POPULATION} habitants), l'urbanisme de la cuvette grenobloise regroupe à la fois des copropriétés urbaines en béton à toits-terrasses et des pavillons résidentiels édifiés à partir des années 1960. Les interventions sur ces copropriétés exigent une logistique stricte (installation d'échafaudages homologués, périmètres de sécurité, autorisations de voirie pour les camions-bennes). La toiture type est en tuile mécanique double emboîtement. Les diagnostics de charpente pour détecter la présence de champignons lignivores ou d'insectes à larves xylophages (capricornes) sont conseillés avant toute rénovation de toiture.`
        : `Dans le Nord-Isère près de {VILLE}, l'architecture traditionnelle est marquée par la maison dauphinoise en pisé dotée d'une charpente en bois de chêne massif à fortes pentes et larges débords de toit (les génoises en tuiles ou bandeaux bois débordants) pour protéger les murs en terre des intempéries. La toiture dauphinoise classique est couverte de tuiles écaille plates. Ces charpentes historiques exigent une grande technicité lors des travaux de réfection afin de ne pas déséquilibrer la structure porteuse fragile en pisé.`,
      isMontagne
        ? `Les résidences de montagne de {VILLE} ({ZIP}) exigent une isolation thermique continue double flux, souvent réalisée en sarking (panneaux de fibre de bois haute densité posés directement sur chevrons). Les toitures d'altitude doivent gérer le glissement de la neige lourde et les risques d'infiltration au dégel par capillarité. Les charpentiers du 38 renforcent systématiquement les pannes sablières et posent des fixations inox robustes sur les chevrons.`
        : geoZone === 'cuvette'
        ? `Le parc immobilier de {VILLE} est varié : maisons anciennes du centre métropolitain et zones résidentielles pavillonnaires. Les charpentes en sapin ou fermettes industrielles supportent principalement des tuiles romanes ou des toitures-terrasses bitumineuses. Un diagnostic complet de la structure bois (recherche d'insectes à larves xylophages comme les capricornes et de champignons) est mené par le charpentier avant toute réfection.`
        : `Les bâtisses en pisé de {VILLE} sont particulièrement sensibles à l'humidité. Toute rénovation de toiture doit impérativement préserver les larges avancées de toit (débords de 80 cm à 1,20 m) pour maintenir les façades en terre au sec. La structure en chêne d'époque nécessite d'utiliser des matériaux de couverture de même poids pour éviter tout tassement ou déséquilibre des murs porteurs.`,
      isMontagne
        ? `À {VILLE}, restaurer les granges d'alpage ou chalets exige de maîtriser les matériaux montagnards. La lauze traditionnelle dauphinoise en pierre calcaire ou l'ardoise naturelle d'altitude sont fixées au crochet inox sur un plancher de bois ventilé. La ventilation est conçue pour éviter que la chaleur du chalet ne fasse fondre la neige par le dessous, ce qui génèrerait des plaques de glace destructrices en bas de pente.`
        : geoZone === 'cuvette'
        ? `Les toitures-terrasses et toits plats des copropriétés de {VILLE} subissent les étés chauds de la métropole. Nos couvreurs réalisent des étanchéités multicouches élastomères ou membranes synthétiques (EPDM) résistantes aux UV et aux dilatations thermiques. Pour les villas des coteaux, les tuiles terre cuite scellées garantissent une stabilité thermique sous rampants.`
        : `La toiture dauphinoise traditionnelle à {VILLE} fait partie du patrimoine architectural de l'Isère. Ses pans inclinés à plus de 45° couverts de tuiles écaille nécessitent un travail de zinguerie sur-mesure (couloirs, noquets de plomb et gouttières pendantes en zinc) pour évacuer les orages violents typiques de la plaine dauphinoise.`
    ];
    card3Text = opts3[prng.nextInt(opts3.length)];
  } else if (pageType === 'demoussage') {
    card1Title = parseSpintax(slug, 'c1t-d', "{Climat & Gels Hivernaux|Impact du Gel sur les Tuiles|Risque Gel & Climat}");
    const opts = [
      `Le gel persistant combiné à l'humidité de la neige en montagne fait éclater les tuiles devenues poreuses sous l'effet des lichens d'altitude à {VILLE}. Un démoussage rigoureux suivi de l'application d'un traitement hydrofuge siloxane incolore antigel est indispensable pour préserver votre toit des hivers rigoureux. Budget moyen : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².`,
      `À {VILLE} ({ZIP}), l'humidité stagnante favorise le développement d'algues et de mousses noires sur les couvertures de {VILLE}. En retenant l'eau comme une éponge, ces végétaux favorisent l'éclatement des tuiles lors des gelées hivernales iséroises. Un traitement hydrofuge à effet perlant imperméabilise le support, évite les infiltrations capillaires et retarde le retour des mousses pendant 10 ans.`,
      `L'encrassement biologique de votre toiture à {VILLE} fragilise l'étanchéité globale. La mousse s'incruste dans les pores de la terre cuite ou du béton. Pour protéger votre bien des chocs thermiques et du gel en Isère, un brossage manuel suivi d'un traitement algicide et d'un traitement hydrofuge de surface est fortement recommandé pour un entretien longue durée.`
    ];
    card1Text = opts[prng.nextInt(opts.length)];

    card2Title = parseSpintax(slug, 'c2t-d', "{Esthétique & PLU|Respect du Patrimoine & PLU|Esthétique & Règles d'Urbanisme}");
    const opts2 = [
      `L'entretien de toiture à {VILLE} doit respecter les directives du PLU concernant l'aspect extérieur. Bien que le nettoyage ne change pas la couverture, l'application d'un hydrofuge coloré ou d'un revêtement acrylique nécessite une validation en mairie si la teinte d'origine est modifiée. Si vous résidez près de {LANDMARK1}, les Architectes des Bâtiments de France exigent des traitements incolores préservant l'aspect brut et la patine naturelle des tuiles en terre cuite d'origine.`,
      `À {VILLE} ({ZIP}), préserver l'aspect historique des toitures est une obligation morale et réglementaire. Le démoussage prévient l'usure précoce sans dénaturer le bâti. Les professionnels RGE utilisent des traitements hydrofuges incolores certifiés qui respectent le patrimoine, indispensables si votre bien se situe dans les secteurs sauvegardés ou à proximité de {LANDMARK1}.`,
      `Pour nettoyer vos tuiles à {VILLE} en conformité avec les exigences esthétiques de la commune, évitez les produits colorants bas de gamme. Les Bâtiments de France (ABF) veillent à l'harmonie des teintes dauphinoises traditionnelles (ocre, rouge vieilli). Choisissez un traitement curatif fongicide incolore et un hydrofuge à effet perlant qui protège le matériau tout en conservant son authenticité visuelle.`
    ];
    card2Text = opts2[prng.nextInt(opts2.length)];

    card3Title = parseSpintax(slug, 'c3t-d', "{Architecture & Bâti Local|Matériaux & Bâti Dauphinois|Particularités du Bâti Local}");
    const opts3 = [
      isMontagne
        ? `Les chalets d'altitude à {VILLE} ({ZIP}) équipés de tuiles béton ou ardoises de moyenne montagne accumulent des mousses épaisses nourries par la fonte lente des neiges. Un nettoyage doux est requis pour ne pas fragiliser les supports d'arêtes ou les crochets de fixation en inox. Les professionnels appliquent un fongicide à action prolongée pour prévenir le verdissement rapide induit par la proximité des forêts d'altitude.`
        : geoZone === 'cuvette'
        ? `Les toits-terrasses et les tuiles mécaniques des pavillons de {VILLE} sont exposés aux suies industrielles et routières de la métropole grenobloise, qui créent une croûte noire acide favorisant l'implantation des mousses. Un traitement algicide curatif suivi d'une hydrofugation de surface protège les tuiles en terre cuite et prévient la stagnation des eaux pluviales.`
        : `Les maisons dauphinoises en pisé près de {VILLE} craignent par-dessus tout les infiltrations d'eau au niveau des murs porteurs en terre. Lors du nettoyage de toiture, le couvreur s'assure du bon fonctionnement des gouttières en zinc et de la zinguerie dauphinoise. Il veille à ce que l'eau du lavage basse pression ne ruisselle pas sur les façades non protégées.`,
      isMontagne
        ? `En altitude à {VILLE}, la mousse favorise la formation de plaques de verglas sous la neige, risquant de faire glisser des tuiles entières. Un nettoyage manuel au grattoir suivi d'un traitement hydrofuge siloxane avec effet perlant stoppe la pénétration de l'eau dans le support et protège les tuiles béton ou terre cuite contre les hivers rigoureux de l'Isère.`
        : geoZone === 'cuvette'
        ? `Les toitures en tuiles romanes des lotissements de {VILLE} s'encrassent rapidement en raison des microclimats chauds et humides de la cuvette. Le nettoyage doit exclure le chlore pur ou la haute pression à outrance pour ne pas arracher la couche de protection de la terre cuite, privilégiant un autonettoyant biodégradable respectueux de l'environnement.`
        : `L'entretien des tuiles écaille dauphinoises à {VILLE} exige de la précaution. Ces tuiles plates anciennes, souvent clouées sur les liteaux, sont fragiles sous les pas. Les couvreurs du 38 utilisent des échelles de toit adaptées et appliquent un traitement antimousse par pulvérisation douce, préservant la solidité de la toiture dauphinoise.`,
      isMontagne
        ? `Sur les chalets à {VILLE}, l'accumulation d'aiguilles de mélèze ou de sapin dans les gouttières aggrave les dégâts du gel. Un entretien complet comprend le nettoyage des chéneaux et la pose de grilles pare-feuilles métalliques, en plus du traitement antimousse des ardoises ou des lauzes de montagne.`
        : geoZone === 'cuvette'
        ? `Les copropriétés et résidences de {VILLE} disposant de toitures en bac acier ou toits-terrasses réclament un entretien régulier des évacuations d'eaux pluviales (crapaudines) pour éviter tout engorgement et infiltration d'eau. Pour les tuiles terre cuite, l'hydrofuge retarde de plusieurs années l'apparition des lichens et traces noires.`
        : `La toiture à forte pente de {VILLE} rend le démoussage technique et dangereux. Les professionnels utilisent des harnais de sécurité et des lignes de vie homologuées. Le traitement de toiture dauphinoise préserve le cachet historique des habitations en pisé en évitant le remplacement prématuré des tuiles écaille.`
    ];
    card3Text = opts3[prng.nextInt(opts3.length)];
  } else {
    card1Title = parseSpintax(slug, 'c1t-a', "{Assurance Décennale Toiture|Garantie Décennale Couvreur|Sécurité 10 Ans Toiture}");
    const opts = [
      `L'assurance décennale est une obligation légale pour tout couvreur intervenant sur le secteur de {VILLE} ({ZIP}). Ce contrat d'assurance professionnelle couvre les dommages compromettant la solidité de la toiture ou de la charpente pendant 10 ans. Demandez impérativement l'attestation nominative de l'assureur avant l'ouverture du chantier à {VILLE} pour sécuriser vos travaux.`,
      `En Isère, aucun travail de toiture à {VILLE} ne doit démarrer sans vérification de la garantie décennale du professionnel. Cette couverture protège les propriétaires contre tout vice de construction ou défaut d'étanchéité survenu après réception. Vérifiez que la police d'assurance mentionne précisément les activités de couverture, charpente et zinguerie pour l'année en cours.`,
      `La garantie décennale toiture sécurise votre investissement immobilier à {VILLE}. Elle garantit la prise en charge intégrale d'une réfection en cas de sinistre structurel ou d'infiltration majeure dans les dix ans. Avant de signer votre devis de toiture à {VILLE}, assurez-vous de la validité territoriale de l'assurance décennale pour la région Rhône-Alpes.`
    ];
    card1Text = opts[prng.nextInt(opts.length)];

    card2Title = parseSpintax(slug, 'c2t-a', "{Label RGE & Aides Régionales|Artisans RGE & Subventions|Qualification RGE & Primes CEE}");
    const opts2 = [
      `La certification RGE (Reconnu Garant de l'Environnement) est la clé pour débloquer les aides d'État à {VILLE} ({ZIP}). Qu'il s'agisse de MaPrimeRénov', de l'éco-PTZ ou des primes CEE spécifiques à l'Isère, ces subventions ne sont accordées que si vos travaux d'isolation thermique (sarking ou combles perdus) sont réalisés par un couvreur certifié RGE actif dans votre commune.`,
      `Pour vos travaux de rénovation énergétique à {VILLE}, choisir un artisan labellisé RGE Qualibat ou Capeb est obligatoire. En plus de garantir un travail conforme aux normes d'économie d'énergie (RE2026), ce label vous permet de financer jusqu'à 65% du coût des isolants et pare-vapeur grâce aux dispositifs MaPrimeRénov' et aux aides régionales du Dauphiné.`,
      `Bénéficiez des aides publiques en Isère pour isoler votre toit à {VILLE}. Les primes de l'ANAH et les certificats d'économie d'énergie (CEE) nécessitent l'intervention d'une entreprise possédant la mention RGE Rénovation Globale ou Couverture. Comparez les devis détaillés mentionnant les performances de résistance thermique (R) requises (R ≥ 6 pour le sarking) pour obtenir vos financements.`
    ];
    card2Text = opts2[prng.nextInt(opts2.length)];

    card3Title = parseSpintax(slug, 'c3t-a', "{Expertise Bâti Alpin (38)|Savoir-faire Couvreur Alpin|Compétences Charpente Montagne}");
    const opts3 = [
      isMontagne
        ? `Les toitures de montagne à {VILLE} ({ZIP}) exigent un savoir-faire hautement technique. Pour faire face aux surcharges de neige en zone C2, au gel et au vent d'altitude, sélectionnez un artisan couvreur ayant des références solides dans la pose de couvertures alpines (ardoise, lauze, isolation sarking continue). Les entreprises locales maîtrisent les normes de sécurité spécifiques au Massif.`
        : geoZone === 'cuvette'
        ? `Les toits de la métropole grenobloise demandent des artisans familiers des problématiques urbaines (toits-terrasses, échafaudages de hauteur, isolation thermique RE2026 contre les canicules de la cuvette). Privilégiez des couvreurs disposant d'un ancrage local fort à {VILLE} ou dans les communes voisines pour garantir un service après-vente rapide.`
        : `La rénovation des toits dauphinois en pisé près de {VILLE} requiert une expertise specific en charpente traditionnelle bois (chêne, sapin). L'artisan choisi doit comprendre la physique du pisé pour ne pas enfermer l'humidité ou surcharger les murs. Demandez des références de rénovation de fermes dauphinoises dans le Nord-Isère.`,
      isMontagne
        ? `Engager un couvreur à {VILLE} pour un chalet ou une copropriété d'altitude impose de vérifier ses qualifications en charpente bois massif de pays et pose d'arrêts de neige homologués. Les toits de montagne subissent des charges extrêmes ; l'artisan doit savoir appliquer les règles de l'Eurocode 5 pour garantir la sécurité publique.`
        : geoZone === 'cuvette'
        ? `À {VILLE}, comparez les offres de couvreurs qualifiés RGE. Les travaux d'isolation thermique par l'extérieur (sarking) ou de réfection de toiture-terrasse réclament des techniques modernes. Un couvreur local dans la cuvette grenobloise saura vous proposer les isolants les plus performants contre le froid hivernal et le déphasage estival.`
        : `Le savoir-faire pour les toits à forte pente et tuiles écaille à {VILLE} est détenu par des artisans couvreurs traditionnels du 38. Pour les bâtisses en pisé, ils réalisent des zingueries sur-mesure de fort calibre (zinc dauphinois) et des débords de toit de sécurité conformes aux règles de l'art locales.`,
      isMontagne
        ? `Pour vos travaux en altitude à {VILLE}, planifiez l'intervention avec un couvreur local entre la fin du printemps et l'automne. Les entreprises spécialisées montagne organisent leurs chantiers selon les fenêtres climatiques et disposent de matériels de levage adaptés aux contraintes d'accès des stations alpines.`
        : geoZone === 'cuvette'
        ? `Trouver un couvreur réactif à {VILLE} nécessite de cibler des entreprises disposant d'assurances décennales adaptées aux différents types de supports (béton, tuiles terre cuite, étanchéité bitume). Privilégiez les professionnels certifiés RGE qualifiés pour l'isolation et la réfection de combles.`
        : `Dans le Dauphiné près de {VILLE}, fuyez le démarchage à domicile abusif proposant des nettoyages de toiture miracles à prix cassés. Tournez-vous vers des couvreurs-charpentiers locaux, certifiés RGE et assurés, engagés dans la préservation du patrimoine en Isère.`
    ];
    card3Text = opts3[prng.nextInt(opts3.length)];
  }

  // Icons matching pageType
  const card1Icon = pageType === 'refection' ? "❄️" : pageType === 'demoussage' ? "🧼" : "🛡️";
  const card2Icon = pageType === 'refection' ? "🏛️" : pageType === 'demoussage' ? "🏛️" : "🏆";
  const card3Icon = pageType === 'refection' ? "🏡" : pageType === 'demoussage' ? "🏡" : "🏠";

  const cards = [
    { title: parseSpintax(slug, 'c1t', replaceVariables(card1Title, vars)), text: parseSpintax(slug, 'c1', replaceVariables(card1Text, vars)), icon: card1Icon },
    { title: parseSpintax(slug, 'c2t', replaceVariables(card2Title, vars)), text: parseSpintax(slug, 'c2', replaceVariables(card2Text, vars)), icon: card2Icon },
    { title: parseSpintax(slug, 'c3t', replaceVariables(card3Title, vars)), text: parseSpintax(slug, 'c3', replaceVariables(card3Text, vars)), icon: card3Icon }
  ];

  // ============ DYNAMIC ENERGY & REAL ESTATE BLOCKS ============
  const energyOpts = [
    `En Isère, l'isolation thermique sous toiture est l'opération la plus rentable pour réduire la consommation énergétique. En effet, près de 30% de la chaleur s'échappe par un toit mal isolé. À {VILLE}, poser une isolation sarking en fibre de bois (R≥6) ou réaliser un soufflage de ouate de cellulose dans les combles perdus permet d'abaisser les factures de chauffage de 30 à 45% en hiver et de maintenir le frais en été. Ces travaux sont éligibles aux dispositifs MaPrimeRénov' et aux primes CEE du 38.`,
    `Faire isoler sa toiture à {VILLE} ({ZIP}) protège votre logement contre les amplitudes thermiques iséroises. En isolant vos combles rampants par laine de bois ou laine de roche (R ≥ 6), vous réduisez de manière significative vos besoins en chauffage. Cette rénovation énergétique évite les déperditions thermiques par le haut de la maison et améliore le confort d'été, un atout précieux lors des chaleurs de la cuvette ou de la plaine du Dauphiné.`,
    `L'isolation de toiture à {VILLE} est un levier majeur d'économie. En optant pour la méthode du sarking (isolation par l'extérieur), vous conservez la hauteur sous plafond de vos combles aménagés tout en supprimant la totalité des ponts thermiques. Réalisé par un couvreur certifié RGE du 38, ce chantier vous donne droit aux subventions énergétiques nationales (MaPrimeRénov') et régionales.`
  ];
  const energyTemplate = energyOpts[prng.nextInt(energyOpts.length)];

  const realEstateOpts = [
    `Une toiture neuve ou entretenue avec facture décennale à l'appui est un argument majeur lors de la vente d'une maison à {VILLE}. Elle garantit à l'acheteur l'absence de frais majeurs sur les 15 prochaines années et valorise le bien sur le marché immobilier de la métropole grenobloise ou du Nord-Isère. Présenter un toit traité avec hydrofuge antigel récent et une isolation thermique certifiée améliore la note du DPE, indispensable pour la mise en vente.`,
    `Sur le marché de l'immobilier à {VILLE} ({ZIP}), la toiture est un indicateur de vétusté scruté par tous les acquéreurs. Un toit propre, sans mousses et parfaitement isolé thermiquement augmente la valeur verte de votre maison. Les factures de nettoyage hydrofuge ou de réfection complète par un artisan du 38 rassurent les acheteurs et justifient une plus-value lors des négociations de vente.`,
    `Valorisez votre patrimoine immobilier à {VILLE} grâce à une toiture impeccable. Un toit mal entretenu ou avec des tuiles poreuses décote immédiatement une bâtisse dauphinoise ou un pavillon individuel. En présentant un DPE amélioré grâce à une toiture isolée sarking et une étanchéité garantie par décennale, vous accélérez la vente de votre bien sur le marché isérois.`
  ];
  const realEstateTemplate = realEstateOpts[prng.nextInt(realEstateOpts.length)];

  // ============ DYNAMIC HEADINGS & LAYOUT SHUFFLING ============
  const headingsOptions = {
    specificities: [
      `Spécificités techniques de la couverture à ${commune.nom}`,
      `Particularités et contraintes de toiture à ${commune.nom} (${commune.codePostal})`,
      `Techniques de couverture adaptées au climat de ${commune.nom}`
    ],
    regulations: [
      `Réglementation Toiture à ${commune.nom} (38)`,
      `Normes de Couverture & Urbanisme à ${commune.nom}`,
      `Règles PLU et Sécurité de Toit à ${commune.nom}`
    ],
    prices: [
      `Tarifs des Couvreurs à ${commune.nom} en 2026`,
      `Prix Moyen Toiture à ${commune.nom} (${commune.codePostal})`,
      `Grille Tarifaire Couverture & Toiture à ${commune.nom}`
    ],
    aides: [
      `Aides & Subventions Toiture à ${commune.nom} (2026)`,
      `Subventions & Financement Toiture à ${commune.nom}`,
      `MaPrimeRénov' et aides à l'isolation de toit à ${commune.nom}`
    ],
    performance: [
      `Isolation & Valorisation Immobilière à ${commune.nom}`,
      `Performance Énergétique & Valeur de Votre Toit à ${commune.nom}`,
      `Économies d'Énergie et DPE de Votre Toiture à ${commune.nom}`
    ],
    checklist: [
      `Checklist : 6 Points à Vérifier Avant de Signer`,
      `Contrôler son Couvreur à ${commune.nom} : 6 Critères`,
      `Points de Vigilance Avant d'Engager un Artisan à ${commune.nom}`
    ],
    market: [
      `Marché de la Couverture à ${commune.nom} — Données 2026`,
      `Indicateurs Couvreurs RGE à ${commune.nom} (38)`,
      `Statistiques locales Couverture et Délais à ${commune.nom}`
    ],
    methodology: [
      `Les étapes clés d'un entretien de toiture réussi à ${commune.nom}`,
      `Protocole de Nettoyage de Toiture à ${commune.nom}`,
      `Comment se Déroule le Démoussage de Votre Toit à ${commune.nom}`
    ],
    impact: [
      `Pourquoi entretenir régulièrement sa toiture à ${commune.nom} ?`,
      `Intérêt d'un Démoussage Régulier à ${commune.nom} (${commune.codePostal})`,
      `Bénéfices du Nettoyage de Toit à ${commune.nom}`
    ]
  };

  const prngHeadings = new SeededRandom(slug + "-headings");
  const headings: Record<string, string> = {};
  for (const [key, options] of Object.entries(headingsOptions)) {
    const rawHeading = options[prngHeadings.nextInt(options.length)];
    headings[key] = parseSpintax(slug, `heading-${key}`, replaceVariables(rawHeading, vars));
  }

  let sectionOrder: string[] = [];
  if (pageType === 'refection') {
    sectionOrder = shuffleArray(['specificities', 'regulations', 'prices', 'aides', 'performance'], slug + "-refection-order");
  } else if (pageType === 'demoussage') {
    sectionOrder = shuffleArray(['methodology', 'specificities', 'prices', 'impact'], slug + "-demoussage-order");
  } else {
    sectionOrder = shuffleArray(['specificities', 'checklist', 'market'], slug + "-artisan-order");
  }

  // Parse & replace
  const finalTitle = parseSpintax(slug, 'title', replaceVariables(titleTemplate, vars));
  const finalIntro = parseSpintax(slug, 'intro', replaceVariables(introTemplate, vars));
  const finalEnergy = parseSpintax(slug, 'energy', replaceVariables(energyTemplate, vars));
  const finalRealEstate = parseSpintax(slug, 'realestate', replaceVariables(realEstateTemplate, vars));

  return {
    title: finalTitle,
    introParagraph: finalIntro,
    cards,
    sectionOrder,
    headings,
    energyProfileText: finalEnergy,
    realEstateInsight: finalRealEstate,
    // Keep legacy parameters for backward compatibility if ever needed
    climateContext: cards[0].text,
    abfRegulations: cards[1].text,
    housingTypologyInsight: cards[2].text,
    conseilLocal: commune.conseilLocal || "",
    introText: commune.introText || "",
    roofCharacteristics: commune.roofCharacteristics || null,
    faqItems: commune.faq || [],
    externalLinks: getExternalLinks(commune),
    aides: getAidesContent(commune),
    regulations: getRegulationsContent(commune),
    metadata: {
      geoZone,
      density,
      isMontagne,
      isHighAltitude,
      landmark1,
      landmark2,
      tuileDominante,
      microRegionLabel
    }
  };
}
