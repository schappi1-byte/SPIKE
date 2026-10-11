-- Data API grants for the dashboard tables. New tables are not exposed automatically in this project,
-- and only the server (service_role) reads or writes them.
grant all on public.evaluations, public.lineups to service_role;
