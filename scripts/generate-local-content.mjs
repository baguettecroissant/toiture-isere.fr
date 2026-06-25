#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const communesPath = join(__dirname, '..', 'src', 'data', 'communes.json');

if (!existsSync(communesPath)) {
  console.error('communes.json not found. Run fetch-cities.mjs first.');
  process.exit(1);
}

const communes = JSON.parse(readFileSync(communesPath, 'utf-8'));

// Seeded random helper
function hash(slug, seed = 0) {
  let h = seed * 31 + 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return (h >>> 0);
}

function pick(slug, seed, arr) {
  return arr[hash(slug, seed) % arr.length];
}

function pickN(slug, seed, arr, n) {
  const indices = [];
  const used = new Set();
  let s = seed;
  while (indices.length < n && indices.length < arr.length) {
    const idx = hash(slug, s) % arr.length;
    if (!used.has(idx)) { indices.push(idx); used.add(idx); }
    s++;
  }
  return indices.map(i => arr[i]);
}

// ──────────────────────────────────────────────────────────────
// MICRO-RÉGIONS ISÉROISES (38)
// ──────────────────────────────────────────────────────────────
const MICRO_REGIONS = {
  'grenoble-cuvette': {
    label: 'Cuvette Grenobloise',
    description: 'aire urbaine de Grenoble entourée de montagnes et soumise à de forts contrastes thermiques',
    climate: 'exposition aux brouillards stagnants en hiver, inversions thermiques régulières et chaleurs étouffantes en été',
    roofRisk: 'vieillissement prématuré des isolations, stagnation d\'humidité sous tuile et formation rapide de mousses tenaces',
    maintenanceCycle: 5,
    communes: ['grenoble', 'echirolles', 'saint-martin-d-heres', 'fontaine', 'meylan', 'saint-egreve', 'seyssinet-pariset', 'le-pont-de-claix', 'sassenage', 'claix', 'eybens', 'gieres', 'la-tronche', 'domene', 'saint-ismier', 'corenc', 'seyssins', 'varces-allieres-et-risset', 'vif', 'vizille']
  },
  'plaine-nord': {
    label: 'Plaine & Piémont du Nord-Isère',
    description: 'plaines du Bas-Dauphiné, terres froides et collines du Nord-Isère',
    climate: 'cycles de gel modérés en hiver et orages d\'été soudains accompagnés parfois de grêle',
    roofRisk: 'infiltrations d\'eau lors d\'orages de grêle et usure des tuiles romanes ou tuiles écailles traditionnelles',
    maintenanceCycle: 6,
    communes: ['vienne', 'bourgoin-jallieu', 'voiron', 'villefontaine', 'l-isle-d-abeau', 'pont-de-cheruy', 'charvieu-chavagneux', 'la-verpilliere', 'saint-quentin-fallavier', 'la-tour-du-pin', 'morestel', 'cremieu', 'saint-maurice-l-exil', 'chasse-sur-rhone', 'rooussillon', 'les-avenieres-veyrins-thuellin', 'la-cote-saint-andre', 'heyrieux', 'pont-eveque', 'val-de-virieu', 'saint-jean-de-bournay', 'tignieu-jameyzieu']
  },
  'prealpes-massifs': {
    label: 'Préalpes (Vercors & Chartreuse)',
    description: 'moyenne montagne du Vercors et du Massif de la Chartreuse',
    climate: 'enneigement hivernal important, cycles de gel-dégel fréquents (plus de 100 jours de gel par an)',
    roofRisk: 'fissuration des tuiles par le gel-dégel et glissement de couvertures sous le poids de la neige lourde',
    maintenanceCycle: 5,
    communes: ['saint-laurent-du-pont', 'villard-de-lans', 'lans-en-vercors', 'autrans-meaudre-en-vercors', 'voreppe', 'tullins', 'saint-marcellin', 'moirans', 'pont-en-royans', 'renage', 'coublevie', 'rives', 'le-grand-lemps']
  },
  'oisans-altitude': {
    label: 'Oisans & Belledonne Haute Altitude',
    description: 'hautes vallées de l\'Oisans, de Belledonne et du Grésivaudan d\'altitude',
    climate: 'climat alpin extrême avec surcharges de neige en zone de neige C2 (jusqu\'à 200 kg/m²) et gel persistant',
    roofRisk: 'surcharge de neige sur les charpentes, gel extrême éclatant les matériaux et infiltrations au dégel par capillarité',
    maintenanceCycle: 7,
    communes: ['chamrousse', 'l-alpe-d-huez', 'les-deux-alpes', 'le-bourg-d-oisans', 'allevard', 'pontcharra', 'crolles', 'villard-bonnot', 'le-versoud', 'saint-martin-d-uriage', 'froges', 'goncelin', 'livet-et-gavet']
  }
};

function getMicroRegion(slug) {
  for (const [key, region] of Object.entries(MICRO_REGIONS)) {
    if (region.communes.includes(slug)) return key;
  }
  // Fallback: classify by coordinates
  const c = communes.find(c => c.slug === slug);
  if (!c) return 'grenoble-cuvette';
  const lat = c.latitude || 45.18;
  const lon = c.longitude || 5.72;
  
  if (lon < 5.5) return 'plaine-nord';
  if (lon > 6.0) return 'oisans-altitude';
  if (lat < 45.1) return 'prealpes-massifs';
  return 'grenoble-cuvette';
}

// ──────────────────────────────────────────────────────────────
// LANDMARKS PAR COMMUNE
// ──────────────────────────────────────────────────────────────
const LANDMARKS_DB = {
  'grenoble': ['la Bastille et son téléphérique à bulles', 'le vieux Grenoble médiéval et la place de Verdun'],
  'saint-martin-d-heres': ['le campus universitaire grenoblois', 'les berges aménagées de l\'Isère'],
  'echirolles': ['le musée de la Viscose', 'la frange sud de la métropole grenobloise'],
  'fontaine': ['les falaises du Vercors dominant le Drac', 'le parc de la Poya'],
  'meylan': ['les contreforts de la Chartreuse', 'le parc d\'activités Inovallée'],
  'vienne': ['le Théâtre Antique gallo-romain', 'le temple d\'Auguste et de Livie'],
  'bourgoin-jallieu': ['les anciennes usines de tissage', 'la plaine de la Bourbre'],
  'voiron': ['la cathédrale Saint-Bruno et les caves de la Chartreuse', 'le parc de la mairie de Voiron'],
  'saint-egreve': ['le parc Barnave au pied du Néron', 'les digues de l\'Isère face au Vercors'],
  'seyssinet-pariset': ['le parc Karl Marx', 'la montée légendaire vers le Vercors'],
  'sassenage': ['les Cuves de Sassenage et le château médiéval', 'le confluent du Drac et de l\'Isère'],
  'claix': ['le Pont Lesdiguières en pierre', 'les falaises calcaires du massif du Vercors'],
  'vizille': ['le domaine national du Château de Vizille, berceau de la Révolution', 'le parc animalier de Vizille']
};

function getLandmarks(slug, region) {
  if (LANDMARKS_DB[slug]) return LANDMARKS_DB[slug];
  const fallbacks = {
    'grenoble-cuvette': ['les rives de l\'Isère et du Drac', 'la Bastille et la cuvette métropolitaine'],
    'plaine-nord': ['les collines du Bas-Dauphiné', 'les paysages agraires du Nord-Isère'],
    'prealpes-massifs': ['les falaises spectaculaires de la Chartreuse', 'les hauts plateaux sauvages du Vercors'],
    'oisans-altitude': ['les sommets enneigés des Écrins et de Belledonne', 'les vallées alpines de la Romanche']
  };
  return fallbacks[region] || ['les panoramas du Dauphiné', 'les massifs montagneux isérois'];
}

function getAltitude(slug) {
  const altitudes = {
    'grenoble': 212, 'saint-martin-d-heres': 220, 'echirolles': 230, 'fontaine': 210,
    'meylan': 260, 'vienne': 160, 'bourgoin-jallieu': 254, 'voiron': 290, 'saint-egreve': 220,
    'seyssinet-pariset': 250, 'sassenage': 200, 'claix': 280, 'villard-de-lans': 1050,
    'lans-en-vercors': 1020, 'saint-laurent-du-pont': 410, 'le-bourg-d-oisans': 720,
    'chamrousse': 1650, 'l-alpe-d-huez': 1860, 'les-deux-alpes': 1650, 'vizille': 280,
    'pontcharra': 250, 'crolles': 240, 'villard-bonnot': 230
  };
  if (altitudes[slug]) return altitudes[slug];
  
  // Fallback based on name or region
  const region = getMicroRegion(slug);
  const defaults = {
    'grenoble-cuvette': 230, 'plaine-nord': 250,
    'prealpes-massifs': 650, 'oisans-altitude': 1200
  };
  return defaults[region] || 250;
}

function getIntercommunalite(slug, region) {
  const c = communes.find(com => com.slug === slug);
  if (!c) return "Département de l'Isère";
  
  const cuvetteList = ['grenoble', 'echirolles', 'saint-martin-d-heres', 'fontaine', 'meylan', 'saint-egreve', 'seyssinet-pariset', 'le-pont-de-claix', 'sassenage', 'claix', 'eybens', 'gieres', 'la-tronche', 'domene', 'saint-ismier', 'corenc', 'seyssins', 'varces-allieres-et-risset', 'vif', 'vizille'];
  if (cuvetteList.includes(slug)) return "Grenoble-Alpes Métropole (La Métro)";
  
  if (['voiron', 'moirans', 'coublevie', 'rives', 'renage', 'tullins'].includes(slug)) {
    return "Communauté d'agglomération du Pays Voironnais";
  }
  if (['vienne', 'pont-eveque', 'chasse-sur-rhone'].includes(slug)) {
    return "Vienne Condrieu Agglomération";
  }
  if (['bourgoin-jallieu', 'villefontaine', 'l-isle-d-abeau', 'la-verpilliere', 'saint-quentin-fallavier', 'tignieu-jameyzieu'].includes(slug)) {
    return "Communauté d'agglomération Porte de l'Isère (CAPI)";
  }
  if (['crolles', 'pontcharra', 'villard-bonnot', 'le-versoud', 'froges', 'goncelin', 'allevard'].includes(slug)) {
    return "Communauté de communes du Grésivaudan";
  }
  if (['villard-de-lans', 'lans-en-vercors', 'autrans-meaudre-en-vercors'].includes(slug)) {
    return "Communauté de communes du Massif du Vercors";
  }
  if (['saint-laurent-du-pont'].includes(slug)) {
    return "Communauté de communes Cœur de Chartreuse";
  }
  if (['le-bourg-d-oisans', 'chamrousse', 'l-alpe-d-huez', 'les-deux-alpes', 'livet-et-gavet'].includes(slug)) {
    return "Communauté de communes de l'Oisans";
  }
  if (['la-tour-du-pin', 'morestel', 'cremieu', 'les-avenieres-veyrins-thuellin'].includes(slug)) {
    return "Communauté de communes des Balcons du Dauphiné";
  }
  if (['saint-marcellin', 'pont-en-royans'].includes(slug)) {
    return "Saint-Marcellin Vercors Isère Communauté";
  }
  
  return "Département de l'Isère";
}

// ──────────────────────────────────────────────────────────────
// HABITAT DESCRIPTIONS
// ──────────────────────────────────────────────────────────────
const HABITAT_BY_REGION = {
  'grenoble-cuvette': [
    "pavillons des faubourgs grenoblois aux charpentes traditionnelles en sapin et immeubles de la cuvette couverts de tuiles romanes ou mécaniques",
    "maisons anciennes de la métropole iséroise avec toitures en tuiles terre cuite scellées",
    "résidences de copropriétés aux toitures-terrasses avec complexes d'étanchéité bitumineux, soumises aux variations thermiques de la cuvette",
    "villas individuelles des coteaux de Chartreuse arborant des tuiles à fort emboîtement résistant à l'humidité"
  ],
  'plaine-nord': [
    "bastides et maisons dauphinoises traditionnelles en pisé et pierre calcaire locale, coiffées de tuiles écailles plates dauphinoises",
    "villas contemporaines des lotissements du Bas-Dauphiné à toitures en tuiles romanes ocre rouge",
    "pavillons résidentiels aux charpentes industrielles en fermettes et couvertures mécaniques",
    "fermes dauphinoises restaurées conservant leurs charpentes bois massives à pans escarpés (>45°)"
  ],
  'prealpes-massifs': [
    "maisons traditionnelles en pierre de Chartreuse aux toits escarpés pour l'évacuation naturelle de la neige",
    "chalets en bois du Vercors avec couvertures en tuiles béton ou ardoises de moyenne montagne",
    "granges et maisons de bourg réhabilitées avec isolation thermique sarking et arrêt de neige (crochets)",
    "constructions montagnardes typiques dotées de contre-lattages ventilés pour faire face au gel"
  ],
  'oisans-altitude': [
    "chalets d'altitude massifs aux charpentes renforcées en mélèze ou sapin de pays, conçues pour supporter la charge neige zone C2",
    "refuges et maisons de village perchées avec couvertures historiques en lauze calcaire dauphinoise ou ardoise naturelle",
    "résidences des stations de sports d'hiver avec toitures à double isolation sarking haute densité et pare-vapeur étanche",
    "granges d'alpage réhabilitées avec toitures en tôle bac acier isolée ou lauze traditionnelle"
  ]
};

function getHabitatType(slug, region) {
  if (slug === 'grenoble') return "immeubles du centre historique de Grenoble aux toitures en tuiles anciennes ou zinc, copropriétés urbaines des grands boulevards à toits-terrasses et pavillons des berges du Drac";
  if (slug === 'voiron') return "maisons de ville voironnaises au pied des collines de la Chartreuse, pavillons des coteaux et anciennes remises couvertes de tuiles mécaniques";
  if (slug === 'vienne') return "bâtisses historiques du centre de Vienne aux toitures imbriquées en tuiles dauphinoises de terre cuite, immeubles de la vallée du Rhône et villas récentes des plateaux";
  if (slug === 'bourgoin-jallieu') return "anciennes maisons d'ouvriers textiles en pisé de la vallée de la Bourbre, pavillons individuels et complexes d'activités commerciales";
  
  const habitats = HABITAT_BY_REGION[region] || HABITAT_BY_REGION['grenoble-cuvette'];
  return pick(slug, 12, habitats);
}

// ──────────────────────────────────────────────────────────────
// ROOF CHARACTERISTICS
// ──────────────────────────────────────────────────────────────
function getRoofCharacteristics(slug, region) {
  const chars = {
    'grenoble-cuvette': { tuileDominante: 'Tuile mécanique romane ou tuiles plates rouges', fixation: 'Crochets galvanisés renforcés et fixations mécaniques', ventilation: 'Chatières de ventilation haute/basse', ecran: 'Écran de sous-toiture HPV respirant anti-humidité' },
    'plaine-nord': { tuileDominante: 'Tuile écaille dauphinoise ou tuile romane rouge-ocre', fixation: 'Crochets et clous de fixation galvanisés conformes DTU 40.21', ventilation: 'Closoirs de faîtage ventilés et chatières terre cuite', ecran: 'Écran pare-pluie HPV renforcé' },
    'prealpes-massifs': { tuileDominante: 'Tuile terre cuite résistante au gel ou ardoise naturelle', fixation: 'Crochets en acier inoxydable et arrêts de neige (crochets)', ventilation: 'Double lame d\'air ventilée sous contre-lattage', ecran: 'Écran pare-neige renforcé et pare-vapeur étanche à l\'air' },
    'oisans-altitude': { tuileDominante: 'Ardoise naturelle d\'altitude ou lauze calcaire dauphinoise', fixation: 'Crochets inox renforcés et vis de charpente renforcées', ventilation: 'Closoir ventilé résistant à l\'obstruction par le givre', ecran: 'Membrane pare-neige renforcée d\'altitude et isolation sarking' }
  };
  return chars[region] || chars['grenoble-cuvette'];
}

// ──────────────────────────────────────────────────────────────
// TEMPLATES D'INTRO STRUCTURELLEMENT DIFFÉRENTS
// ──────────────────────────────────────────────────────────────
function getLocalIntroText(commune, region) {
  const { nom, slug, population, codePostal } = commune;
  const habitat = getHabitatType(slug, region);
  const regionData = MICRO_REGIONS[region];
  const landmarks = getLandmarks(slug, region);
  const altitude = getAltitude(slug);
  const pop = population.toLocaleString('fr-FR');

  const templates = [
    () => `Située ${altitude > 400 ? `à ${altitude}m d'altitude` : 'au cœur du Dauphiné'}, la commune de ${nom} (${pop} habitants) possède un parc de logements caractérisé par ${habitat}. ${regionData.climate.charAt(0).toUpperCase() + regionData.climate.slice(1)} : ici, les toitures subissent directement un ${regionData.roofRisk}. Proche de ${landmarks[0]}, les artisans couvreurs alpins du 38 appliquent des techniques de charpente et de couverture renforcées pour pérenniser l'étanchéité de votre toit.`,
    
    () => `Le secteur de ${nom} en Isère est exposé à des contraintes climatiques alpines marquées : ${regionData.climate}. Les ${pop} résidents de la commune habitent dans des logements de type ${habitat}, exigeant une expertise de couverture solide. À proximité de ${landmarks[0]}, chaque rénovation de toiture doit anticiper les risques de ${regionData.roofRisk} en choisissant des matériaux à haute résistance.`,
    
    () => `${nom} (${codePostal}), commune de ${pop} habitants, présente un tissu urbain typique du ${regionData.label}. Le parc immobilier, constitué de ${habitat}, nécessite des interventions de toiture ciblées. Les conditions météo locales — ${regionData.climate} — obligent les couvreurs-charpentiers du 38 à maîtriser parfaitement la pose de tuiles ou d'ardoises adaptées à ${regionData.description}.`,
    
    () => `Les toits de ${nom} partagent des contraintes communes liées à leur situation géographique dans la zone de ${regionData.description}. Les habitations de la commune, principalement composées de ${habitat}, font face à ${regionData.climate}. Avec ${pop} habitants et la proximité de ${landmarks[0]}, la commune exige de ses artisans une protection efficace contre ${regionData.roofRisk}.`,
    
    () => `Entretenir sa toiture à ${nom} est crucial en raison de ${regionData.climate}. Les toits de cette ville de ${pop} habitants — ${habitat} — requièrent un plan d'entretien régulier tous les ${regionData.maintenanceCycle} ans. Proche de ${landmarks[0]}, ${nom} bénéficie de l'expérience de couvreurs locaux formés aux spécificités de la zone ${regionData.label}.`,
    
    () => `Niché dans ${regionData.description}, ${nom} abrite ${pop} habitants dont les toitures de ${habitat} subissent les assauts de ${regionData.climate}. Le problème majeur des couvertures locales reste ${regionData.roofRisk}. Les couvreurs qualifiés RGE du 38 intervenant sur ${nom} maîtrisent ces problématiques et choisissent des fixations et écrans de sous-toiture conformes aux exigences du climat isérois.`,
    
    () => `À ${nom} (${codePostal}), les travaux de toiture doivent concilier tradition dauphinoise et solidité. Cette commune de ${pop} habitants, située dans ${regionData.description}, regroupe des bâtisses composées de ${habitat}. ${regionData.climate.charAt(0).toUpperCase() + regionData.climate.slice(1)} augmente les risques de ${regionData.roofRisk}, rendant indispensable l'intervention d'un artisan couvreur certifié de l'Isère.`,
    
    () => `Le climat de l'Isère met à l'épreuve les toitures de ${nom}. L'hiver amène le gel persistant et de lourdes charges de neige en montagne, tandis que l'été apporte de violents orages et de fortes chaleurs. Le bâti de cette commune de ${pop} habitants — ${habitat} — demande des techniques de pose robustes. Les couvreurs du secteur de ${regionData.label} adaptent leur savoir-faire à ${regionData.description}.`
  ];

  return pick(slug, 22, templates)();
}

// ──────────────────────────────────────────────────────────────
// CONSEIL LOCAL
// ──────────────────────────────────────────────────────────────
function getLocalAdvice(commune, region) {
  const { nom, slug, codePostal } = commune;
  const regionData = MICRO_REGIONS[region];
  const altitude = getAltitude(slug);

  const advices = [
    `Après des chutes de neige importantes sur ${nom}, observez votre toiture pour vérifier le bon alignement de vos crochets d'arrêt de neige. Si des glissements de tuiles se sont produits, faites intervenir un couvreur du 38 pour une réfection de sécurité afin d'éviter des infiltrations lors de la fonte.`,
    `Dans le secteur de ${nom} (${regionData.label}), un nettoyage basse pression avec application d'un hydrofuge résistant au gel tous les ${regionData.maintenanceCycle} ans protège vos tuiles terre cuite contre l'éclatement dû aux cycles de gel-dégel.`,
    `Pour isoler votre toiture par l'extérieur (technique de sarking) à ${nom} et profiter des aides régionales ou de MaPrimeRénov', engagez impérativement un professionnel certifié RGE Qualibat disposant d'une assurance décennale toiture valide en Isère.`,
    `Les fortes charges de neige en altitude peuvent déformer les chevrons à ${nom}. Faites vérifier régulièrement la planéité de votre structure bois et renforcez la charpente si vous prévoyez de passer d'une couverture légère à des tuiles béton plus lourdes.`,
    `Avant de changer le matériau de couverture (de la tuile à l'ardoise ou inversement) à ${nom} (${codePostal}), consultez le Plan Local d'Urbanisme (PLU) en mairie. Les toits en lauze ou en ardoise sont souvent protégés dans les communes du Dauphiné.`,
    `Si votre habitation à ${nom} se situe dans le périmètre d'un site historique (comme à Vizille ou à Vienne), la rénovation de toiture devra obtenir l'aval des Architectes des Bâtiments de France (ABF) qui imposent des tuiles écaille ou de l'ardoise naturelle de pays.`,
    `Exigez de votre artisan couvreur intervenant sur ${nom} son attestation de garantie décennale toiture à jour. Ce document est indispensable pour vous protéger pendant 10 ans contre tout défaut d'étanchéité ou faiblesse structurelle de la charpente sous l'effet de la charge neige.`,
    `La proximité des sapins et forêts autour de votre maison à ${nom} encombrent régulièrement les gouttières d'aiguilles et de feuilles mortes. Nettoyez les descentes d'eaux pluviales avant l'automne et le gel pour prévenir les débordements sous toiture et la casse des cheneaux par le gel de l'eau stagnante.`,
    `En cas d'infiltration ou de tuile cassée par le gel à ${nom}, prenez des photos immédiates des dégâts intérieurs et sous-toiture. Votre déclaration à l'assurance doit se faire sous 5 jours ouvrés, accompagnée d'un devis de bâchage d'urgence établi par un couvreur local.`,
    altitude > 500
      ? `En altitude à ${nom} (${altitude}m), les crochets anti-avalanche et arrêts de neige en acier galvanisé ou inox sont indispensables. Ils retiennent la couche de neige pour éviter les chutes massives sur les voies publiques ou les entrées de garage.`
      : `La cuvette thermique à ${nom} surchauffe les toitures en été. Assurez-vous d'une ventilation sous toiture optimale avec des chatières réglementaires et un faîtage à sec ventilé pour réduire la température intérieure sous les combles de votre pavillon.`
  ];

  return pick(slug, 28, advices);
}

// ──────────────────────────────────────────────────────────────
// FAQ
// ──────────────────────────────────────────────────────────────
function getLocalFAQ(commune, region) {
  const { nom, slug, codePostal, population } = commune;
  const regionData = MICRO_REGIONS[region];
  const altitude = getAltitude(slug);

  const universalPool = [
    {
      q: `Quel est le prix moyen au m² d'une réfection de toiture à ${nom} ?`,
      a: `Le coût moyen pour refaire un toit à ${nom} varie selon le matériau choisi et la pente de la toiture. Prévoyez entre 90€ et 145€ le m² TTC pour des tuiles béton ou terre cuite résistantes au gel, et de 130€ à 200€ le m² TTC pour de l'ardoise naturelle avec pose au crochet inox. Les chantiers de lauze traditionnelle oscillent quant à eux entre 200€ et 350€ le m² TTC.`
    },
    {
      q: `Faut-il choisir de l'ardoise ou de la tuile en altitude à ${nom} ?`,
      a: `En altitude à ${nom}, l'ardoise naturelle ou la tuile terre cuite haute qualité certifiée antigel sont recommandées. L'ardoise est très résistante au gel-dégel et glisse facilement la neige. La tuile terre cuite offre une excellente inertie thermique mais doit être certifiée NF EN 539-2 niveau 1 pour le gel.`
    },
    {
      q: `Quelle est la durée de vie moyenne d'une couverture en Isère ?`,
      a: `Une couverture en ardoise ou en tuile terre cuite à ${nom} peut durer de 50 à 80 ans si elle est bien entretenue. En montagne, les cycles réguliers de gel-dégel et le poids de la neige exigent un nettoyage doux et une vérification d'étanchéité tous les ${regionData.maintenanceCycle} ans.`
    },
    {
      q: `Peut-on obtenir des aides de l'État pour l'isolation de sa toiture à ${nom} ?`,
      a: `Oui, pour des travaux d'isolation thermique sous toiture (combles ou sarking de toiture) à ${nom} (${codePostal}), vous pouvez bénéficier des subventions MaPrimeRénov', des primes CEE, et d'une TVA réduite à 5,5%. Les chantiers doivent obligatoirement être réalisés par une entreprise certifiée RGE.`
    },
    {
      q: `Faut-il déposer une déclaration de travaux en mairie de ${nom} ?`,
      a: `Oui, une réfection de toiture avec modification des matériaux (couleur, forme de tuile, passage à l'ardoise) ou pose de fenêtres de toit (Velux) nécessite le dépôt d'une déclaration préalable de travaux (DP) au service urbanisme de la mairie de ${nom}.`
    }
  ];

  const altitudePool = [
    {
      q: `Les crochets arrêts de neige sont-ils obligatoires à ${nom} ?`,
      a: `Oui, les arrêts de neige (ou crochets anti-avalanche) sont fortement préconisés et souvent obligatoires en Isère au-dessus de 500m d'altitude comme à ${nom}. Ils empêchent le glissement brutal de la couche de neige lourde qui pourrait arracher les gouttières ou blesser des passants.`
    },
    {
      q: `Comment isoler sa toiture face aux hivers extrêmes à ${nom} ?`,
      a: `Pour faire face aux hivers rigoureux de ${nom}, la méthode d'isolation par l'extérieur (le sarking) est idéale. Elle consiste à poser des panneaux isolants rigides en fibre de bois ou en polyuréthane directement sur les chevrons, éliminant les ponts thermiques et conservant l'espace intérieur des combles.`
    }
  ];

  const plainePool = [
    {
      q: `Quelle tuile choisir pour une maison dauphinoise typique à ${nom} ?`,
      a: `Pour conserver le cachet historique des maisons dauphinoises du Nord-Isère, la tuile écaille (tuile plate dauphinoise en terre cuite) de teinte ocre ou rouge vieilli est fortement recommandée. Elle respecte l'identité architecturale locale encadrée par le PLU de ${nom}.`
    },
    {
      q: `Comment nettoyer sa toiture sans abîmer les tuiles en Isère ?`,
      a: `Nous préconisons un nettoyage doux par brossage manuel et rinçage à basse pression contrôlée. L'utilisation de nettoyeurs haute pression de type Kärcher à pleine puissance est déconseillée car elle rend les tuiles poreuses et sensibles aux futures gelées hivernales à ${nom}.`
    }
  ];

  let pool = [...universalPool];
  if (region === 'oisans-altitude' || region === 'prealpes-massifs' || altitude > 500) {
    pool.push(...altitudePool);
  } else {
    pool.push(...plainePool);
  }

  const count = (hash(slug, 35) % 2) + 4; // 4 or 5
  return pickN(slug, 15, pool, count);
}

// ──────────────────────────────────────────────────────────────
// MARKET DATA
// ──────────────────────────────────────────────────────────────
function getMarketData(commune, region) {
  const { slug, population } = commune;
  const h = hash(slug, 8);

  let rgeCount = 2;
  if (population > 100000) rgeCount = 45;
  else if (population > 50000) rgeCount = 22;
  else if (population > 20000) rgeCount = 12;
  else if (population > 10000) rgeCount = 6;
  else if (population > 5000) rgeCount = 4;
  rgeCount += (h % 3);
  rgeCount = Math.max(1, rgeCount);

  const priceMultiplier = {
    'grenoble-cuvette': 1.10, 'plaine-nord': 0.98,
    'prealpes-massifs': 1.05, 'oisans-altitude': 1.18
  };
  const mult = priceMultiplier[region] || 1.00;

  const basePriceRef = Math.round((95 + (h % 30)) * mult);
  const basePriceDem = Math.round((15 + (h % 8)) * mult);

  return {
    couvreursRGE: rgeCount,
    prixM2Refection: basePriceRef,
    prixM2Demoussage: basePriceDem,
    delaiMoyenJours: 4 + (h % 10) // 4 to 13 days
  };
}

// ──────────────────────────────────────────────────────────────
// MAIN: ENRICHIR TOUTES LES COMMUNES
// ──────────────────────────────────────────────────────────────
console.log('Enriching communes data for Isere...');

const enriched = communes.map(commune => {
  const region = getMicroRegion(commune.slug);
  const regionData = MICRO_REGIONS[region];
  const intercommunalite = getIntercommunalite(commune.slug, region);
  const intro = getLocalIntroText(commune, region);
  const advice = getLocalAdvice(commune, region);
  const faq = getLocalFAQ(commune, region);
  const market = getMarketData(commune, region);
  const landmarks = getLandmarks(commune.slug, region);
  const altitude = getAltitude(commune.slug);
  const roofChars = getRoofCharacteristics(commune.slug, region);

  return {
    ...commune,
    intercommunalite,
    microRegion: region,
    microRegionLabel: regionData.label,
    altitude,
    landmarks,
    roofCharacteristics: roofChars,
    introText: intro,
    conseilLocal: advice,
    faq: faq,
    marketData: market
  };
});

writeFileSync(communesPath, JSON.stringify(enriched, null, 2), 'utf-8');

// Verification stats
const introTexts = enriched.map(c => c.introText);
const uniqueIntros = new Set(introTexts);
const faqSets = enriched.map(c => c.faq.map(f => f.q).join('|'));
const uniqueFaqs = new Set(faqSets);
const uniqueConseils = new Set(enriched.map(c => c.conseilLocal));

console.log(`Enriched ${enriched.length} Isere communes.`);
console.log(`   Unique intros: ${uniqueIntros.size} / ${enriched.length}`);
console.log(`   Unique FAQs: ${uniqueFaqs.size} / ${enriched.length}`);
console.log(`   Unique Conseils: ${uniqueConseils.size} / ${enriched.length}`);

console.log('\nSample Grenoble intro:\n', enriched.find(c => c.slug === 'grenoble').introText);
console.log('\nSample Vienne intro:\n', enriched.find(c => c.slug === 'vienne').introText);
console.log('\nSample Villard-de-Lans intro:\n', enriched.find(c => c.slug === 'villard-de-lans').introText);
