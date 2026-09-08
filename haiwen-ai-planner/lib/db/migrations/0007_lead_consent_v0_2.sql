ALTER TABLE lead_contacts
  ADD COLUMN contact_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN consent_at timestamptz,
  ADD COLUMN consent_version text NOT NULL DEFAULT 'contact-consent-v0.2',
  ADD COLUMN contactable boolean NOT NULL DEFAULT false;

UPDATE lead_contacts
SET contact_consent = consent_to_contact,
    consent_at = CASE WHEN consent_to_contact THEN updated_at ELSE NULL END,
    contactable = consent_to_contact AND (phone IS NOT NULL OR wechat IS NOT NULL OR email IS NOT NULL);

ALTER TABLE lead_contacts
  ADD CONSTRAINT lead_contacts_contactable_requires_consent
  CHECK (NOT contactable OR contact_consent);

CREATE INDEX lead_contacts_contactable_idx
  ON lead_contacts (contactable, updated_at DESC);
