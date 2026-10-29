import { z } from "zod";
import {
  DEFAULT_UI_PREFERENCES,
  DENSITIES,
  LANGUAGES,
  THEMES,
} from "./ui";

export const widgetSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
]);

const KEYED_CONNECTOR_TYPES = new Set([
  "radarr",
  "sonarr",
  "plex",
  "tautulli",
  "overseerr",
]);

export const serviceSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    url: z.string().url(),
    api_key: z.string().min(1).optional(),
    token: z.string().min(1).optional(),
  })
  .superRefine((service, context) => {
    if (service.api_key && service.token) {
      context.addIssue({
        code: "custom",
        message: "A service cannot define both api_key and token",
        path: ["api_key"],
      });
      return;
    }

    if (service.type === "plex") {
      if (!service.token) {
        context.addIssue({
          code: "custom",
          message: "Plex requires a token",
          path: ["token"],
        });
      }
      return;
    }

    if (
      KEYED_CONNECTOR_TYPES.has(service.type) &&
      !service.api_key &&
      !service.token
    ) {
      context.addIssue({
        code: "custom",
        message: `${service.type} requires api_key or token`,
        path: ["api_key"],
      });
    }
  });

export const uiSchema = z.object({
  theme: z.enum(THEMES),
  language: z.enum(LANGUAGES),
  density: z.enum(DENSITIES),
});

export const configSchema = z.object({
  services: z.array(serviceSchema).default([]),
  ui: uiSchema.default(DEFAULT_UI_PREFERENCES),
  widgets: z.array(widgetSchema).default([]),
});

export type WidgetTuple = [number, number, number, number];
export type ServiceConfig = z.infer<typeof serviceSchema>;
export type UiConfig = z.infer<typeof uiSchema>;
export type Config = z.infer<typeof configSchema>;
