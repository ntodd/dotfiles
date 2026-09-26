# Makes recipients send a video (or just open their link) on the video
# instance, from outside the browser. Used by record.mjs to fill in a
# request's other people before the live recording.
#
#     mix run --no-start marketing/video/demo/submit.exs send:<link>:<clip> open:<link> ...
#
# <clip> is a file name in public/clips without the extension.

Code.require_file("env.exs", __DIR__)
VideoDemo.Env.apply!(server: false)
{:ok, _} = Application.ensure_all_started(:cap_send)
Oban.pause_all_queues(Oban)

alias CapSend.{Capture, Media, Recipients}

clips = Path.expand("marketing/video/public/clips")
media = Path.expand("marketing/video/.work/media")
File.mkdir_p!(media)

prepare = fn clip ->
  out = Path.join(media, "#{clip}.mp4")

  unless File.exists?(out) do
    {_, 0} =
      System.cmd("ffmpeg", [
        "-hide_banner", "-loglevel", "error", "-y",
        "-i", Path.join(clips, "#{clip}.mp4"),
        "-f", "lavfi", "-i", "anoisesrc=color=brown:amplitude=0.4:sample_rate=48000",
        "-shortest", "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-movflags", "+faststart", out
      ])
  end

  out
end

token = fn link -> link |> String.split("/r/") |> List.last() end

for arg <- System.argv() do
  case String.split(arg, ":", parts: 2) do
    ["open", link] ->
      rs = Recipients.scope_for_token(token.(link))
      {:ok, _} = Recipients.record_open(rs.recipient)
      IO.puts("opened #{rs.recipient.name}")

    ["send", rest] ->
      [link, clip] = String.split(rest, ~r/:(?=[^:]+$)/)
      rs = Recipients.scope_for_token(token.(link))
      {:ok, _} = Recipients.record_open(rs.recipient)

      {:ok, %{take: take, video: video}} =
        Capture.start_take(rs, %{
          "capture_method" => "browser",
          "mime_type" => "video/mp4",
          "client" => %{"device" => "iPhone", "browser" => "Safari"}
        })

      {:ok, %{1 => part_url}} = Media.presign_parts(video, [1])
      {:ok, payload} = CapSend.Storage.Local.verify(part_url |> String.split("/") |> List.last())
      {:ok, etag} = CapSend.Storage.Local.write_upload(payload, [File.read!(prepare.(clip))])
      {:ok, _} = Capture.complete_upload(rs, video.id, [%{"part_number" => 1, "etag" => etag}])
      {:ok, _} = Capture.submit_take(rs, take.id, %{"consent" => "true"})
      IO.puts("#{rs.recipient.name} sent #{clip}")
  end
end
