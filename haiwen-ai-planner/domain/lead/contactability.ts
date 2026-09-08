import type { LeadContact } from "./models";

export const CONTACT_CONSENT_VERSION = "contact-consent-v0.2" as const;

type LeadContactInput = Pick<LeadContact, "leadId"> &
  Partial<
    Pick<
      LeadContact,
      | "consentToContact"
      | "email"
      | "name"
      | "phone"
      | "qq"
      | "preferredContactMethod"
      | "wechat"
    >
  >;

export function buildLeadContact(
  input: LeadContactInput,
  now: string
): LeadContact {
  const consentToContact = input.consentToContact ?? false;
  return {
    ...input,
    consentAt: consentToContact ? now : undefined,
    consentToContact,
    consentVersion: CONTACT_CONSENT_VERSION,
    contactable: consentToContact && hasContact(input),
    createdAt: now,
    updatedAt: now,
  };
}

export function hasContact(
  contact: Pick<LeadContact, "email" | "phone" | "qq" | "wechat">
) {
  return Boolean(
    contact.phone || contact.wechat || contact.qq || contact.email
  );
}

export function isContactable(contact: LeadContact | undefined) {
  return Boolean(
    contact?.consentToContact && contact.contactable && hasContact(contact)
  );
}
