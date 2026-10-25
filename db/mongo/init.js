// Runs once on first container boot (mongosh). Collections + validators + indexes.
const dbName = process.env.MONGO_INITDB_DATABASE || 'judge';
db = db.getSiblingDB(dbName);

// Bulky, variable-length test case arrays: one document per problem.
db.createCollection('test_cases', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['problem_id', 'cases'],
    properties: {
      problem_id: { bsonType: 'int', minimum: 1 },          // FK -> postgres problems.problem_id
      cases: { bsonType: 'array', minItems: 1,
        items: { bsonType: 'object',
          required: ['input', 'expected_output'],
          properties: {
            input: { bsonType: 'string' },
            expected_output: { bsonType: 'string' },
            is_sample: { bsonType: 'bool' },
            weight: { bsonType: ['int', 'double'] } } } } } } }
});
db.test_cases.createIndex({ problem_id: 1 }, { unique: true });

// Raw sandbox output per submission (per-testcase verdicts, stdout/stderr, compile output).
db.createCollection('execution_logs', {
  validator: { $jsonSchema: {
    bsonType: 'object',
    required: ['submission_id', 'judged_at'],
    properties: {
      submission_id: { bsonType: ['int', 'long'] },          // FK -> postgres submissions.submission_id
      compile_output: { bsonType: ['string', 'null'] },
      per_case: { bsonType: 'array' },
      judged_at: { bsonType: 'date' } } } }
});
db.execution_logs.createIndex({ submission_id: 1 }, { unique: true });
db.execution_logs.createIndex({ judged_at: 1 });
