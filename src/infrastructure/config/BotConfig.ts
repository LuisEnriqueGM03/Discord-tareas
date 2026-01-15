export interface BotConfig {
  token: string;
  clientId: string;
  taskboardsConfigPath: string;
}

export function loadBotConfig(): BotConfig {
  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const taskboardsConfigPath = process.env.TASKBOARDS_CONFIG_PATH || './config/taskboards';

  if (!token) {
    throw new Error('DISCORD_TOKEN is required');
  }

  if (!clientId) {
    throw new Error('DISCORD_CLIENT_ID is required');
  }

  return {
    token,
    clientId,
    taskboardsConfigPath
  };
}
