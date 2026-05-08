/* eslint-disable @typescript-eslint/no-redundant-type-constituents */
/* eslint-disable @typescript-eslint/require-await */

/* eslint-disable @typescript-eslint/no-unnecessary-condition */

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * In-Memory Database Mock for Integration Tests
 *
 * Provides a Kysely-compatible interface for testing without PostgreSQL.
 */
import {
  Kysely,
  DummyDriver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
} from 'kysely';
export interface MockProjection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  input_data: unknown;
  result_data: unknown | null;
  status: string;
  calculated_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface MockHouseholdProfile {
  id: string;
  user_id: string;
  step_data: Record<string, unknown>;
  current_step: number;
  created_at: Date;
  updated_at: Date;
}

export interface MockProfileScenario {
  id: string;
  profile_id: string;
  name: string;
  is_base: boolean;
  decisions: unknown;
  result_data: unknown | null;
  status: string;
  calculated_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

interface WhereClause {
  column: string;
  operator: string;
  value: unknown;
}

class MockQueryBuilder {
  private store: Map<string, MockProjection>;
  private whereClauses: WhereClause[] = [];
  private selectedColumns: string[] = [];
  private selectAllFlag: boolean = false;
  private orderByColumn: string | null = null;
  private orderByDirection: 'asc' | 'desc' = 'desc';
  private limitValue: number | null = null;
  private offsetValue: number = 0;

  constructor(_table: string, store: Map<string, MockProjection>) {
    this.store = store;
  }

  select(columns: string | string[]) {
    this.selectedColumns = Array.isArray(columns) ? columns : [columns];
    return this;
  }

  selectAll() {
    this.selectAllFlag = true;
    return this;
  }

  where(column: string, operator: string, value: unknown) {
    this.whereClauses.push({ column, operator, value });
    return this;
  }

  orderBy(column: string, direction: 'asc' | 'desc' = 'desc') {
    this.orderByColumn = column;
    this.orderByDirection = direction;
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  offset(value: number) {
    this.offsetValue = value;
    return this;
  }

  innerJoin(_table: string, _lhs: string, _rhs: string) {
    return this;
  }

  private matchesWhere(projection: MockProjection): boolean {
    for (const clause of this.whereClauses) {
      const fieldValue = projection[clause.column as keyof MockProjection];

      if (clause.operator === '=') {
        if (fieldValue !== clause.value) return false;
      } else if (clause.operator === 'is') {
        if (clause.value === null && fieldValue !== null) return false;
      }
    }
    return true;
  }

  async execute(): Promise<Partial<MockProjection>[]> {
    let results = Array.from(this.store.values()).filter((p) => this.matchesWhere(p));

    // Apply ordering
    if (this.orderByColumn) {
      results.sort((a, b) => {
        const aVal = a[this.orderByColumn as keyof MockProjection];
        const bVal = b[this.orderByColumn as keyof MockProjection];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        if (aVal < bVal) return this.orderByDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return this.orderByDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    // Apply offset and limit
    if (this.offsetValue > 0) {
      results = results.slice(this.offsetValue);
    }
    if (this.limitValue !== null) {
      results = results.slice(0, this.limitValue);
    }

    // Apply column selection (unless selectAll)
    if (
      !this.selectAllFlag &&
      this.selectedColumns.length > 0 &&
      !this.selectedColumns.includes('*')
    ) {
      return results.map((r) => {
        const selected: Partial<MockProjection> = {};
        for (const col of this.selectedColumns) {
          if (col in r) {
            (selected as Record<string, unknown>)[col] = r[col as keyof MockProjection];
          }
        }
        return selected;
      });
    }

    return results;
  }

  async executeTakeFirst(): Promise<Partial<MockProjection> | undefined> {
    const results = await this.execute();
    return results[0];
  }
}

class MockInsertBuilder {
  private store: Map<string, MockProjection>;
  private insertValues: Partial<MockProjection> | null = null;

  constructor(store: Map<string, MockProjection>) {
    this.store = store;
  }

  values(data: Partial<MockProjection>) {
    this.insertValues = data;
    return this;
  }

  returning(_columns: string[]) {
    return this;
  }

  returningAll() {
    return this;
  }

  async executeTakeFirst(): Promise<MockProjection> {
    if (!this.insertValues) {
      throw new Error('No values to insert');
    }

    const now = new Date();
    const id = this.insertValues.id ?? crypto.randomUUID();

    // Generic insert: merge provided values with safe defaults
    // result_data defaults to null so selectAll() always returns the key in responses
    // deleted_at defaults to null so soft-delete filters (.where('deleted_at', 'is', null))
    // match freshly-inserted rows — leaving it undefined causes 404s on subsequent fetches
    const record = {
      result_data: null,
      deleted_at: null,
      created_at: now,
      updated_at: now,
      ...this.insertValues,
      id,
    } as unknown as MockProjection;

    this.store.set(id, record);
    return record;
  }

  async executeTakeFirstOrThrow(): Promise<MockProjection> {
    const result = await this.executeTakeFirst();
    if (!result) {
      throw new Error('No result returned from insert');
    }
    return result;
  }

  async execute(): Promise<MockProjection[]> {
    const result = await this.executeTakeFirst();
    return [result];
  }
}

class MockUpdateBuilder {
  private store: Map<string, MockProjection>;
  private updateValues: Partial<MockProjection> = {};
  private whereClauses: WhereClause[] = [];

  constructor(store: Map<string, MockProjection>) {
    this.store = store;
  }

  set(data: Partial<MockProjection>) {
    this.updateValues = data;
    return this;
  }

  where(column: string, operator: string, value: unknown) {
    this.whereClauses.push({ column, operator, value });
    return this;
  }

  private matchesWhere(projection: MockProjection): boolean {
    for (const clause of this.whereClauses) {
      const fieldValue = projection[clause.column as keyof MockProjection];
      if (clause.operator === '=' && fieldValue !== clause.value) return false;
    }
    return true;
  }

  returning(_columns: string[]) {
    return this;
  }

  returningAll() {
    return this;
  }

  async executeTakeFirstOrThrow(): Promise<MockProjection> {
    const result = await this.executeTakeFirst();
    if (!result) {
      throw new Error('No rows matched update');
    }
    return result;
  }

  async execute(): Promise<{ numUpdatedRows: bigint }> {
    let count = 0;
    for (const [id, projection] of this.store.entries()) {
      if (this.matchesWhere(projection)) {
        const updated = { ...projection, ...this.updateValues };
        this.store.set(id, updated);
        count++;
      }
    }
    return { numUpdatedRows: BigInt(count) };
  }

  async executeTakeFirst(): Promise<MockProjection | undefined> {
    for (const [id, projection] of this.store.entries()) {
      if (this.matchesWhere(projection)) {
        const updated = { ...projection, ...this.updateValues };
        this.store.set(id, updated);
        return updated;
      }
    }
    return undefined;
  }
}

/**
 * A Kysely instance backed by DummyDriver + PostgresDialect.
 * Used ONLY for compiling raw SQL nodes (sql`...`.execute(db)).
 * Does not connect to any database.
 */
const compilerDb = new Kysely<Record<string, unknown>>({
  dialect: {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (db: Kysely<any>) => new PostgresIntrospector(db),
    createQueryCompiler: () => new PostgresQueryCompiler(),
  },
});

export function createMockDb() {
  const projections = new Map<string, MockProjection>();
  const householdProfiles = new Map<string, MockHouseholdProfile>();
  const profileScenarios = new Map<string, MockProfileScenario>();

  /**
   * Mock executor returned by getExecutor().
   *
   * Kysely's `sql\`...\`.execute(db)` calls:
   *   1. db.getExecutor() → compilerDb.getExecutor() (has real PostgreSQL compiler)
   *   2. executor.executeQuery(compiledQuery, queryId)
   *
   * The compiledQuery has shape: { sql: string, parameters: readonly unknown[] }
   *
   * For the profile service upsert, parameters are positional:
   *   $1 = userId
   *   $2 = JSON.stringify(stepPayload) (insert step_data value)
   *   $3 = currentStep (insert)
   *   $4 = JSON.stringify(stepPayload) (update step_data value — same as $2)
   *   $5 = currentStep (update — same as $3)
   */
  const realExecutor = compilerDb.getExecutor();

  const mockExecuteQuery = async (compiledQuery: {
    sql: string;
    parameters: readonly unknown[];
  }) => {
    const sqlStr = compiledQuery.sql;
    const params = compiledQuery.parameters;

    if (sqlStr.includes('INSERT INTO household_profiles')) {
      // Profile upsert: params[0]=userId, params[1]=stepPayloadJSON, params[2]=currentStep
      // params[3]=stepPayloadJSON (repeat for ON CONFLICT), params[4]=currentStep (repeat)
      const userId = params[0] as string;
      const stepPayloadJson = params[1] as string;
      const currentStep = params[2] as number;
      const now = new Date();

      // Extract step slug from SQL: jsonb_build_object('slug', ...)
      const stepMatch = /jsonb_build_object\('([^']+)'/.exec(sqlStr);
      const step = stepMatch?.[1] ?? 'unknown';

      const existing = Array.from(householdProfiles.values()).find((p) => p.user_id === userId);

      if (existing) {
        // ON CONFLICT → UPDATE: merge step data (last write wins for this step key)
        const stepPayload = JSON.parse(stepPayloadJson) as unknown;
        existing.step_data = { ...existing.step_data, [step]: stepPayload };
        existing.current_step = currentStep;
        existing.updated_at = now;
        return { rows: [{ ...existing }] };
      } else {
        // INSERT new profile
        const stepPayload = JSON.parse(stepPayloadJson) as unknown;
        const profile: MockHouseholdProfile = {
          id: crypto.randomUUID(),
          user_id: userId,
          step_data: { [step]: stepPayload },
          current_step: currentStep,
          created_at: now,
          updated_at: now,
        };
        householdProfiles.set(profile.id, profile);
        return { rows: [{ ...profile }] };
      }
    }

    return { rows: [] };
  };

  // Wrap the real executor — use its compile/transform, but intercept executeQuery
  const mockExecutor = {
    executeQuery: mockExecuteQuery,
    withPlugins: (plugins: unknown[]) => {
      if ((plugins as any[]).length === 0) return mockExecutor;
      return mockExecutor;
    },
    transformQuery: (node: unknown, queryId: unknown) =>
      (realExecutor as any).transformQuery(node, queryId),
    compileQuery: (node: unknown, queryId: unknown) =>
      (realExecutor as any).compileQuery(node, queryId),
  };

  const mockDb = {
    selectFrom: (table: string) => {
      if (table === 'projections') {
        return new MockQueryBuilder(table, projections);
      }
      if (table === 'household_profiles') {
        return new MockQueryBuilder(
          table,
          householdProfiles as unknown as Map<string, MockProjection>
        );
      }
      if (table === 'profile_scenarios') {
        return new MockQueryBuilder(
          table,
          profileScenarios as unknown as Map<string, MockProjection>
        );
      }
      return new MockQueryBuilder(table, new Map());
    },

    insertInto: (table: string) => {
      if (table === 'projections') {
        return new MockInsertBuilder(projections);
      }
      if (table === 'profile_scenarios') {
        return new MockInsertBuilder(profileScenarios as unknown as Map<string, MockProjection>);
      }
      return new MockInsertBuilder(new Map());
    },

    updateTable: (table: string) => {
      if (table === 'projections') {
        return new MockUpdateBuilder(projections);
      }
      if (table === 'profile_scenarios') {
        return new MockUpdateBuilder(profileScenarios as unknown as Map<string, MockProjection>);
      }
      return new MockUpdateBuilder(new Map());
    },

    deleteFrom: (table: string) => {
      const store =
        table === 'profile_scenarios'
          ? (profileScenarios as unknown as Map<string, any>)
          : table === 'projections'
            ? (projections as unknown as Map<string, any>)
            : new Map<string, any>();
      return {
        where: (column: string, operator: string, value: unknown) => ({
          execute: async () => {
            let count = 0;
            for (const [id, row] of store.entries()) {
              if (operator === '=' && row[column] === value) {
                store.delete(id);
                count++;
              }
            }
            return { numDeletedRows: BigInt(count) };
          },
        }),
      };
    },

    fn: {
      count: (column: string) => ({
        as: (alias: string) => `count_${column}_as_${alias}`,
      }),
    },

    /**
     * Required by Kysely's sql template: sql`...`.execute(db)
     * calls db.getExecutor() then executor.executeQuery(compiledQuery)
     */
    getExecutor: () => mockExecutor,

    // Expose stores for testing
    _projections: projections,
    _householdProfiles: householdProfiles,
    _profileScenarios: profileScenarios,

    // Reset all data
    reset: () => {
      projections.clear();
      householdProfiles.clear();
      profileScenarios.clear();
    },
  };

  return mockDb;
}

// Create singleton instance
export const mockDb = createMockDb();

// Create mock for vi.mock()
export const createDbMock = () => {
  return {
    db: mockDb,
  };
};
