# OpsPilot API reference

Base URL: `http://localhost:5000/api/v1`

Responses use the following envelope:

```json
{ "success": true, "data": {}, "message": "Optional human-readable message" }
```

Errors include `success: false`, a safe `message`, and a stable `code`. Validation errors may include a `details` array. Authenticated requests use the `ops_session` HTTP-only cookie.

## Health

```powershell
Invoke-RestMethod http://localhost:5000/api/v1/health
Invoke-RestMethod http://localhost:5000/api/v1/health/ready
```

`/health` checks API liveness. `/health/ready` checks MongoDB connectivity and the FastAPI model service and returns HTTP 503 when either dependency is unavailable.

## Auth

### Signup

`POST /auth/signup`

```json
{
  "name": "Alex Morgan",
  "email": "alex@example.com",
  "password": "a-long-password",
  "termsAccepted": true
}
```

### Login

`POST /auth/login`

```json
{
  "email": "alex@example.com",
  "password": "a-long-password",
  "remember": false
}
```

The response sets the session cookie. `GET /auth/me` returns the public user when the cookie is valid. `POST /auth/logout` invalidates the current session and clears the cookie.

## Admin identity

`GET /admin/me` requires the authenticated session cookie, the database-loaded `admin` role, and the provisioned owner username `deepti10648`. A matching username without valid authentication does not grant access. The response confirms the current Admin identity for future client navigation; it does not replace server-side authorization on any Admin operation. No ticket or other Admin management APIs are currently implemented.

## Model metadata

`GET /models/resolution-time/metadata` returns the actual categories exposed by the saved pipeline, derived fields, and evaluation artifact. The frontend uses the `fields.*.options` arrays to build its form.

## Resolution prediction

`POST /predictions/resolution-time`

```json
{
  "issue_created": "2024-01-12T09:30:00Z",
  "issue_priority": "High",
  "issue_type": "Bug",
  "issue_proj": "C00d3dzwj28av.ew8x3"
}
```

The API authenticates the user, validates the payload, calls FastAPI, validates `duration`, `unit`, and `prediction_type`, then saves the record. A successful response includes:

```json
{
  "success": true,
  "data": {
    "prediction": {
      "id": "mongo-id",
      "modelId": "resolution-time",
      "predictionType": "point_estimate",
      "status": "success",
      "output": { "duration": 882.58, "unit": "hours" }
    },
    "duration": 882.58,
    "unit": "hours",
    "predictionType": "point_estimate"
  },
  "message": "Prediction created."
}
```

The duration in this example documents the response shape and is not a value rendered by the app as sample data.

## History

`GET /predictions?page=1&pageSize=20&modelId=resolution-time` returns user-scoped records, newest first, with pagination. `GET /predictions/:id` and `DELETE /predictions/:id` perform ownership checks. Dashboard aggregates use the same user scope.
