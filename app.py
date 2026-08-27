"""M&G fund debt stack dashboard — static server plus the market data hook.

The whole front end is static (index.html + assets/). The only server-side
concern is the "Live market data" panel on the Overview tab: it reads a single
endpoint, /api/market-data, which is served by get_market_data() below.

    To reconnect the panel to the internal market data feed, replace the body
    of get_market_data() (or point MARKET_DATA_SOURCE at your provider and add
    a branch). Keep the response shape and the front end needs no change:

        {
          "source":  "<human-readable provider name, shown in the caption>",
          "delayed": true | false,        # true renders the amber
                                          # "Indicative, delayed data" badge
          "asOf":    "<ISO-8601 timestamp, shown in the caption>",
          "rates": [
            {"key": "eur_swap_5y", "label": "EUR swap 5Y",
             "value": 2.35, "unit": "%", "change": 0.04},
            ...
          ]
        }

If the endpoint is unavailable (for example on a purely static deployment)
the page falls back to DATA.marketFallback in assets/data.js, so the layout
never renders empty.
"""

import os
from datetime import datetime, timezone

from flask import Flask, jsonify, send_from_directory

app = Flask(__name__, static_folder=".", static_url_path="")

# ---------------------------------------------------------------------------
# Market data configuration — the one place to switch feeds.
# ---------------------------------------------------------------------------
# "sample"   — the indicative placeholder levels below (default).
# "internal" — internal market data feed; wire it up in get_market_data().
MARKET_DATA_SOURCE = os.environ.get("MARKET_DATA_SOURCE", "sample")

# Indicative placeholder levels. Replace with the live feed, not by editing
# these numbers in production.
SAMPLE_RATES = [
    {"key": "eur_swap_5y", "label": "EUR swap 5Y",        "value": 2.35, "unit": "%",   "change": 0.04},
    {"key": "euribor_3m",  "label": "3M EURIBOR",         "value": 1.95, "unit": "%",   "change": -0.02},
    {"key": "ecb_depo",    "label": "ECB depo rate",      "value": 2.00, "unit": "%",   "change": 0.00},
    {"key": "re_spread",   "label": "€ RE credit spread", "value": 118, "unit": "bps", "change": -3},
]


def get_market_data():
    """Return the indicative rates shown in the Overview market panel.

    This is the single swappable source. Everything downstream — the panel
    layout, the delayed-data badge and the source caption — is driven by the
    dict returned here.
    """
    if MARKET_DATA_SOURCE == "internal":
        # Replace with the internal feed call, e.g.:
        #   quotes = market_data_client.snapshot(["EUSA5", "EUR003M", ...])
        #   return {"source": "M&G market data (internal)", "delayed": False,
        #           "asOf": quotes.timestamp.isoformat(), "rates": [...]}
        raise NotImplementedError("Internal market data feed is not wired up yet")

    return {
        "source": "Indicative sample levels (app.py)",
        "delayed": True,
        "asOf": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "rates": SAMPLE_RATES,
    }


@app.route("/api/market-data")
def market_data():
    try:
        payload = get_market_data()
    except NotImplementedError as exc:
        # Let the front end fall back to its static values rather than
        # rendering an empty panel.
        return jsonify({"error": str(exc)}), 503
    return jsonify(payload)


@app.route("/")
def index():
    return send_from_directory(".", "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("DATABRICKS_APP_PORT", 8000))
    app.run(host="0.0.0.0", port=port)
