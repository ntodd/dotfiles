# Boots a second, isolated CapSend instance for recording the product video.
#
#     cd <repo root> && mix run --no-start marketing/video/demo/server.exs
#
# It uses its own database (cap_send_video), its own storage directory, and
# port 4010, so recording never touches your normal dev data on :4000.
# Pass RESET=1 to drop and recreate the database first.

Code.require_file("env.exs", __DIR__)
%{port: port, db: db} = VideoDemo.Env.apply!(server: true)

if System.get_env("RESET") in ~w(1 true) do
  Mix.Task.run("ecto.drop", ["--force", "--quiet"])
end

Mix.Task.run("ecto.create", ["--quiet"])
Mix.Task.run("ecto.migrate", ["--quiet"])

{:ok, _} = Application.ensure_all_started(:cap_send)
IO.puts("CapSend video instance on http://localhost:#{port} (database #{db})")
Process.sleep(:infinity)
