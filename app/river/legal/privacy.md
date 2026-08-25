# Privacy Policy

**Middle Fork Rafting Simulator**

Last updated: 24 August 2026

We wrote this to be read. If anything here is unclear, ask us, and we will fix
it in the next version.

Ben Adams makes the game ("we", "us"). Contact: **[SUPPORT EMAIL]**.

---

## The short version

- You make no account with us. We run no login server.
- We collect no analytics, no telemetry, and no crash reports. The game makes no
  web requests of any kind.
- We show no ads. We do not sell, rent, or share your data with data brokers or
  advertisers. We hold nothing to sell.
- Most of what the game stores stays on your own computer.
- Three things send data off your machine: playing with other people, connecting
  Discord, and using a trip code. Each has a section below.

---

## 1. What the game stores on your computer

These files sit in your own user directory. We never see them. On Windows that
directory is:

```
%APPDATA%\Godot\app_userdata\Middle Fork Rafting Simulator\
```

- **`settings.cfg`** holds your volume, screen mode, window size and position,
  graphics quality, key bindings, controller rumble, crew name, the last address
  you dialled, your meetup-server address, and where the game last registered itself as the handler for trip links (see below).
- **`records.cfg`** holds how far you have got down the river from each class of
  put-in.
- **`discord.dat`** appears only if you connect Discord. It holds one Discord
  refresh token, encrypted. See §4.
- **`logs/`** holds the game's own log of what it did, the same lines it would
  print to a console. Send one of these when you report a bug. The game rotates
  them and keeps the last few.

Delete any of these whenever you want. The game will make fresh ones.

### One thing the game writes outside that folder

So that a `mfrs://join/...` trip link opens the game when you click one, the
first run of an installed build tells your operating system that this game
handles links beginning `mfrs://`. It records where the game is installed, and
nothing else — no personal information is involved and nothing is sent
anywhere.

- **Windows:** a key under `HKEY_CURRENT_USER\Software\Classes\mfrs`. It
  belongs to your user account only; nothing is changed for anyone else who uses
  the computer, and no administrator rights are asked for.
- **Linux:** a file at
  `~/.local/share/applications/middle-fork-rafting-simulator.desktop`, marked so
  that it does not appear in your applications menu.

The game checks this each time it starts, in case you have moved or reinstalled
it, and rewrites it only when the location has changed. You can delete the key
or the file at any time; trip links will stop opening the game and nothing else
about it will change. Builds run from source, and every automated test and
screenshot run, register nothing at all.

---

## 2. What other players see when you play together

Middle Fork Rafting Simulator is peer-to-peer. One player hosts and the others
connect to them directly. No server of ours sits in the middle holding a copy of
your trip.

While you are on a trip with other people, the machines in that trip exchange:

- **The crew name you chose.** Pick anything. It does not have to be your real
  name.
- **What your boat and body are doing:** positions, strokes, who is aboard, who
  is swimming. This is the game.
- **Your voice**, if you turned voice chat on. Voice travels to the host and on
  to the rest of the crew. The game neither records it nor stores it.
- **Your IP address.** Any direct connection reveals it: your computer and
  theirs have to know where to send packets. The same is true of most
  multiplayer games and of every peer-to-peer one. Play with people you are
  willing to be connected to.

We write none of this down. When the trip ends, it is gone.

### About your microphone

You should know what the game does with your microphone, because the honest
answer has a wrinkle in it.

The game engine can offer voice chat at all only if it opens an audio input
device when the game starts. That is a property of the engine, settled before
any of our code runs, and it cannot wait until the moment you first speak. **So
on desktop, launching the game opens your microphone device, and your operating
system may show a microphone indicator from launch.**

What that does not mean:

- The game captures, encodes, and sends nothing unless you are on a trip with
  voice chat enabled.
- Neither we nor the game ever records anything to disk.
- You can turn voice chat off, and choose which input device it uses, in
  Settings → Sound.
- The Android build ships no voice chat and opens no microphone. A permanent
  indicator on a phone is a cost we decided not to pay.

---

## 3. Trip codes and the meetup server

If you host or join with a **trip code** instead of a plain address, your machine
talks briefly to a "meetup" server: an instance of
[noray](https://github.com/foxssake/noray), an open-source connection
orchestrator whose one job is to introduce two computers so they can connect
directly.

To do that, it handles:

- Your **IP address and port**, and the trip code you registered or dialled.

Two things are worth knowing:

1. **Introduction is the normal outcome.** Once the two machines find each other
   they talk directly, and the meetup server drops out of the conversation.
2. **Sometimes they cannot punch through.** Some home networks refuse. Then the
   meetup server relays the game traffic between you for the life of the trip.
   The trip board tells you when you are being relayed, so this never happens to
   you silently.

The meetup server keeps registrations only as long as the trip needs them and
writes them to no durable storage. If you would rather not use one, leave the
meetup-server field blank in Settings. Trip codes stop working, direct addresses
still work, and nothing leaves your machine except to the person you dialled.

---

## 4. Discord

Connecting Discord is optional. The game is complete without it, and builds that
ship no Discord library have none of it at all, including Android.

If you press "Connect Discord", the game uses the Discord Social SDK. Your
browser opens Discord's own consent page, and you decide there what to grant.

**What we receive from Discord:** your Discord user ID, your username and display
name, and the presence information the SDK provides so friends and invites work.

**What we send to Discord:** a description of what you are doing, so your friends
can see it on your profile and press Join. Specifically:

- how far down the river you are, the class of the reach, the rapid you are in,
  and how many people are aboard;
- when your trip can be joined, the trip code and a join secret, so the Join
  button works.

We leave out the name of the river you are on.

**Discord is an independent controller of this data.** Once information reaches
Discord, [Discord's own Privacy Policy](https://discord.com/privacy) governs it
rather than this one, and we cannot reach into your Discord account. We use what
Discord gives us for nothing beyond the features described here. We build no
profiles, and we share it onward with nobody.

**The one thing we keep** is a Discord *refresh token*, so you need not sign in
again every time you launch. It sits encrypted in `discord.dat` in your user
directory, under a key derived from your machine, so a copy of that file taken to
another computer is useless there. It is the only credential the game ever
stores. The game holds no client secret, by design.

**To disconnect:** Settings → You → *Disconnect Discord*. That does three things:
it stops sending presence, it asks Discord to invalidate the token, and it
deletes the token from your machine. The last of those happens whether or not the
first two succeed.

You can also revoke the game's access from Discord's side without us: Discord →
User Settings → Authorized Apps → remove Middle Fork Rafting Simulator. The
game's stored token then stops working, and the game forgets it the next time it
tries.

---

## 5. Children

Discord requires its users to be at least 13, and so do the terms we agree to in
order to use their SDK. **You must be 13 or older to connect a Discord account to
this game.** The game asks before it starts that process.

We do not knowingly collect information from children under 13, and the game is
not directed at them. If you believe a child under 13 has connected an account,
contact us and we will delete anything we hold.

We store the *answer* to the age question, a yes or a no. We do not store your
date of birth.

---

## 6. Your rights, and how to exercise them

We hold close to nothing about you, so you can carry out most of these yourself,
right now, without asking us:

- **See everything stored about you:** open the files listed in §1. That is all
  of it. Settings → About shows you the folder and has a button to open it.
- **Disconnect Discord and delete the token:** Settings → You → *Disconnect
  Discord*.
- **Delete everything:** delete the folder shown on Settings → About. The game
  makes fresh files the next time it starts.
- **Stop using the meetup server:** clear the meetup-server field in Settings.
- **Turn off voice chat:** Settings → Sound.
- **Read this policy or the terms inside the game:** Settings → About. Both
  documents ship with the build, so you can read them offline, and they always
  match the version you are running.

If you live in the UK or EU, the UK GDPR and GDPR give you rights to access,
correct, delete, or port your personal data, and to object to processing. If you
live in California, the CCPA and CPRA give you similar rights. We neither sell
nor share personal information as those laws define it. To exercise anything the
list above does not cover, or to ask us to confirm we hold nothing, write to
**[SUPPORT EMAIL]**. We will respond within 30 days.

Where we do process personal data, our lawful basis is performance of our
agreement with you, meaning running the multiplayer game you asked to play. For
Discord, the basis is the consent you gave at Discord's own consent screen, which
you can withdraw whenever you like by disconnecting.

---

## 7. Security

The game encrypts any Discord credential it stores. Everything else is ordinary
settings data in your own user profile, protected by your operating system's
account security. We keep no database of players, which is the most effective
security measure available to us: no store of personal data exists to breach.

If you find a security problem in the game, report it to **[SUPPORT EMAIL]**
rather than posting it publicly. We will credit you if you want us to.

---

## 8. Changes to this policy

If this policy changes in a way that affects what we do with your information, we
will note the change in the game's release notes and move the date at the top of
this page. Playing on after that is how you accept it. If you would rather not,
stop playing and delete the files in §1.

---

## 9. Contact

**[SUPPORT EMAIL]**

Ben Adams, developer, Middle Fork Rafting Simulator
