# RBAC Matrix and API Scope Mapping

| Role | Description | Core Scopes | Key API Endpoints |
| --- | --- | --- | --- |
| `admin` | Full platform administrator (internal ops) | `*` (all scopes) | All endpoints, including `/api/users`, `/api/settings`, auditing exports |
| `owner_exec` | Portfolio owner / investor dashboard viewer | `kpi:read`, `properties:read`, `leases:read`, `tenants:read`, `financials:read` | `GET /api/dashboard`, `GET /api/nekretnine`, `GET /api/ugovori`, `GET /api/zakupnici`, reporting exports |
| `property_manager` | Primary operator managing assets, leases, tenants, maintenance | `properties:*`, `tenants:*`, `leases:*`, `maintenance:*`, `documents:*`, `vendors:read`, `financials:read` | CRUD on `/api/nekretnine`, `/api/zakupnici`, `/api/ugovori`, `/api/maintenance-tasks`, `/api/dokumenti` |
| `leasing_agent` | Handles leasing pipeline and tenant onboarding | `tenants:*`, `leases:read`, `leases:update`, `documents:read`, `documents:create`, `maintenance:read` | `GET/POST /api/zakupnici`, `POST /api/ugovori`, `GET /api/maintenance-tasks` |
| `maintenance_coordinator` | Oversees maintenance operations | `maintenance:*`, `vendors:read`, `properties:read`, `tenants:read` | `/api/maintenance-tasks` CRUD, `/api/nekretnine` read, `/api/zakupnici` read |
| `accountant` | Finance / payments role | `financials:*`, `tenants:read`, `leases:read`, `vendors:*`, `documents:read`, `reports:*` | Billing & payments APIs (future), read on leases/tenants, vendor mgmt |
| `vendor` | External contractor | `maintenance:assigned`, `documents:upload` | `/api/maintenance-tasks` (limited to assigned), `/api/dokumenti` upload endpoint |
| `tenant` | Occupant portal user | `self:read`, `self:maintenance`, `self:documents` | `/api/maintenance-tasks` (self-request), `/api/dokumenti` (self), `/api/ugovori` (read own) |

## Scope Classification

| Scope Prefix | Description |
| --- | --- |
| `properties` | Property inventory CRUD |
| `tenants` | Tenant records, contacts, communications |
| `leases` | Lease contracts, renewals, status updates |
| `maintenance` | Work orders, statuses, comments, cost tracking |
| `documents` | Upload, download, metadata updates |
| `vendors` | Vendor catalog, compliance, contact info |
| `financials` | Billing, payments, AR/AP, KPIs |
| `reports` | KPI dashboards, exports |
| `kpi` | Portfolio dashboards & analytics |
| `self` | Tenant-facing scoped actions |

## Endpoint-to-Scope Mapping (current API)

| Endpoint | Method(s) | Required Scope(s) |
| --- | --- | --- |
| `/api/dashboard` | GET | `kpi:read` |
| `/api/nekretnine` | GET | `properties:read` |
| `/api/nekretnine` | POST | `properties:create` |
| `/api/nekretnine/{id}` | PUT | `properties:update` |
| `/api/nekretnine/{id}` | DELETE | `properties:delete` |
| `/api/nekretnine/{id}/units` | GET | `properties:read` |
| `/api/nekretnine/{id}/units` | POST | `properties:update` |
| `/api/units/{id}` | PUT | `properties:update` |
| `/api/units/{id}` | DELETE | `properties:delete` |
| `/api/zakupnici` | GET | `tenants:read` |
| `/api/zakupnici` | POST | `tenants:create` |
| `/api/zakupnici/{id}` | PUT | `tenants:update` |
| `/api/ugovori` | GET | `leases:read` |
| `/api/ugovori` | POST | `leases:create` |
| `/api/ugovori/{id}` | PUT | `leases:update` |
| `/api/ugovori/{id}/status` | PUT | `leases:update` |
| `/api/dokumenti` | GET | `documents:read` |
| `/api/dokumenti` | POST | `documents:create` |
| `/api/dokumenti/{id}` | PUT/DELETE | `documents:update` / `documents:delete` |
| `/api/maintenance-tasks` | GET | `maintenance:read` |
| `/api/maintenance-tasks` | POST | `maintenance:create` |
| `/api/maintenance-tasks/{id}` | PATCH/DELETE | `maintenance:update` / `maintenance:delete` |
| `/api/maintenance-tasks/{id}/comments` | POST | `maintenance:update` |
| `/api/podsjetnici` | GET | `properties:read` or `leases:read` (depending on usage) |
| `/api/podsjetnici/aktivni` | GET | `properties:read` |
| `/api/podsjetnici/{id}/oznaci-poslan` | PUT | `properties:update` |
| `/api/pretraga` | GET | Combined: `properties:read`, `tenants:read`, `leases:read` |
| `/api/ai/*` | POST | `documents:create`, `leases:update` (depending on generation) |

> _Note_: Vendor-facing scope `maintenance:assigned` resolves to read/update limited to tasks where `assigned_vendor_id == principal_id`. Tenant-facing scope `self:*` resolves to filtering by `tenant_id`.

## Scope Inference Rules
- `role_scopes` map roles to explicit scopes.
- `*` denotes super-user access (admin).
- Any scope ending with `:*` grants read/write/delete for that resource, resolved by suffix.
- If both `properties:update` and `properties:delete` granted, UI enables destructive actions; auditing always logs actual scopes used.

## Implementation Checklist
1. Inject principal identity with `user.id`, `user.role`, `user.scopes` from API token / session.
2. Decorate endpoints with scope dependencies (`require_scope("leases:read")`).
3. Enhance audit middleware to capture scope set and request payload diffs.
4. Add data filters in services for tenant/vendor roles.
