import Dexie, { Table } from 'dexie';
import { Repository, Branch, Commit } from '../utils/types';

export class GitExpressDB extends Dexie {
  repositories!: Table<Repository, string>;
  branches!: Table<Branch, string>;
  commits!: Table<Commit, string>;

  constructor() {
    super('GitExpressDatabase');
    
    // This defines the final, correct schema for our database.
    this.version(1).stores({
        repositories: 'id, activeBranch',
        branches: 'id, name, head',
        commits: 'id, branchId, message, author, timestamp, *parents, isSnapshot, payload, thumbnail'
    });
  }
}

export const db = new GitExpressDB();