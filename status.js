/* ==========================================================================
   Náströnd — realm status badge

   Reads status.json and updates every element with [data-status-badge].
   The contract is fixed so the heartbeat (tier 2) can replace the hand-edited
   file later without any change to the markup or this script.

       {
         "state":   "online" | "offline" | "maintenance",
         "checked": "2026-09-05T14:32:00Z",   ISO 8601, UTC
         "message": "",                        optional, shown under the badge
         "players": null                       reserved for tier 3
       }

   Two rules this file enforces:

   1. The badge is Unknown until a fetch succeeds. The markup ships as Unknown,
      so a script error, a blocked request or a bad JSON file can never leave a
      stale green pill on the page claiming the realm is up.

   2. Staleness is computed here against `checked`, never trusted from the file.
      A status nobody has updated in a week is not information, it is a guess,
      and it degrades to Unknown on its own.
   ========================================================================== */

(function () {
  "use strict";

  // Tier 1 is hand-edited, so this is deliberately generous. When the systemd
  // heartbeat lands, drop it to about 3x the timer interval — 45 * 60 * 1000
  // for a 15-minute timer.
  var STALE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

  var LABELS = {
    online:      "Realm online",
    offline:     "Realm offline",
    maintenance: "Down for maintenance",
    unknown:     "Status unavailable"
  };

  function paint(state, message, checkedDate) {
    var badges = document.querySelectorAll("[data-status-badge]");

    for (var i = 0; i < badges.length; i++) {
      var badge = badges[i];
      var label = badge.querySelector("[data-status-label]");
      var note  = badge.parentNode.querySelector("[data-status-note]");

      badge.setAttribute("data-state", state);
      if (label) label.textContent = LABELS[state];

      // Screen readers get the state without having to infer it from a colour.
      badge.setAttribute("aria-label", LABELS[state]);

      if (checkedDate) {
        badge.title = "Last checked " + checkedDate.toLocaleString();
      }

      // Only the full-size badge on the home page carries a note element.
      if (note) note.textContent = message || "";
    }
  }

  function isValidState(s) {
    return s === "online" || s === "offline" || s === "maintenance";
  }

  function load() {
    // Pages CDNs cache aggressively. Without both of these the badge will
    // happily show an hour-old value while insisting it is current — the exact
    // failure the `checked` field exists to prevent.
    var url = "status.json?t=" + Date.now();

    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        if (!data || !isValidState(data.state)) {
          paint("unknown", "", null);
          return;
        }

        var checked = data.checked ? new Date(data.checked) : null;
        var valid   = checked && !isNaN(checked.getTime());

        if (!valid || (Date.now() - checked.getTime()) > STALE_AFTER_MS) {
          paint("unknown", "", valid ? checked : null);
          return;
        }

        paint(data.state, data.message, checked);
      })
      .catch(function () {
        // Fail soft, exactly like assetSync and remoteConfig in the launcher.
        // A dead status file must never be louder than the page itself.
        paint("unknown", "", null);
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load);
  } else {
    load();
  }
})();
