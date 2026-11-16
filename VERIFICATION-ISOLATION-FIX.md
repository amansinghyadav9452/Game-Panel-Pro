# Verification ownership and dashboard isolation fix

## Changes

- Verification attempts are attributed using the registered `GameApplication` owner.
- Customer-owned applications write success and failure attempts only to that customer's activity-log collection.
- Unknown/unregistered Game IDs are not written into the Admin `UserLog` collection.
- `/client-log` resolves customer ownership through `KeyIndex` and writes device metadata to the matching customer's activity-log collection. Admin keys continue using `UserLog`.
- Daily verification counters are now partitioned by `ownerKey`: `admin`, `customer:<customerId>`, or `unattributed`.
- Admin graph reads only Admin-owned daily counters.
- Customers have a `customerAuth`-protected `/customer/dashboard/user-activity` endpoint that reads only their own counters.
- The dashboard graph is now displayed for both roles and uses the role-specific endpoint.

## Required database migration before deploying this version

The previous schema had a unique index on `dayKey`, which only allowed one global counter per date. The new schema requires a unique compound index on `dayKey + ownerKey`.

Run once against the production database before starting the new application version:

```bash
npm run migrate:verification-stats
```

The migration removes the old `dayKey_1` index, labels old unsplittable global totals as `unattributed`, and creates `dayKey_ownerKey_unique`. Historical global totals are retained but are deliberately not displayed in either Admin or Customer graphs because they cannot be accurately divided between owners.

## Verification

All JavaScript files pass `node --check` syntax validation. A live database integration test still requires the deployment MongoDB connection and credentials.
