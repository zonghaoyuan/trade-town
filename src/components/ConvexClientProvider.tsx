import { ReactNode } from 'react';
import { ConvexReactClient, ConvexProvider } from 'convex/react';

/**
 * Determines the Convex deployment to use.
 *
 * We perform load balancing on the frontend, by randomly selecting one of the available instances.
 * We use localStorage so that individual users stay on the same instance.
 */
export const convexDeploymentUrl = (import.meta.env.VITE_CONVEX_URL as string | undefined)?.trim();
export const hasConvexDeployment = Boolean(convexDeploymentUrl);
const convex = convexDeploymentUrl
  ? new ConvexReactClient(convexDeploymentUrl, { unsavedChangesWarning: false })
  : undefined;

export default function ConvexClientProvider({ children }: { children: ReactNode }) {
  if (!convex) {
    throw new Error('ConvexClientProvider requires VITE_CONVEX_URL.');
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
