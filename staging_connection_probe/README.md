# Farmer AI staging connection probe

This standalone probe uses SQLAlchemy with the pure-Python pg8000 driver. It
does not import the Farmer AI application or start an HTTP server.

Install the requirements in an isolated runtime if pg8000 is not already
available:

```text
python -m pip install -r requirements.txt
```

Provide these variables through the runtime's private environment configuration:

- `STAGING_DATABASE_URL`
- `FARMER_AI_STAGING_PROJECT_REF`

Do not put connection values in this folder, source control, logs, or command
output. The probe rejects endpoints that do not match the configured Supabase
project reference. Direct endpoints must use `db.<project-ref>.supabase.co`;
pooler endpoints must use a Supabase pooler host and the matching
`postgres.<project-ref>` routing username.

The probe builds a strict TLS context from the existing CA certificate,
including certificate-chain and hostname verification. It establishes a
read-only transaction,
and issues only SELECT queries for the PostgreSQL version, database name, and
current session SSL status. It rolls back and closes the connection afterward.
It prints no URL, username, password, or environment-variable values.
