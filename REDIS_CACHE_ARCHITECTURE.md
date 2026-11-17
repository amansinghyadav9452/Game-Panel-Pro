# Redis Read-Through Cache

MongoDB remains the permanent source of truth. Redis stores disposable JSON copies for faster panel reads.

## Cached data

- Admin public/premium key lists: 1 hour
- Customer public/premium key lists and all-key list: 1 hour, namespaced by authenticated customer ID
- Admin User Logs pages: 1 hour, invalidated when a new UserLog is saved or logs are cleared
- Admin Recent Activity: 1 hour, invalidated when Activity records change
- Customer CRUD logs, recent activity and verification activity pages: 1 hour, isolated by customer ID
- Admin and customer dashboard summary statistics: 5 minutes

## Read path

1. API checks the Redis cache.
2. Cache hit returns the cached JSON.
3. Cache miss loads the data from MongoDB and stores the result in Redis with an expiry.
4. Redis read/write errors fall back to MongoDB; the panel does not depend on cache availability.

## Write path and invalidation

All permanent writes continue to MongoDB first. Mongoose model hooks then bump a Redis cache-version key for the affected namespace. The next read misses the old cache generation and repopulates from MongoDB. Old generations expire naturally by TTL.

Customer cache namespaces include the customer ObjectId. Admin and customer datasets are never stored under the same namespace.

## TTL behaviour

TTL is an expiry limit, not a scheduled refresh. After expiry, the next request fetches current data from MongoDB and repopulates Redis. Writes invalidate affected namespaces immediately after the MongoDB write.

## Operational notes

- No database migration is required.
- Existing Redis REST URL/token variables are reused.
- If Redis is unavailable, requests read MongoDB directly.
- This implementation does not cache authentication decisions, password hashes, OTPs, license verification decisions, rate-limit state, anti-replay state, or secrets.
