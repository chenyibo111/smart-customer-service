import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import type { AppDatabase } from './database.js';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));

export function migrate(database: AppDatabase): void {
  database.exec(readFileSync(schemaPath, 'utf8'));
}
