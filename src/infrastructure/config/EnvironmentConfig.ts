export interface AuditLogChannelsConfig {
  tareasIniciadas?: string;
  tareasTerminadas?: string;
  cooldownTerminados?: string;
  dmMandados?: string;
  tareasReseteadas?: string;
}

export interface EnvironmentConfig {
  nodeEnv: string;
  logLevel: string;
  persistenceType: 'json' | 'typeorm';
  schedulerCheckInterval: number;
  auditLogChannels: AuditLogChannelsConfig;
}

export function loadEnvironmentConfig(): EnvironmentConfig {
  return {
    nodeEnv: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info',
    persistenceType: (process.env.PERSISTENCE_TYPE as 'json' | 'typeorm') || 'json',
    schedulerCheckInterval: parseInt(process.env.SCHEDULER_CHECK_INTERVAL || '60000', 10),
    auditLogChannels: {
      tareasIniciadas: process.env.LOG_CHANNEL_TAREAS_INICIADAS || undefined,
      tareasTerminadas: process.env.LOG_CHANNEL_TAREAS_TERMINADAS || undefined,
      cooldownTerminados: process.env.LOG_CHANNEL_COOLDOWN_TERMINADOS || undefined,
      dmMandados: process.env.LOG_CHANNEL_DM_MANDADOS || undefined,
      tareasReseteadas: process.env.LOG_CHANNEL_TAREAS_RESETEADAS || undefined
    }
  };
}
