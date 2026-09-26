# Demo data for recording the product video: a fictional company, Northpeak,
# whose comms manager (Maya Chen) already has a few requests going, with
# real-looking videos from the generated clips in public/clips.
#
#     cd <repo root> && mix run --no-start marketing/video/demo/seed.exs
#
# Run it against a fresh database (start the server with RESET=1 first).
# Log in as maya@northpeak.test / capsend-demo-1.

Code.require_file("env.exs", __DIR__)
VideoDemo.Env.apply!(server: false)
{:ok, _} = Application.ensure_all_started(:cap_send)
# The running server processes the videos; don't race it for jobs.
Oban.pause_all_queues(Oban)

import Ecto.Query

alias CapSend.Accounts
alias CapSend.Accounts.{Scope, User}
alias CapSend.{Capture, Contacts, Media, Organizations, Recipients, Repo, Requests}

if Repo.exists?(from u in User, where: u.email == "maya@northpeak.test") do
  IO.puts("Already seeded. Restart the server with RESET=1 to start over.")
  System.halt(0)
end

clips = Path.expand("marketing/video/public/clips")
media = Path.expand("marketing/video/.work/media")
File.mkdir_p!(media)

make_user = fn email, name ->
  {:ok, user} = Accounts.register_user(%{email: email})
  user = user |> Ecto.Changeset.change(confirmed_at: DateTime.utc_now(:second)) |> Repo.update!()
  {:ok, user} = Accounts.update_user_profile(user, %{name: name, timezone: "America/New_York"})
  {:ok, {user, _}} = Accounts.update_user_password(user, %{password: "capsend-demo-1"})
  user
end

maya = make_user.("maya@northpeak.test", "Maya Chen")
jordan = make_user.("jordan@northpeak.test", "Jordan Lee")

{:ok, org} = Organizations.create_organization(Scope.for_user(maya), %{name: "Northpeak"})
{:ok, scope} = Organizations.scope_for_slug(Scope.for_user(maya), org.slug)
{:ok, _} = Organizations.update_organization(scope, %{sender_name: "Northpeak", brand_color: "#5B50E8"})
{:ok, scope} = Organizations.scope_for_slug(Scope.for_user(maya), org.slug)
Repo.insert!(%Organizations.Membership{organization_id: org.id, user_id: jordan.id, role: :editor})

people = %{
  marcus: {"Marcus Bell", "marcus.bell@northpeak.test", "+14155550142", "Chief Executive Officer"},
  elena: {"Elena Ruiz", "elena.ruiz@northpeak.test", nil, "Chief Financial Officer"},
  sam: {"Sam Okafor", "sam.okafor@northpeak.test", "+14155550143", "VP Sales"},
  priya: {"Priya Nair", "priya.nair@northpeak.test", nil, "Head of People"},
  jonah: {"Jonah Weiss", "jonah.weiss@northpeak.test", nil, "VP Engineering"},
  aiko: {"Aiko Tanaka", "aiko.tanaka@northpeak.test", nil, "GM, Asia Pacific"},
  claire: {"Claire Whitman", "claire.whitman@northpeak.test", nil, "Regional Director, East"},
  rosa: {"Rosa Delgado", "rosa@brightwaylogistics.test", nil, "Operations Manager, Brightway Logistics"},
  kenji: {"Kenji Mori", "kenji@morikoffee.test", nil, "Owner, Mori Koffee"},
  amara: {"Amara Okoye", "amara@lumenlabs.test", nil, "Staff Engineer, Lumen Labs"},
  tom: {"Tom Hale", "tom@hartwellfoods.test", nil, "COO, Hartwell Foods"},
  lena: {"Lena Fischer", "lena@auroramed.test", nil, "Director, Aurora Medical"},
  daniel: {"Daniel Price", "daniel.price@northpeak.test", nil, "Keynote speaker"},
  grace: {"Grace Liu", "grace.liu@northpeak.test", nil, "Product lead"},
  omar: {"Omar Haddad", "omar.haddad@northpeak.test", nil, "Design lead"},
  anjali: {"Anjali Rao", "anjali.rao@northpeak.test", nil, "Nurse practitioner"},
  ben: {"Ben Carter", "ben.carter@northpeak.test", nil, "Charge nurse"},
  sofia: {"Sofia Marin", "sofia.marin@northpeak.test", nil, "Clinical educator"}
}

{:ok, _} =
  Contacts.upsert_entries(
    scope,
    for({_, {n, e, p, t}} <- people, do: %{name: n, email: e, phone_e164: p, title: t})
  )

entry = fn key ->
  {n, e, p, _} = people[key]
  %{name: n, email: e, phone_e164: p}
end

# The generated clips have no sound; give them quiet room tone so the
# quality check doesn't flag "No audio".
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

submit = fn recipient, clip, device ->
  path = prepare.(clip)

  rs =
    recipient
    |> Recipients.recipient_url()
    |> String.split("/r/")
    |> List.last()
    |> Recipients.scope_for_token()

  {:ok, _} = Recipients.record_open(recipient)

  {:ok, %{take: take, video: video}} =
    Capture.start_take(rs, %{
      "capture_method" => "browser",
      "mime_type" => "video/mp4",
      "client" => %{"device" => device, "browser" => "Safari"}
    })

  {:ok, %{1 => part_url}} = Media.presign_parts(video, [1])
  {:ok, payload} = CapSend.Storage.Local.verify(part_url |> String.split("/") |> List.last())
  {:ok, etag} = CapSend.Storage.Local.write_upload(payload, [File.read!(path)])
  {:ok, _} = Capture.complete_upload(rs, video.id, [%{"part_number" => 1, "etag" => etag}])
  {:ok, _} = Capture.submit_take(rs, take.id, %{"consent" => "true"})
end

days = fn n -> Date.utc_today() |> Date.add(n) |> Date.to_iso8601() end

request = fn attrs, keys ->
  {:ok, req} = Requests.create_request(scope, attrs)
  {:ok, recipients} = Recipients.add_recipients(scope, req, Enum.map(keys, entry))
  {:ok, _} = Recipients.send_invites(scope, req, "links")
  {req, Map.new(Enum.zip(keys, recipients))}
end

# Oldest first, so the list reads newest at the top.
{_, r} =
  request.(
    %{
      "title" => "Nurses Week thank-you",
      "due_on" => days.(5),
      "prompts" => %{"0" => %{"instructions" => "A 20-second thank-you to your team for Nurses Week."}}
    },
    [:anjali, :ben, :sofia]
  )

submit.(r.anjali, "face-clinic", "iPhone")
{:ok, _} = Recipients.record_open(r.ben)

{_, r} =
  request.(
    %{
      "title" => "Speaker intros: Summit 2026",
      "due_on" => days.(14),
      "prompts" => %{"0" => %{"instructions" => "Introduce yourself and your talk in 30 seconds."}}
    },
    [:daniel, :grace, :omar]
  )

submit.(r.daniel, "face-backstage", "iPhone")
{:ok, _} = Recipients.record_open(r.grace)

{_, r} =
  request.(
    %{
      "title" => "Regional updates: October",
      "due_on" => days.(3),
      "prompts" => %{"0" => %{"instructions" => "One minute on your region's month: a win, a challenge, a thank-you."}}
    },
    [:claire, :aiko]
  )

submit.(r.claire, "face-homeoffice", "Pixel 8")
{:ok, _} = Recipients.record_open(r.aiko)

{_, r} =
  request.(
    %{
      "title" => "Customer stories: fall campaign",
      "due_on" => days.(9),
      "consent_required" => "true",
      "consent_text" => "I agree that Northpeak may use this video in marketing materials.",
      "prompts" => %{
        "0" => %{"instructions" => "Tell us how your team uses Northpeak, in two minutes or less."}
      }
    },
    [:rosa, :kenji, :amara, :tom, :lena]
  )

submit.(r.rosa, "face-warehouse", "iPhone")
submit.(r.kenji, "face-cafe", "iPhone")
submit.(r.amara, "face-engineer", "Pixel 8")
{:ok, _} = Recipients.record_open(r.tom)

{:ok, _} =
  Requests.create_request(scope, %{
    "title" => "Board intro video",
    "prompts" => %{"0" => %{"instructions" => "A short introduction for the board pack."}}
  })

IO.puts("Seeded Northpeak. Log in as maya@northpeak.test / capsend-demo-1")
