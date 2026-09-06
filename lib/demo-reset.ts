export const DEMO_RESET_CONFIRMATION = 'RESET SERVORA DEMO';

export function requireDemoResetConfirmation(value: unknown) {
  if (value !== DEMO_RESET_CONFIRMATION) {
    throw new Response(
      `confirm must exactly equal "${DEMO_RESET_CONFIRMATION}".`,
      { status: 400 },
    );
  }
}
