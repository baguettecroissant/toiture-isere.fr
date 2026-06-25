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

  return {
    maprime: `MaPrimeRénov' accorde des aides substantielles à ${commune.nom} (${commune.codePostal}) pour l'isolation thermique sous toiture (jusqu'à 75€/m² selon vos revenus). En zone de montagne, l'isolation sarking haute performance (R≥6) est vivement encouragée pour diviser vos factures de chauffage.`,
    cee: `Les primes CEE (Certificats d'Économie d'Énergie) versées par les fournisseurs d'énergie s'ajoutent à MaPrimeRénov' à ${commune.nom}. Elles permettent d'obtenir entre 12 et 25 €/m² pour l'isolation de vos combles perdus ou aménagés, sans conditions de ressources.`,
    tva: `La TVA est réduite à 5,5% au lieu de 20% pour l'achat et la pose d'isolants thermiques de toiture par un artisan RGE qualifié à ${commune.nom}. Cette économie est directement déduite sur votre facture finale.`,
    anah: `L'ANAH propose le programme MaPrimeRénov' Parcours Accompagné à ${commune.nom} pour financer jusqu'à 80% d'une rénovation d'ampleur comprenant l'isolation thermique de la toiture et le renfort des structures pour les résidences anciennes.`,
    total: `En combinant MaPrimeRénov', la prime CEE de l'Isère, et la TVA réduite, les propriétaires à ${commune.nom} peuvent financer jusqu'à 65% du budget total d'isolation thermique de leur toiture.`
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

  const plu = `Le Plan Local d'Urbanisme (PLU) de ${commune.nom} fixe les règles d'aspect extérieur pour les toitures. Les matériaux traditionnels comme l'ardoise naturelle ou la tuile écaille dauphinoise sont privilégiés en village, tandis que la tuile béton ou romane grise ou rouge est fréquente sur les constructions récentes de ${commune.nom}.`;

  const risqueIncendie = isHighAltitude
    ? `En altitude à ${commune.nom} (${alt}m), le poids de la neige (zone C2) impose des sections de charpente renforcées. La charpente doit être dimensionnée selon l'Eurocode 5 pour résister aux surcharges exceptionnelles de neige de montagne pouvant dépasser 180 kg/m².`
    : `À ${commune.nom}, les toitures doivent être équipées d'écrans de sous-toiture HPV pour limiter la pénétration d'humidité due aux fortes précipitations automnales caractéristiques du climat de l'Isère.`;

  const mistral = isMontagne
    ? `À ${commune.nom}, les arrêts de neige (crochets anti-avalanche) sont indispensables. Ils retiennent la neige sur le toit pour éviter les chutes massives sur les entrées et trottoirs. La pose d'un écran pare-neige renforcé sous-toiture évite les infiltrations lors du cycle quotidien de gel-dégel.`
    : `À ${commune.nom}, les vents soufflant le long de la vallée du Rhône ou de la cuvette grenobloise imposent des fixations mécaniques individuelles renforcées des tuiles de rive et de faîtage, conformément à la norme DTU 40.21.`;

  const abf = `Si votre maison à ${commune.nom} est située à proximité d'un monument historique ou dans un village préservé, tout projet de toiture devra faire l'objet d'une validation des Architectes des Bâtiments de France (ABF) avec un délai d'instruction supplémentaire de 3 à 4 mois.`;

  return { plu, risqueIncendie, mistral, abf };
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
    if (isMontagne) {
      introTemplate = "Vous recherchez un couvreur spécialisé en montagne à {VILLE} ({ZIP}) ? À {ALTITUDE} m d'altitude dans le massif de la {MICRO_REGION}, les toitures doivent faire face à des conditions extrêmes : de fortes chutes de neige lourde en zone C2, des cycles intenses de gel-dégel et des pentes escarpées. Nos couvreurs partenaires rénovent votre couverture (ardoise naturelle, tuile certifiée antigel, lauze calcaire) entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, pose et dépose incluses, avec renforcement de charpente et crochets arrêts de neige réglementaires.";
    } else if (geoZone === 'cuvette') {
      introTemplate = "Votre toiture à {VILLE} ({ZIP}) nécessite des travaux de rénovation ? L'humidité stagnante de la cuvette grenobloise et les amplitudes thermiques annuelles fatiguent prématurément les isolants et les tuiles en terre cuite de la métropole. Proche de {LANDMARK1}, les artisans couvreurs du 38 refont votre couverture et renforcent votre isolation sous toiture pour un budget moyen compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, avec garantie décennale de 10 ans.";
    } else {
      introTemplate = "Votre toiture à {VILLE} en Isère nécessite une intervention spécialisée ? Dans la plaine du Nord-Isère, les maisons dauphinoises traditionnelles en pisé et les pavillons résidentiels de {VILLE} ({ZIP}) exigent une couverture résistante aux fortes tempêtes de grêle estivales et au froid hivernal continental. Les charpentiers-couvreurs du 38 rénovent votre toit à {VILLE} pour un budget moyen compris entre {MIN_PRIX_REF}€ et {MAX_PRIX_REF}€ le m² TTC, normes d'étanchéité incluses.";
    }
  } else if (pageType === 'demoussage') {
    if (isMontagne) {
      introTemplate = "Votre toiture à {VILLE} ({ZIP}) est recouverte de lichens ou de mousses ? Le gel persistant combiné à l'humidité de la neige en montagne fait éclater les tuiles devenues poreuses sous l'effet des lichens d'altitude. Un démoussage rigoureux suivi de l'application d'un traitement hydrofuge siloxane incolore antigel est indispensable pour préserver votre toit des hivers rigoureux à {VILLE}. Budget moyen : {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m².";
    } else {
      introTemplate = "Besoin d'un entretien de toiture professionnel à {VILLE} ({ZIP}) ? L'humidité hivernale et les fortes chaleurs estivales favorisent le développement d'algues et de mousses noires sur les couvertures de {VILLE}. Nos couvreurs partenaires réalisent le nettoyage, l'application d'un algicide professionnel et l'imperméabilisation par hydrofuge de vos tuiles romanes ou dauphinoises pour {MIN_PRIX_DEM}€ à {MAX_PRIX_DEM}€/m² TTC.";
    }
  } else {
    introTemplate = "Besoin d'un couvreur de confiance certifié RGE à {VILLE} ({ZIP}) ? Pour la rénovation de tuiles écaille dauphinoises, la pose d'ardoises naturelles, l'étanchéité de toitures-terrasses, ou la pose d'une isolation sarking performante ouvrant droit aux aides de l'État, comparez gratuitement jusqu'à 3 offres de couvreurs assurés en décennale actifs dans le secteur de {VILLE} et ses environs ({PROX_C1}, {PROX_C2}).";
  }

  // ============ CLIMATE CONTEXT TEMPLATES (Isère specific) ============
  let climateTemplate = "";
  if (isMontagne) {
    climateTemplate = "À {VILLE}, le climat montagnard du massif de la {MICRO_REGION} expose les bâtiments à des charges neigeuses classées en zone de neige C2 (jusqu'à 200 kg/m²). Les charpentes doivent posséder des sections de bois renforcées et un contre-lattage ventilé robuste. Les cycles répétés de gel-dégel (entre 80 et 120 nuits de gel par an à {VILLE}) font éclater les tuiles ordinaires. L'utilisation d'ardoise naturelle de qualité ou de tuiles de terre cuite certifiées antigel (EN 539-2) posées avec des crochets inox renforcés et des crochets arrêts de neige est obligatoire au-dessus de 500m d'altitude pour sécuriser les abords du chalet.";
  } else if (geoZone === 'cuvette') {
    climateTemplate = "À {VILLE} ({ZIP}), la cuvette grenobloise subit des inversions thermiques marquées provoquant des brouillards givrants prolongés en hiver et des pics de chaleur étouffante en été. Cette amplitude thermique élevée accélère la fatigue mécanique des tuiles et des isolations de toiture. La stagnation de l'humidité favorise la prolifération rapide de mousses et lichens. Pour assurer la durabilité de votre toit à {VILLE}, la pose d'un écran de sous-toiture respirant HPV (Haute Perméabilité à la Vapeur) de classe R2 et une ventilation croisée avec chatières hautes et basses sont requises.";
  } else {
    climateTemplate = "Dans le secteur de {VILLE} en Bas-Dauphiné, le climat continental engendre de violents orages d'été accompagnés de grêle. Les toitures dauphinoises traditionnelles en pisé se caractérisent par des pentes de toit fortes, souvent supérieures à 45°, pour évacuer rapidement l'eau. Ces toitures nécessitent une pose soignée de tuiles écaille ou de tuiles romanes avec fixation mécanique renforcée sur chaque rive et au faîtage selon le DTU 40.21, afin d'éviter les glissements de couverture lors des fortes rafales de vent.";
  }

  // ============ ABF / PLU REGULATIONS (Isère specific) ============
  const abfTemplate = "Le Plan Local d'Urbanisme (PLU) de {VILLE} définit de manière précise les critères architecturaux à respecter pour préserver l'harmonie du paysage dauphinois. {Les tuiles écaille plates de coloris rouge vieilli ou ocre|L'ardoise naturelle de pays posée sur liteaux} est généralement exigée dans les centres anciens de {VILLE} pour préserver le patrimoine. Pour tout projet modifiant l'aspect extérieur de votre toiture à {VILLE} ou si votre bâtiment se situe dans le périmètre de protection d'un monument historique (comme {LANDMARK1}), l'accord préalable de l'Architecte des Bâtiments de France (ABF) est obligatoire. Les couvreurs professionnels du 38 vous guident dans l'élaboration de votre dossier administratif.";

  // ============ HOUSING TYPOLOGY (Isère specific) ============
  let housingTemplate = "";
  if (isMontagne) {
    housingTemplate = "L'habitat à {VILLE} se compose principalement de chalets en bois traditionnels, de résidences de vacances en station de ski, et de granges d'alpage réhabilitées. Les charpentes de ces bâtisses sont construites en madriers et poutres épaisses en résineux de pays (mélèze, sapin) pour supporter le poids cumulé de la neige. La proximité des forêts d'altitude à {VILLE} favorise le dépôt d'aiguilles de pin et de brindilles qui obstruent les gouttières : les couvreurs locaux préconisent l'installation de protège-gouttières métalliques renforcés pour éviter la déformation des cheneaux par le gel de l'eau stagnante en hiver.";
  } else if (geoZone === 'cuvette') {
    housingTemplate = "À {VILLE} ({POPULATION} habitants), l'urbanisme de la cuvette grenobloise regroupe à la fois des copropriétés urbaines en béton à toits-terrasses et des pavillons résidentiels édifiés à partir des années 1960. Les interventions sur ces copropriétés exigent une logistique stricte (installation d'échafaudages homologués, périmètres de sécurité, autorisations de voirie pour les camions-bennes). La toiture type est en tuile mécanique double emboîtement. Les diagnostics de charpente pour détecter la présence de champignons lignivores ou d'insectes à larves xylophages (capricornes) sont conseillés avant toute rénovation de toiture.";
  } else {
    housingTemplate = "Dans le Nord-Isère près de {VILLE}, l'architecture traditionnelle est marquée par la maison dauphinoise en pisé dotée d'une charpente en bois de chêne massif à fortes pentes et larges débords de toit (les génoises en tuiles ou bandeaux bois débordants) pour protéger les murs en terre des intempéries. La toiture dauphinoise classique est couverte de tuiles écaille plates. Ces charpentes historiques exigent une grande technicité lors des travaux de réfection afin de ne pas déséquilibrer la structure porteuse fragile en pisé.";
  }

  // ============ ENERGY PROFILE ============
  const energyTemplate = "En Isère, l'isolation thermique sous toiture est l'opération la plus rentable pour réduire la consommation énergétique. En effet, près de 30% de la chaleur s'échappe par un toit mal isolé. À {VILLE}, poser une isolation sarking en fibre de bois (R≥6) ou réaliser un soufflage de ouate de cellulose dans les combles perdus permet d'abaisser les factures de chauffage de 30 à 45% en hiver et de maintenir le frais en été. Ces travaux sont éligibles aux dispositifs MaPrimeRénov' et aux primes CEE du 38.";

  const realEstateTemplate = "Une toiture neuve ou entretenue avec facture décennale à l'appui est un argument majeur lors de la vente d'une maison à {VILLE}. Elle garantit à l'acheteur l'absence de frais majeurs sur les 15 prochaines années et valorise le bien sur le marché immobilier de la métropole grenobloise ou du Nord-Isère. Présenter un toit traité avec hydrofuge antigel récent et une isolation thermique certifiée améliore la note du DPE, indispensable pour la mise en vente.";

  // Parse & replace
  const finalTitle = replaceVariables(parseSpintax(slug, 'title', titleTemplate), vars);
  const finalIntro = replaceVariables(parseSpintax(slug, 'intro', introTemplate), vars);
  const finalClimate = replaceVariables(parseSpintax(slug, 'climate', climateTemplate), vars);
  const finalAbf = replaceVariables(parseSpintax(slug, 'abf', abfTemplate), vars);
  const finalHousing = replaceVariables(parseSpintax(slug, 'housing', housingTemplate), vars);
  const finalEnergy = replaceVariables(parseSpintax(slug, 'energy', energyTemplate), vars);
  const finalRealEstate = replaceVariables(parseSpintax(slug, 'realestate', realEstateTemplate), vars);

  return {
    title: finalTitle,
    introParagraph: finalIntro,
    climateContext: finalClimate,
    abfRegulations: finalAbf,
    housingTypologyInsight: finalHousing,
    energyProfileText: finalEnergy,
    realEstateInsight: finalRealEstate,
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
