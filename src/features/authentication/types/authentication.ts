import { z } from 'zod';
export const authSessionSchema = z.strictObject({
  configured: z.boolean(),
  state: z.enum([
    'notConfigured',
    'signedOut',
    'signedIn',
    'verificationRequired',
  ]),
  account: z
    .strictObject({
      userId: z.string().min(1).max(128),
      email: z.email().max(320),
      emailVerified: z.boolean(),
    })
    .nullable(),
});
export type AuthSession = z.infer<typeof authSessionSchema>;
