# RiftMancer — installation guide

*Version française : LISEZ-MOI-AMIS.txt (docs/LISEZ-MOI-AMIS.md).*

This folder holds everything needed for one version of the app:

| File | What it is for |
|---|---|
| `RiftMancer-Setup-<version>.exe` | the PC app (Windows) |
| `RiftMancer-<version>.apk` | the Android app |
| `WHATS-NEW.txt` (`NOUVEAUTES.txt` in French) | what changes in this version |
| `FRIENDS-GUIDE.txt` (`LISEZ-MOI-AMIS.txt` in French) | this guide |
| `EMPREINTES.txt` | checksums to check that the files are intact |
| `LICENSE.txt`, `THIRD_PARTY_LICENSES.txt` | the licences |

Your cards stay with you: nothing goes on the Internet, the phone only talks to your PC, over your Wi-Fi.

The app is in English or French: **Settings → Display → Language** (it starts in French when the phone or PC is in French).

On the phone, the settings are in the **More → Settings** tab; on the PC, in **Settings** at the bottom of the menu on the left.

## 1. Check the files (recommended)

Before installing, check that the files were not damaged or changed during the download.

1. In the downloaded folder, right-click an empty area → « Open in Terminal » (or open PowerShell and go to the folder).
2. Type: `Get-FileHash ".\RiftMancer-Setup-<version>.exe" -Algorithm SHA256` (replace `<version>` with the file’s number).
3. Compare the result with the line of the same file in `EMPREINTES.txt`: the 64 characters must be identical (upper or lower case does not matter). Do the same for the APK.

If a checksum does not match, do not install that file: download it again and tell the person who gave it to you.

## 2. Install the PC app

1. Run `RiftMancer-Setup-<version>.exe`.
2. Windows may show « Windows protected your PC » (SmartScreen): the app is not signed by a publisher known to Microsoft. Click **More info**, then **Run anyway**.
3. Follow the installation. A « RiftMancer » shortcut is created on the desktop.
4. On the first launch, Windows may ask to allow the app on the network: accept for **private networks** (your Wi-Fi at home); that is what allows the sync with the phone.

## 3. Install the Android app

1. Copy `RiftMancer-<version>.apk` to the phone (USB cable, Drive…).
2. Open it from the phone’s Files app.
3. Android asks to allow installing apps from this source: allow it for the app that opens the file (Files, Drive…), then go back and tap **Install**.
4. Play Protect may warn that the app is unknown: choose **Install anyway**.

## 4. Link the phone to the PC (once)

The PC and the phone must be on the **same Wi-Fi**.

1. On the PC: **Settings → Sync**, show the **pairing QR code**.
2. On the phone: **More → Settings → Sync → Scan the PC’s QR code**, and aim at the PC’s screen (or paste the pairing code shown under the QR code).
3. The PC shows « Device paired recently ». Done: the QR code is no longer needed.

After installing, do a first sync: the phone then receives the large card pictures (until then, the zoom shows a smaller picture).

## 5. Sync

The sync is always started by you, from the phone (**More → Settings → Sync**, or the banner at the top of **More**):

- **Send to the PC**: your changes on the phone go to the PC;
- **Receive from the PC**: you get the PC’s;
- **Sync both ways**: both at once. If the same card was changed on both sides, the most recent change wins.

Sync regularly: it is also what keeps your collection safe if the phone is lost.

## 6. Back up

- **PC**: the app backs up by itself (on opening, after each sync, on closing). **Settings → Backups**: « Back up now » makes one at once; « Restore » on a line goes back in time.
- **PC**: in **Settings → Backups**, « Choose a folder… » adds a copy of each backup on a USB stick or another drive.
- **Phone**: the app backs up by itself (once a day when something changed), and once a week copies a backup to **Documents/Riftbound** (kept if you uninstall the app); **Settings → Backups** lists them, with « Restore » and « Export » (copy to Documents). The safest is still to sync with the PC: a banner on the Collection reminds you when changes have been waiting for several days.

## 7. Update the content (new cards, translations, banned cards)

The content is updated **from the PC app**, without waiting for a new version of the app. The phone then receives it at the sync.

1. On the PC: **Settings → Content**.
2. **Cards → Search**: the app looks at the official gallery and offers the new cards. Check the list, then **Install**. Do not close the app during the installation.
3. **French translations → Update** (translations by the riftboundfr.fr community). If the download fails, **Import files…** explains how to get the two files by hand.
4. **Banned cards → Update**: reads the official announcements of playriftbound.com. « Restore the previous list » goes back.
5. Sync the phone: it receives the new content.

If someone gives you a content **pack** (a file put on the Drive): **Settings → Content → Packs → Import a pack…**. No Internet needed. « Go back to the original content » undoes every content update.

## 8. Trade with friends

Nothing is sent automatically: lists travel as files that everyone puts wherever they like (Drive, message…).

1. **More → Trades and friends** (PC: **Trades and friends** in the menu) → **Export my list**: a small file with your duplicates and wishes, without prices paid or locations. Send it to your friends.
2. When a friend sends you theirs: **Import a friend’s list…**. A new list from the same friend replaces the old one.
3. Their card shows what they have that you are looking for, and the other way round, with prices. **Prepare a trade** fills the **Calculator**, which shows the value gap; **Save the trade** keeps it in the history (**Trades**), from where you apply it to your collection once it is done.

## 9. Update the app

When a new version arrives on the Drive:

1. Sync the phone with the PC (to be safe).
2. **PC**: run the new installer, **without uninstalling** the old version. Your cards are kept.
3. **Phone**: install the new APK **over** the old one, **without uninstalling**. Your cards are kept.

If Android refuses the update (« App not installed », « conflicts with an existing package »), do not uninstall anything and tell the person who gave you the app: uninstalling would erase the phone’s cards that were not synced.

## 10. If something goes wrong

If the app shows « Something went wrong »: your cards are not lost. Tap « Reload »; if the problem comes back, « Save my data to a file », then « Create a report ».

The report (also in **Settings → Help → Create a report**) is a file that helps understand the problem: versions, scanner settings, latest errors. It holds no cards, no names, no passwords, no addresses. Send it, with what you were doing and a screenshot, to the person who gave you the app. Never send them a password.

## 11. Credits

Free, non-commercial fan project.

RiftMancer was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.

> RiftMancer a été créé selon la politique « Legal Jibber Jabber » de Riot Games en utilisant des éléments appartenant à Riot Games. Riot Games ne soutient ni ne sponsorise ce projet.

RiftMancer is free software under the GNU AGPL-3.0 licence (its source code is available from the person who gave you the app). The app is based on riftbound-scanner by Nekoraru22 (MIT licence, https://github.com/Nekoraru22/riftbound-scanner), heavily modified and extended. The licence texts are in the package (LICENSE.txt, THIRD_PARTY_LICENSES.txt) and in the app: Settings → About → Licences.
