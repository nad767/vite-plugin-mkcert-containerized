/**
 * Registry of currently active ephemeral HTTP servers keyed by composite server configuration.
 *
 * @type {Map<string, { archiveDownloadUrl: string, archiveContents: string[], archiveFileName: string, closeTimer?: NodeJS.Timeout, expiresAt?: number, port: number, server: import('node:http').Server }>}
 */
export const activeServers = new Map();

/**
 * Registry of currently in-flight ephemeral server creation promises keyed by composite server configuration.
 *
 * @type {Map<string, Promise<{ archiveDownloadUrl: string, archiveContents: string[], archiveFileName: string, closeTimer?: NodeJS.Timeout, expiresAt?: number, port: number, server: import('node:http').Server }>>}
 */
export const pendingServers = new Map();
