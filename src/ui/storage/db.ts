import Dexie , { Table } from 'dexie';
import { Repository, Branch, Commit} from '../utils/types';

export class GitExpressDB extends Dexie {
    repositories!: Table<Repository, string>;
    branches!: Table<Branch, string>;
    commits!: Table<Commit, string>;

    constructor() {
        super('GitExpressDatabase');
        this.version(1).stores({
            repositories: 'id', // Primary key is 'id'
            branches: 'id, name', // Primary key is 'id', index 'name' for quick lookups
            commits: 'id, branchId, timestamp', // Primary key is 'id', index on timestamp for history
        });
    }
}

export const db = new GitExpressDB();