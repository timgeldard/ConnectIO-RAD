# Genie Deployment Notes

## Runtime Configuration

The Process Order History app expects a Genie Space ID on the backend:

- `GENIE_SPACE_ID`: Databricks Genie Space ID injected into the app runtime.
- `DATABRICKS_HOST`: Databricks workspace host.
- User authorization token from Databricks Apps proxy via `x-forwarded-access-token`.
- Optional local development fallback: `DATABRICKS_TOKEN`.

Do not hardcode tokens in frontend code or app config.

## Databricks App Resource

`app.template.yaml` declares a Genie resource:

```yaml
resources:
  genie-space:
    type: genie
    id: "${GENIE_SPACE_ID}"

env:
  - name: GENIE_SPACE_ID
    valueFrom: genie-space
```

Set `GENIE_SPACE_ID` during app config rendering/deployment to the environment-specific Genie Space ID. Databricks resolves `valueFrom: genie-space` to the Space ID at runtime.

The bundle asks for:

```yaml
user_api_scopes:
  - sql
  - dashboards.genie
```

The app service principal and/or user authorization context must have access to the Genie Space and the underlying Unity Catalog objects used by the Space.

## Permissions

Minimum expected permissions:

- App/user has access to the Genie Space.
- Genie Space has a configured warehouse.
- The execution identity used by the Genie Space can query the curated source tables.
- Underlying UC permissions typically include `USE CATALOG`, `USE SCHEMA`, and `SELECT`.

## Promotion Path

Do not treat this repository as having full Genie Space deployment automation yet.

Recommended path:

1. Curate and test the Space in development.
2. Export or serialize the Space definition using Databricks Genie Space management APIs.
3. Store the reviewed serialized payload or human-readable design artifact in source control.
4. Apply the serialized payload into UAT/prod through a controlled deployment script or workspace promotion process.
5. Update the Databricks App resource to point at the promoted Space ID.
6. Render/deploy the app with the target `GENIE_SPACE_ID`.

TODO: Add a dedicated promotion script once the team decides where serialized Space payloads should live and how approvals should be handled.

## End-To-End Test

1. Provision or select the Process Order History Genie Space.
2. Grant the app/user access to the Space.
3. Render `app.yaml` with `GENIE_SPACE_ID=<space-id>`.
4. Deploy the app.
5. Open Process Order History and click **Ask Genie**.
6. Ask: "Summarize the current screen and identify the highest-risk process orders."
7. Confirm the backend sends a context block and the drawer renders the answer, SQL expander, and any tabular results.
