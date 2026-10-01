import { BROKER_REGISTRY } from "@/core/broker";
import { loadConfig } from "@/server/config";
import { primaryAccount } from "@/server/trading-service";
import { withUser } from "@/server/http";
import { getDb } from "@/db/client";

export async function GET() {
  return withUser((user) => {
    const account = primaryAccount(user.userId);
    const meta = getDb().prepare("SELECT label, has_key FROM broker_credentials_metadata WHERE account_id = ?").all(account.id);
    const config = loadConfig();
    return {
      accounts: [
        {
          id: account.id,
          broker: account.broker,
          environment: account.environment,
          displayName: account.display_name,
          lastSync: account.last_sync_at,
          paper: true,
        },
      ],
      registry: BROKER_REGISTRY,
      credentialMetadata: meta,
      alpacaConfigured: Boolean(config.alpacaPaperKey && config.alpacaPaperSecret),
    };
  });
}
