# Rosita Waters admin portal

Private React/Vite dashboard for tenant-scoped product, order, and page-content
management. Authentication is performed by `Client-Backend`; the backend sets
an HTTP-only session cookie, binds it to the admin's tenant, and sends password
reset/setup OTPs by email. Admin accounts are provisioned only through protected
backend APIs and are not created in this dashboard.

Set `VITE_API_URL` to the backend origin (without a trailing `/api`) in
`.env.local` or the frontend host's build settings. The browser sends
credentialed requests, so the backend's CORS allowlist must include the admin
portal's origin. Never place backend credentials in this project.

Run locally with `npm install` and `npm run dev`; validate with `npm run build`
and `npm run lint`.
# Rosita-Waters-Admin
