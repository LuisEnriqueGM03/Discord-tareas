// Setup file for Jest tests
import 'reflect-metadata';

// Mock environment variables
process.env.NODE_ENV = 'test';
process.env.DISCORD_TOKEN = 'test-token';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.PERSISTENCE_TYPE = 'json';

// Global test timeout
jest.setTimeout(10000);
