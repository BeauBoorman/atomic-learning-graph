import type { AtomizedConcept, Source } from "../types";

// World-religions north-star corpus for semantic dedup.
// Every quotedText below is a verbatim substring of its source's text; tests re-verify that
// with quoteGrounded so fixture drift is caught mechanically.

export const introIslam: Source = {
  id: "intro-islam",
  title: "Introduction to Islam",
  license: "CC-BY-SA-4.0",
  author: "Fixture Author",
  text: [
    "Salat is the ritual prayer performed five times each day by observant Muslims, facing the qibla in Mecca.",
    "The five daily prayers structure the entire day around remembrance of God, from dawn until night.",
    "During the month of Ramadan, Muslims fast from dawn to sunset, abstaining from food and drink as an act of devotion called sawm.",
    "Tawhid, the absolute oneness of God, is the central doctrine of Islam and admits no partners or intermediaries.",
    "Zakat requires Muslims to give a fixed portion of their wealth to the poor each year as a purifying obligation.",
    "The obligation of almsgiving purifies wealth and binds the community of believers together in mutual care.",
  ].join("\n\n"),
};

export const introChristianity: Source = {
  id: "intro-christianity",
  title: "Introduction to Christianity",
  license: "CC-BY-4.0",
  author: "Fixture Author",
  text: [
    "Christian prayer is addressed to God through Jesus Christ, and the Lord's Prayer taught by Jesus remains its central model.",
    "During Lent, many Christians fast or give up comforts for forty days in preparation for Easter.",
    "The doctrine of the Trinity holds that one God exists eternally as three persons: Father, Son, and Holy Spirit.",
    "In communion, believers share bread and wine in remembrance of the death and resurrection of Christ.",
  ].join("\n\n"),
};

export const comparativeReligion: Source = {
  id: "comparative-religion",
  title: "Comparative Religion Reader",
  license: "CC0-1.0",
  author: "Fixture Author",
  text: [
    "In Islam the ritual prayer, known as salat, is performed five times daily at prescribed hours and is one of the Five Pillars.",
    "Christians typically pray using the words Jesus taught, and congregational prayer follows the pattern of the Lord's Prayer.",
    "Islam and Christianity are both monotheistic traditions, yet they understand the unity of God in sharply different ways.",
    "Fasting appears in both faiths, though its calendar, duration, and theological meaning differ between them.",
  ].join("\n\n"),
};

export const fixtureSources: Source[] = [introIslam, introChristianity, comparativeReligion];

function concept(
  id: string,
  title: string,
  summary: string,
  sourceId: string,
  quotedText: string,
  tags: string[],
): AtomizedConcept {
  return { id, title, summary, provenance: { sourceId, quotedText }, tags, prerequisites: [], related: [] };
}

/** MUST-MERGE cross-source pair: same idea (Islamic ritual prayer) grounded in two sources. */
export const salatIntro = concept(
  "salat-five-daily-prayers",
  "Salat: the five daily prayers",
  "Observant Muslims perform the ritual prayer five times each day facing Mecca.",
  "intro-islam",
  "Salat is the ritual prayer performed five times each day by observant Muslims, facing the qibla in Mecca.",
  ["islam", "prayer", "practice"],
);
export const salatComparative = concept(
  "ritual-prayer-in-islam",
  "Ritual prayer in Islam",
  "The Islamic ritual prayer is performed five times daily at prescribed hours.",
  "comparative-religion",
  "In Islam the ritual prayer, known as salat, is performed five times daily at prescribed hours and is one of the Five Pillars.",
  ["islam", "prayer", "five-pillars"],
);

/** MUST-MERGE same-source chunk-overlap pair: overlapping coverage of salat from adjacent chunks. */
export const salatChunkTwo = concept(
  "daily-worship-structure",
  "Daily worship structure",
  "The five daily prayers organize the Muslim day around remembrance of God.",
  "intro-islam",
  "The five daily prayers structure the entire day around remembrance of God, from dawn until night.",
  ["islam", "prayer"],
);

/** MUST-MERGE cross-source pair: Christian prayer. */
export const lordsPrayer = concept(
  "the-lords-prayer",
  "The Lord's Prayer",
  "Christian prayer is modeled on the prayer Jesus taught his disciples.",
  "intro-christianity",
  "Christian prayer is addressed to God through Jesus Christ, and the Lord's Prayer taught by Jesus remains its central model.",
  ["christianity", "prayer"],
);
export const christianPrayerComparative = concept(
  "christian-prayer-practice",
  "Christian prayer practice",
  "Christians pray using the pattern of the words Jesus taught.",
  "comparative-religion",
  "Christians typically pray using the words Jesus taught, and congregational prayer follows the pattern of the Lord's Prayer.",
  ["christianity", "prayer"],
);

/** MUST-MERGE same-source paraphrase pair: zakat described twice, non-overlapping quotes. */
export const zakatDefinition = concept(
  "zakat-almsgiving",
  "Zakat: obligatory almsgiving",
  "Muslims must give a fixed share of wealth to the poor every year.",
  "intro-islam",
  "Zakat requires Muslims to give a fixed portion of their wealth to the poor each year as a purifying obligation.",
  ["islam", "charity"],
);
export const zakatObligation = concept(
  "the-almsgiving-obligation",
  "The almsgiving obligation",
  "Almsgiving purifies wealth and binds the Muslim community together.",
  "intro-islam",
  "The obligation of almsgiving purifies wealth and binds the community of believers together in mutual care.",
  ["islam", "charity", "community"],
);

/** NEVER-MERGE doctrine pairs: same topic, different doctrine. */
export const ramadanFasting = concept(
  "ramadan-fasting-sawm",
  "Ramadan fasting (sawm)",
  "Muslims abstain from food and drink from dawn to sunset during Ramadan.",
  "intro-islam",
  "During the month of Ramadan, Muslims fast from dawn to sunset, abstaining from food and drink as an act of devotion called sawm.",
  ["islam", "fasting", "practice"],
);
export const lentenFasting = concept(
  "lenten-fasting",
  "Lenten fasting",
  "Many Christians fast for forty days before Easter.",
  "intro-christianity",
  "During Lent, many Christians fast or give up comforts for forty days in preparation for Easter.",
  ["christianity", "fasting", "practice"],
);
export const tawhid = concept(
  "tawhid-oneness-of-god",
  "Tawhid: the oneness of God",
  "Islam's central doctrine is the absolute oneness of God without partners.",
  "intro-islam",
  "Tawhid, the absolute oneness of God, is the central doctrine of Islam and admits no partners or intermediaries.",
  ["islam", "doctrine", "god"],
);
export const trinity = concept(
  "the-trinity",
  "The Trinity",
  "Christian doctrine holds that one God exists as three persons.",
  "intro-christianity",
  "The doctrine of the Trinity holds that one God exists eternally as three persons: Father, Son, and Holy Spirit.",
  ["christianity", "doctrine", "god"],
);

/** Comparative concepts that overlap both traditions topically but are their own ideas. */
export const sharedMonotheism = concept(
  "shared-monotheism",
  "Shared monotheism, divergent theology",
  "Islam and Christianity are both monotheistic yet understand God's unity differently.",
  "comparative-religion",
  "Islam and Christianity are both monotheistic traditions, yet they understand the unity of God in sharply different ways.",
  ["comparative", "doctrine", "god"],
);
export const fastingComparison = concept(
  "fasting-across-faiths",
  "Fasting across faiths",
  "Both faiths practice fasting, with different calendars and meanings.",
  "comparative-religion",
  "Fasting appears in both faiths, though its calendar, duration, and theological meaning differ between them.",
  ["comparative", "fasting"],
);

/** Standalone singleton — no near-duplicate anywhere; must pass through untouched. */
export const communion = concept(
  "communion",
  "Communion",
  "Believers share bread and wine in remembrance of Christ.",
  "intro-christianity",
  "In communion, believers share bread and wine in remembrance of the death and resurrection of Christ.",
  ["christianity", "practice"],
);

/** The full north-star candidate stream, in upstream accumulation order. */
export const northStarCandidates: AtomizedConcept[] = [
  salatIntro,
  salatChunkTwo,
  ramadanFasting,
  tawhid,
  zakatDefinition,
  zakatObligation,
  lordsPrayer,
  lentenFasting,
  trinity,
  communion,
  salatComparative,
  christianPrayerComparative,
  sharedMonotheism,
  fastingComparison,
];
