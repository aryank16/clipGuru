import "server-only";
import { env, instagramDriver } from "../env";
import { fakeClient, metaClient } from "./client";
import { instagramRepo } from "./repo";
import { instagramService } from "./service";

export const instagramRedirectUri = () => `${env().APP_URL}/api/instagram/callback`;

export function instagramSvc() {
  return instagramService({
    repo: instagramRepo(),
    client: () => {
      const d = instagramDriver();
      return d === "meta" ? metaClient() : d === "fake" ? fakeClient() : null;
    },
    redirectUri: instagramRedirectUri,
  });
}
