/** Shared SEO / schema helpers for Tax for Taxi Drivers */

export const SITE_NAME = 'Tax for Taxi Drivers';
export const SITE_URL = 'https://www.taxfortaxidrivers.co.uk';
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

export const BUSINESS = {
  name: SITE_NAME,
  legalName: 'Tax for Taxi Drivers',
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.png`,
  image: DEFAULT_OG_IMAGE,
  telephone: '+442890132083',
  email: 'info@taxfortaxidrivers.co.uk',
  description:
    'Belfast accountancy specialists helping taxi drivers and the self-employed with Self Assessment, Making Tax Digital, HMRC support and benefit claims across Northern Ireland.',
  address: {
    '@type': 'PostalAddress' as const,
    streetAddress: 'Unit 4, North City Business Centre, 2 Duncairn Gardens',
    addressLocality: 'Belfast',
    postalCode: 'BT15 2GG',
    addressRegion: 'Northern Ireland',
    addressCountry: 'GB',
  },
  geo: {
    '@type': 'GeoCoordinates' as const,
    latitude: 54.6095,
    longitude: -5.9297,
  },
  areaServed: ['Belfast', 'Northern Ireland'],
  sameAs: ['https://www.facebook.com/Taxfortaxidrivers.co.uk'],
};

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: BUSINESS.name,
    url: BUSINESS.url,
    logo: BUSINESS.logo,
    email: BUSINESS.email,
    telephone: BUSINESS.telephone,
    address: BUSINESS.address,
    sameAs: BUSINESS.sameAs,
  };
}

export function localBusinessSchema(opts?: { aggregateRating?: { ratingValue: number; reviewCount: number } }) {
  return {
    '@context': 'https://schema.org',
    '@type': ['AccountingService', 'LocalBusiness'],
    '@id': `${SITE_URL}/#business`,
    name: BUSINESS.name,
    url: BUSINESS.url,
    logo: BUSINESS.logo,
    image: BUSINESS.image,
    email: BUSINESS.email,
    telephone: BUSINESS.telephone,
    description: BUSINESS.description,
    address: BUSINESS.address,
    geo: BUSINESS.geo,
    areaServed: BUSINESS.areaServed.map((name) => ({ '@type': 'AdministrativeArea', name })),
    priceRange: '££',
    sameAs: BUSINESS.sameAs,
    ...(opts?.aggregateRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: opts.aggregateRating.ratingValue,
            reviewCount: opts.aggregateRating.reviewCount,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': `${SITE_URL}/#business` },
    inLanguage: 'en-GB',
  };
}
