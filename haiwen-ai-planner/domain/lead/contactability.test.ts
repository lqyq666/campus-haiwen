import { expect, it } from "vitest";
import { buildLeadContact } from "./contactability";

it("defaults consent and contactability to false", () => {
  expect(
    buildLeadContact(
      { leadId: "lead-1", phone: "13800138000" },
      "2026-08-30T00:00:00.000Z"
    )
  ).toMatchObject({
    consentAt: undefined,
    consentToContact: false,
    consentVersion: "contact-consent-v0.2",
    contactable: false,
  });
});

it("only marks a contact contactable after active consent", () => {
  expect(
    buildLeadContact(
      { consentToContact: true, leadId: "lead-1", wechat: "haiwen_student" },
      "2026-08-30T00:00:00.000Z"
    )
  ).toMatchObject({
    consentAt: "2026-08-30T00:00:00.000Z",
    consentToContact: true,
    contactable: true,
  });
});
