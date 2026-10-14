import { invokeCommand } from '@/shared/infrastructure/tauri/invoke-client';
import { authSessionSchema } from '@/features/authentication/types/authentication';
async function sessionCommand(name: string, args?: Record<string, unknown>) {
  return authSessionSchema.parse(await invokeCommand<unknown>(name, args));
}
export const authenticationGateway = {
  session: () => sessionCommand('get_auth_session'),
  signIn: (email: string, password: string, signUp: boolean) =>
    sessionCommand('sign_in_account', { input: { email, password, signUp } }),
  signOut: () => sessionCommand('sign_out_account'),
  refresh: () => sessionCommand('refresh_auth_session'),
  verify: () => invokeCommand<void>('send_auth_verification'),
  reset: (email: string) =>
    invokeCommand<void>('reset_account_password', { email }),
};
