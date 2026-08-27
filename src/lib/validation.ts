import { z } from "zod";

const MAX_STAT_VALUE = Number.MAX_SAFE_INTEGER;

function isHttpUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isGithubUrl(value: string) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      ["github.com", "www.github.com"].includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

const optionalUrl = z
  .string()
  .trim()
  .max(2048, "URL must be 2,048 characters or fewer.")
  .refine(isHttpUrl, "Enter a complete http:// or https:// URL.");

const statistic = z.coerce
  .number({ error: "Enter a number." })
  .int("Use a whole number.")
  .min(0, "Value cannot be negative.")
  .max(MAX_STAT_VALUE, "Value is too large.");

export const profileSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .min(3, "Username must be at least 3 characters.")
      .max(30, "Username must be 30 characters or fewer.")
      .regex(
        /^[a-z0-9][a-z0-9_-]*$/,
        "Use lowercase letters, numbers, underscores, or hyphens.",
      ),
    displayName: z
      .string()
      .trim()
      .max(60, "Display name must be 60 characters or fewer."),
    bio: z.string().trim().max(280, "Bio must be 280 characters or fewer."),
    avatarUrl: optionalUrl,
    githubUrl: optionalUrl.refine(
      isGithubUrl,
      "Enter a valid github.com profile URL.",
    ),
    websiteUrl: optionalUrl,
    linesAdded: statistic,
    linesRemoved: statistic,
    filesChanged: statistic,
    editEvents: statistic,
    projectsCount: statistic,
    codingMinutes: statistic,
    languages: z
      .array(
        z.object({
          rowId: z.string(),
          name: z
            .string()
            .trim()
            .min(1, "Language name is required.")
            .max(40, "Use 40 characters or fewer."),
          percentage: z.coerce
            .number({ error: "Enter a percentage." })
            .gt(0, "Percentage must be greater than 0.")
            .max(100, "Percentage cannot exceed 100."),
        }),
      )
      .max(12, "Add no more than 12 languages."),
  })
  .superRefine((value, context) => {
    const names = new Set<string>();

    value.languages.forEach((language, index) => {
      const normalizedName = language.name.toLowerCase();

      if (names.has(normalizedName)) {
        context.addIssue({
          code: "custom",
          message: "Each language can only appear once.",
          path: ["languages", index, "name"],
        });
      }

      names.add(normalizedName);
    });

    const percentageTotal = value.languages.reduce(
      (total, language) => total + language.percentage,
      0,
    );

    if (value.languages.length > 0 && Math.abs(percentageTotal - 100) > 0.01) {
      context.addIssue({
        code: "custom",
        message: "Language percentages must add up to 100%.",
        path: ["languages"],
      });
    }
  });

export type ProfileInput = z.infer<typeof profileSchema>;

export const authSchema = z
  .object({
    email: z.email("Enter a valid email address."),
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirmPassword: z.string().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.confirmPassword !== undefined &&
      value.password !== value.confirmPassword
    ) {
      context.addIssue({
        code: "custom",
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
    }
  });
