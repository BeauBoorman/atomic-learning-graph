export const CC_BY_SA_4_DEED_URL =
  "https://creativecommons.org/licenses/by-sa/4.0/";

export function licenseDeedUrl(license: string): string | undefined {
  return license === "CC-BY-SA-4.0" ? CC_BY_SA_4_DEED_URL : undefined;
}

export function licenseWithDeed(license: string): string {
  const deedUrl = licenseDeedUrl(license);
  return deedUrl ? `${license} (${deedUrl})` : license;
}
