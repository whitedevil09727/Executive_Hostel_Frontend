export const PAYMENT_CATEGORIES = [
  { value: 'MEMBER_OF_PARLIAMENT_OWN_STAY', label: 'Member of Parliament (own stay)' },
  { value: 'CENTRAL_GOVT_OFFICIAL_ON_DUTY', label: 'Central Govt. Official (On Duty)' },
  { value: 'CENTRAL_GOVT_OFFICIAL_PRIVATE_VISIT', label: 'Central Govt. Official (Private visit)' },
  { value: 'STATE_GOVT_OFFICIAL_ON_DUTY', label: 'State Govt. Official (On Duty)' },
  { value: 'STATE_GOVT_OFFICIAL_PRIVATE_VISIT', label: 'State Govt. Official (Private visit)' },
  { value: 'PRIVATE_PERSONS', label: 'Private Persons' },
] as const;

export type PaymentCategoryValue = typeof PAYMENT_CATEGORIES[number]['value'];

export const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  PAYMENT_CATEGORIES.map((category) => [category.value, category.label])
);

export const LEGACY_CATEGORY_LABEL: Record<string, string> = {
  FREE: 'Member of Parliament (own stay)',
  SUBSIDIZED: 'Central Govt. Official (On Duty)',
  FULL: 'Private Persons',
};

export const paymentCategoryLabel = (value?: string) => {
  if (!value) return '';
  return CATEGORY_LABEL[value] ?? LEGACY_CATEGORY_LABEL[value] ?? value.replaceAll('_', ' ');
};

export const roomTariffKey = (room?: { property?: string; roomType?: string }) => {
  if (!room) return '';
  if (room.property === 'OOTY') return 'ootyDoubleOrThreeBeddedNonAc';
  return room.roomType === 'SUITE' ? 'coimbatoreVipSuite' : 'coimbatoreDoubleBeddedAc';
};

export const propertyTitle = (property: string) => {
  if (property === 'COIMBATORE') return 'Executive Hostel, Coimbatore';
  if (property === 'OOTY') return 'Principal Hut, Ooty';
  if (property === 'UNALLOCATED') return 'Unallocated Bookings';
  return property.charAt(0) + property.slice(1).toLowerCase();
};

export const formatINR = (amount?: number) => {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '-';
  return `Rs.${amount.toLocaleString('en-IN')}`;
};
