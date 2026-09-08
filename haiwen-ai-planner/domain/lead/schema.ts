import { z } from "zod";

const optional = z
  .string()
  .trim()
  .max(64)
  .transform((value) => value || undefined)
  .optional();
export const leadContactSchema = z
  .object({
    consentToContact: z.boolean().default(false),
    email: z.string().trim().email().optional().or(z.literal("")),
    name: optional,
    phone: z
      .string()
      .trim()
      .regex(/^1\d{10}$/)
      .optional()
      .or(z.literal("")),
    preferredContactMethod: z
      .enum(["PHONE", "WECHAT", "QQ", "EMAIL"])
      .optional(),
    qq: z
      .string()
      .trim()
      .regex(/^\d{5,12}$/)
      .optional()
      .or(z.literal("")),
    wechat: z.string().trim().max(32).optional().or(z.literal("")),
  })
  .superRefine((value, context) => {
    if (!(value.phone || value.wechat || value.qq || value.email)) {
      context.addIssue({ code: "custom", message: "至少提供一种有效联系方式" });
    }
  });
