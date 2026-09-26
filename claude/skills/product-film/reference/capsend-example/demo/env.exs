# Shared config overrides for the isolated video instance (see server.exs).
# Point the app at its own database, storage, and port before it starts.
defmodule VideoDemo.Env do
  def apply!(opts \\ []) do
    Logger.configure(level: :info)
    port = String.to_integer(System.get_env("VIDEO_PORT", "4010"))
    db = System.get_env("VIDEO_DB", "cap_send_video")
    storage = Path.expand("marketing/video/.work/storage")
    File.mkdir_p!(storage)

    repo = Application.get_env(:cap_send, CapSend.Repo) |> Keyword.put(:database, db)
    Application.put_env(:cap_send, CapSend.Repo, repo, persistent: true)

    endpoint =
      Application.get_env(:cap_send, CapSendWeb.Endpoint)
      |> Keyword.merge(
        http: [ip: {127, 0, 0, 1}, port: port],
        url: [host: "localhost", port: port],
        watchers: [],
        code_reloader: false,
        server: Keyword.get(opts, :server, false)
      )

    Application.put_env(:cap_send, CapSendWeb.Endpoint, endpoint, persistent: true)
    Application.put_env(:cap_send, :public_url, "http://localhost:#{port}", persistent: true)
    Application.put_env(:cap_send, CapSend.Storage.Local, [root: storage], persistent: true)
    Application.put_env(:phoenix, :serve_endpoints, Keyword.get(opts, :server, false), persistent: true)
    %{port: port, db: db}
  end
end
