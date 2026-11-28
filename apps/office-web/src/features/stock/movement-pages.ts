import type { Movement } from './warehouse-api';

export type MovementPage = { movements: Movement[]; nextCursor: string | null };

export async function collectMovements(
  readPage: (cursor: string | null) => Promise<MovementPage>,
  stop: (page: MovementPage) => boolean = () => false,
): Promise<Movement[]> {
  const records = new Map<string, Movement>();
  const cursors = new Set<string>();
  let cursor: string | null = null;
  do {
    const page = await readPage(cursor);
    for (const movement of page.movements) records.set(movement.id, movement);
    cursor = page.nextCursor;
    if (stop(page)) break;
    if (cursor && cursors.has(cursor)) throw new Error('Repeated movement cursor');
    if (cursor) cursors.add(cursor);
  } while (cursor);
  return [...records.values()];
}
