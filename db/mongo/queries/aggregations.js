// MongoDB aggregation pipelines for the judge data.
// Run (db name is passed so `db` points at it):
//   docker exec -i judge_mongo mongosh -u "$MONGO_USER" -p "$MONGO_PASSWORD" \
//     --authenticationDatabase admin "$MONGO_DB" --quiet < db/mongo/queries/aggregations.js

print('=== 1. Verdict distribution over every test-case run ($unwind, $group, $sort)');
printjson(db.execution_logs.aggregate([
  { $unwind: '$per_case' },                                   // one document per test-case run
  { $group: { _id: '$per_case.verdict',
              runs:   { $sum: 1 },
              avg_ms: { $avg: '$per_case.time_ms' },
              max_ms: { $max: '$per_case.time_ms' } } },
  { $sort: { runs: -1 } },
]).toArray());

print('=== 2. Five heaviest submissions: cases run, total and slowest time ($project, $size, $sum, $max)');
printjson(db.execution_logs.aggregate([
  { $project: { _id: 0, submission_id: 1,
                cases_run:      { $size: { $ifNull: ['$per_case', []] } },
                total_ms:       { $sum: '$per_case.time_ms' },
                slowest_ms:     { $max: '$per_case.time_ms' },
                compile_failed: { $ne: ['$compile_output', null] } } },
  { $sort: { total_ms: -1 } },
  { $limit: 5 },
]).toArray());

print('=== 3. Test-case counts per problem: total, sample and hidden ($filter, $addFields, $subtract)');
printjson(db.test_cases.aggregate([
  { $project: { _id: 0, problem_id: 1,
                total_cases:  { $size: '$cases' },
                sample_cases: { $size: { $filter: { input: '$cases', as: 'c', cond: '$$c.is_sample' } } } } },
  { $addFields: { hidden_cases: { $subtract: ['$total_cases', '$sample_cases'] } } },
  { $sort: { problem_id: 1 } },
]).toArray());
